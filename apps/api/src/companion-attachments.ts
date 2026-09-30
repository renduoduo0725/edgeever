import {
  AI_ATTACHMENT_MEDIA_TYPES,
  companionSupportsAttachment,
  getBase64DecodedByteLength,
  isAiTextAttachment,
  type AiAttachmentInput,
  type AiAttachmentMediaType,
  type AiProvider,
  type CompanionModelContentPart,
  type CompanionTurnAttachmentMeta,
} from "@edgeever/shared";
import { AppError } from "./app-error";
import type { CompanionScope } from "./companion-service";
import type { DatabaseAdapter } from "./storage-contract";

// D1 binds large strings poorly; keep each stored chunk under this size.
const PART_CHARS = 700_000;
const ATTACHMENT_TTL_MS = 24 * 60 * 60 * 1000;

type AttachmentRow = {
  id: string;
  turn_id: string | null;
  filename: string;
  media_type: string;
  byte_length: number;
  expires_at: string;
};

const scopeBindings = (scope: CompanionScope) => [scope.workspaceId, scope.ownerId];

const chunkBase64 = (data: string) => {
  const parts: string[] = [];
  for (let index = 0; index < data.length; index += PART_CHARS) parts.push(data.slice(index, index + PART_CHARS));
  return parts;
};

const decodeBase64Text = (data: string) => {
  try {
    const binary = atob(data);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    throw new AppError("companion_attachment_expired", "An attachment expired. Upload it again.", 409);
  }
};

const isKnownMediaType = (mediaType: string): mediaType is AiAttachmentMediaType =>
  (AI_ATTACHMENT_MEDIA_TYPES as readonly string[]).includes(mediaType);

// Delete parts explicitly. Do not rely on the foreign-key cascade.
const purgeExpiredCompanionAttachments = async (db: DatabaseAdapter, scope: CompanionScope, now: string) => {
  await db.batch([
    db.prepare(`DELETE FROM companion_turn_attachment_parts WHERE attachment_id IN (
      SELECT id FROM companion_turn_attachments WHERE workspace_id = ? AND owner_id = ? AND expires_at <= ?
    )`).bind(...scopeBindings(scope), now),
    db.prepare("DELETE FROM companion_turn_attachments WHERE workspace_id = ? AND owner_id = ? AND expires_at <= ?")
      .bind(...scopeBindings(scope), now),
  ]);
};

export const storeCompanionAttachment = async (db: DatabaseAdapter, scope: CompanionScope, input: AiAttachmentInput) => {
  const now = new Date();
  await purgeExpiredCompanionAttachments(db, scope, now.toISOString());
  const byteLength = getBase64DecodedByteLength(input.base64Data);
  if (byteLength === null) throw new AppError("invalid_params", "Attachment data must be valid base64.", 400);
  const id = crypto.randomUUID();
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + ATTACHMENT_TTL_MS).toISOString();
  const parts = chunkBase64(input.base64Data);
  await db.batch([
    db.prepare(`INSERT INTO companion_turn_attachments(
      id, workspace_id, owner_id, turn_id, filename, media_type, byte_length, created_at, expires_at
    ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?)`).bind(id, ...scopeBindings(scope), input.filename, input.mediaType, byteLength, createdAt, expiresAt),
    ...parts.map((data, partIndex) => db.prepare(
      "INSERT INTO companion_turn_attachment_parts(attachment_id, part_index, data) VALUES (?, ?, ?)",
    ).bind(id, partIndex, data)),
  ]);
  return { attachment: { id, filename: input.filename, mediaType: input.mediaType, byteLength, expiresAt } };
};

const loadOwnedAttachments = async (db: DatabaseAdapter, scope: CompanionScope, ids: readonly string[]) => {
  const rows = await db.prepare(`SELECT id, turn_id, filename, media_type, byte_length, expires_at
    FROM companion_turn_attachments WHERE workspace_id = ? AND owner_id = ? AND id IN (${ids.map(() => "?").join(", ")})`)
    .bind(...scopeBindings(scope), ...ids).all<AttachmentRow>();
  return new Map(rows.results.map((row) => [row.id, row]));
};

export const assertCompanionAttachmentsSupported = async (
  db: DatabaseAdapter, scope: CompanionScope, provider: AiProvider, ids: readonly string[] | undefined,
) => {
  if (!ids?.length) return;
  const owned = await loadOwnedAttachments(db, scope, ids);
  for (const id of ids) {
    const mediaType = owned.get(id)?.media_type;
    if (!mediaType || !companionSupportsAttachment(provider, mediaType)) {
      throw new AppError("companion_attachment_unsupported", "This model cannot read that attachment type.", 400);
    }
  }
};

