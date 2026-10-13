import { sha256Hex } from "./github-plugin-distribution";
import {
  applyDiagramOperations, applyTableOperations, diagramSemanticGraph,
  hasDiagramDocumentMarker, hasTableDocumentMarker, hasPosterDocumentMarker, hasInfographicDocumentMarker,
  posterCapabilities, parsePosterDocument, parseInfographicDocument, applyPosterEdits, applyInfographicOperations, serializePosterDocument, serializeInfographicDocument,
  parseDiagramDocument, parseTableDocument, serializeTableDocument, tableFallbackMarkdown, markdownToDoc,
  StructuredNoteError, type MemoDetail,
} from "@edgeever/shared";
import type { PluginApiErrorCode, PluginNoteKind, PluginStructuredEditInput } from "@edgeever/plugin-api";

export const pluginNoteKind = (note: { diagramKind?: string | null; structuredTable?: boolean; poster?: boolean; infographic?: boolean; videoNote?: boolean; contentMarkdown?: string }): PluginNoteKind => {
  const markdown = note.contentMarkdown;
  const marker = markdown?.match(/<!--\s*edgeever-(diagram|table|poster|infographic)-v1\s*:/)?.[1];
  if (note.diagramKind || marker === "diagram" || hasDiagramDocumentMarker(markdown)) return parseDiagramDocument(markdown)?.kind ?? (note.diagramKind as PluginNoteKind | undefined) ?? "mind-map";
  if (note.structuredTable || marker === "table" || hasTableDocumentMarker(markdown)) return "table";
  if (note.poster || marker === "poster" || hasPosterDocumentMarker(markdown)) return "poster";
  if (note.infographic || marker === "infographic" || hasInfographicDocumentMarker(markdown)) return "infographic";
  if (note.videoNote) return "video";
  return "text";
};
export const structuredApiError = (code: PluginApiErrorCode, message: string) => Object.assign(new Error(message), { code });
export const assertPluginMarkdownNote = (note: Parameters<typeof pluginNoteKind>[0]) => {
  if (pluginNoteKind(note) !== "text") throw structuredApiError("STRUCTURED_NOTE_REQUIRED", "Use the structured note API to edit this note's content. Metadata can still be updated through notes.update().");
};
export const structuredEditToken = (note: MemoDetail) => sha256Hex(JSON.stringify([note.id, note.revision, note.contentHash, note.title, note.tags, note.contentMarkdown, note.contentJson]));
export const assertStructuredRevision = async (note: MemoDetail, input: PluginStructuredEditInput) => {
  if (!input || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0 || typeof input.expectedContentHash !== "string" || !input.expectedContentHash.trim()
    || typeof input.expectedEditToken !== "string" || !/^[a-f0-9]{64}$/.test(input.expectedEditToken)
    || (input.dryRun !== undefined && typeof input.dryRun !== "boolean")) throw structuredApiError("INVALID_STRUCTURED_EDIT", "A valid expected revision, content hash, edit token and optional boolean dryRun are required.");
  if (input.expectedRevision !== note.revision || input.expectedContentHash !== note.contentHash || input.expectedEditToken !== await structuredEditToken(note)) throw structuredApiError("NOTE_CONFLICT", "The note changed. Read it again before editing.");
};
export const pluginDiagram = (note: MemoDetail) => {
  const document = parseDiagramDocument(note.contentMarkdown);
  if (!document) throw structuredApiError("NOTE_TYPE_MISMATCH", "This note is not an editable diagram.");
  return document;
};
export const pluginTable = (note: MemoDetail) => {
  const document = parseTableDocument(note.contentMarkdown);
  if (!document) throw structuredApiError("NOTE_TYPE_MISMATCH", "This note is not a structured table.");
  return document;
};
export const pluginPoster = (note: MemoDetail) => {
  const document = parsePosterDocument(note.contentMarkdown);
  if (!document) throw structuredApiError("NOTE_TYPE_MISMATCH", "This note is not an editable poster.");
  return document;
};
export const pluginInfographic = (note: MemoDetail) => {
  const document = parseInfographicDocument(note.contentMarkdown);
  if (!document) throw structuredApiError("NOTE_TYPE_MISMATCH", "This note is not an editable infographic.");
  return document;
};
export const translateStructuredError = (error: unknown): never => {
  if (error instanceof StructuredNoteError) throw structuredApiError("INVALID_STRUCTURED_EDIT", error.message);
  throw error;
};
export { posterCapabilities, applyPosterEdits, applyInfographicOperations, serializePosterDocument, serializeInfographicDocument, applyDiagramOperations, applyTableOperations, diagramSemanticGraph, serializeTableDocument, tableFallbackMarkdown, markdownToDoc };