export const bindCompanionTurnAttachments = async (
  db: DatabaseAdapter, scope: CompanionScope, turnId: string, ids: readonly string[] | undefined,
) => {
  if (!ids?.length) return;
  if (new Set(ids).size !== ids.length) {
    throw new AppError("companion_attachment_unavailable", "Attachment ids must be unique.", 400);
  }
  const now = new Date().toISOString();
  const owned = await loadOwnedAttachments(db, scope, ids);
  if (ids.some((id) => !owned.has(id))) {
    throw new AppError("companion_attachment_unavailable", "An attachment is missing or belongs to another account.", 404);
  }
  for (const id of ids) {
    const row = owned.get(id)!;
    if (row.expires_at <= now) throw new AppError("companion_attachment_expired", "An attachment expired. Upload it again.", 409);
    if (row.turn_id && row.turn_id !== turnId) {
      throw new AppError("companion_attachment_unavailable", "An attachment is already bound to another turn.", 409);
    }
  }
  const meta: CompanionTurnAttachmentMeta[] = ids.map((id) => {
    const row = owned.get(id)!;
    return { id: row.id, filename: row.filename, mediaType: row.media_type, byteLength: row.byte_length };
  });
  const result = await db.batch([
    db.prepare(`UPDATE companion_turn_attachments SET turn_id = ?
      WHERE workspace_id = ? AND owner_id = ? AND id IN (${ids.map(() => "?").join(", ")})
        AND (turn_id IS NULL OR turn_id = ?) AND expires_at > ?`)
      .bind(turnId, ...scopeBindings(scope), ...ids, turnId, now),
    db.prepare("UPDATE companion_turns SET attachment_meta_json = ? WHERE workspace_id = ? AND owner_id = ? AND id = ?")
      .bind(JSON.stringify(meta), ...scopeBindings(scope), turnId),
  ]);
  if (Number(result[0]?.meta.changes) !== ids.length || Number(result[1]?.meta.changes) !== 1) {
    throw new AppError("companion_attachment_unavailable", "Attachments could not be bound to this turn.", 409);
  }
};

const attachmentParts = (row: AttachmentRow, data: string): CompanionModelContentPart => {
  if (isKnownMediaType(row.media_type) && isAiTextAttachment(row.media_type)) {
    return { type: "text", text: `Attached file ${row.filename} (${row.media_type}):\n${decodeBase64Text(data)}` };
  }
  if (row.media_type.startsWith("image/")) return { type: "image", image: data, mediaType: row.media_type };
  if (row.media_type === "application/pdf") return { type: "file", data, mediaType: row.media_type, filename: row.filename };
  throw new AppError("companion_attachment_unsupported", "This model cannot read that attachment type.", 400);
};

export const loadCompanionAttachmentParts = async (
  db: DatabaseAdapter, scope: CompanionScope, turnId: string, provider: AiProvider,
): Promise<CompanionModelContentPart[]> => {
  const now = new Date().toISOString();
  const rows = await db.prepare(`SELECT id, turn_id, filename, media_type, byte_length, expires_at
    FROM companion_turn_attachments WHERE workspace_id = ? AND owner_id = ? AND turn_id = ? ORDER BY created_at, id`)
    .bind(...scopeBindings(scope), turnId).all<AttachmentRow>();
  if (!rows.results.length) return [];
  const parts: CompanionModelContentPart[] = [];
  for (const row of rows.results) {
    if (row.expires_at <= now) throw new AppError("companion_attachment_expired", "An attachment expired. Upload it again.", 409);
    if (!companionSupportsAttachment(provider, row.media_type)) {
      throw new AppError("companion_attachment_unsupported", "This model cannot read that attachment type.", 400);
    }
    const stored = await db.prepare(
      "SELECT part_index, data FROM companion_turn_attachment_parts WHERE attachment_id = ? ORDER BY part_index",
    ).bind(row.id).all<{ part_index: number; data: string }>();
    const chunks = stored.results;
    if (!chunks.length || chunks.some((chunk, index) => chunk.part_index !== index || !chunk.data)) {
      throw new AppError("companion_attachment_expired", "An attachment expired. Upload it again.", 409);
    }
    parts.push(attachmentParts(row, chunks.map((chunk) => chunk.data).join("")));
  }
  return parts;
};
