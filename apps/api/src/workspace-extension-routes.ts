import {
  WorkspaceExtensionUpsertSchema,
  type WorkspaceExtension,
  type WorkspaceExtensionSourceKind,
} from "@edgeever/shared";
import { zValidator } from "@hono/zod-validator";
import type { Hono } from "hono";
import { audit } from "./audit";
import type { AppEnv, Bindings } from "./api-context";
import { isoNow } from "./entity-utils";
import { apiError, badRequest, notFound } from "./http-errors";
import { getAuditActor, getWorkspaceId, requireUser } from "./request-auth";
import type { DatabaseAdapter } from "./storage-contract";

const EXTENSION_ID_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)+$/;
const MAX_WORKSPACE_EXTENSIONS = 100;

type WorkspaceExtensionRow = {
  extension_id: string;
  extension_type: "plugin" | "theme";
  version: string;
  enabled: number;
  source_kind: WorkspaceExtensionSourceKind;
  verified: number;
  manifest_url: string;
  repository_url: string | null;
  release_tag: string | null;
  publisher: "edgeever" | null;
  installed_at: string;
  updated_at: string;
  deleted_at: string | null;
};

const EXTENSION_SELECT = `SELECT extension_id, extension_type, version, enabled, source_kind, verified,
  manifest_url, repository_url, release_tag, publisher, installed_at, updated_at, deleted_at
  FROM workspace_extensions`;

export const mapWorkspaceExtensionRow = (row: WorkspaceExtensionRow): WorkspaceExtension => ({
  extensionId: row.extension_id,
  type: row.extension_type,
  version: row.version,
  enabled: row.enabled === 1,
  installedAt: row.installed_at,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at,
  manifestUrl: row.manifest_url,
  sourceKind: row.source_kind,
  verified: row.verified === 1,
  repositoryUrl: row.repository_url,
  releaseTag: row.release_tag,
  publisher: row.publisher === "edgeever" ? "edgeever" : null,
});

const getWorkspaceExtensionRow = async (
  db: DatabaseAdapter,
  workspaceId: string,
  extensionId: string,
) =>
  db.prepare(`${EXTENSION_SELECT} WHERE workspace_id = ? AND extension_id = ?`)
    .bind(workspaceId, extensionId)
    .first<WorkspaceExtensionRow>();

const countLiveWorkspaceExtensions = async (
  db: DatabaseAdapter,
  workspaceId: string,
  exceptExtensionId?: string,
) => {
  const row = exceptExtensionId
    ? await db.prepare(
      `SELECT COUNT(*) AS total FROM workspace_extensions
       WHERE workspace_id = ? AND deleted_at IS NULL AND extension_id != ?`,
    ).bind(workspaceId, exceptExtensionId).first<{ total: number }>()
    : await db.prepare(
      `SELECT COUNT(*) AS total FROM workspace_extensions
       WHERE workspace_id = ? AND deleted_at IS NULL`,
    ).bind(workspaceId).first<{ total: number }>();
  return Number(row?.total ?? 0);
};

const parseExtensionId = (value: string) => {
  const extensionId = value.trim();
  return EXTENSION_ID_PATTERN.test(extensionId) && extensionId.length <= 200 ? extensionId : null;
};

export const registerWorkspaceExtensionRoutes = (
  app: Hono<AppEnv>,
  dependencies: { isDemoMode: (env: Bindings) => boolean },
) => {
  app.use("/api/v1/workspace-extensions/*", async (c, next) => {
    const denied = requireUser(c);
    if (denied) return denied;
    if (dependencies.isDemoMode(c.env)) {
      return apiError(c, "workspace_extension_demo_disabled", "Plugin catalog sync is not available in the public demo.", 403);
    }
    await next();
  });

  app.use("/api/v1/workspace-extensions", async (c, next) => {
    const denied = requireUser(c);
    if (denied) return denied;
    if (dependencies.isDemoMode(c.env)) {
      return apiError(c, "workspace_extension_demo_disabled", "Plugin catalog sync is not available in the public demo.", 403);
    }
    await next();
  });

  app.get("/api/v1/workspace-extensions", async (c) => {
    const rows = await c.env.storage.db.prepare(
      `${EXTENSION_SELECT} WHERE workspace_id = ? ORDER BY updated_at DESC, extension_id ASC`,
    ).bind(getWorkspaceId(c)).all<WorkspaceExtensionRow>();
    return c.json({ extensions: rows.results.map(mapWorkspaceExtensionRow) });
  });

  app.put("/api/v1/workspace-extensions/:extensionId", zValidator("json", WorkspaceExtensionUpsertSchema), async (c) => {
    const extensionId = parseExtensionId(c.req.param("extensionId"));
    if (!extensionId) return badRequest(c, "Extension id is invalid.");
    const input = c.req.valid("json");
    const workspaceId = getWorkspaceId(c);
    const existing = await getWorkspaceExtensionRow(c.env.storage.db, workspaceId, extensionId);
    if (!existing || existing.deleted_at) {
      const liveCount = await countLiveWorkspaceExtensions(
        c.env.storage.db,
        workspaceId,
        existing?.deleted_at ? extensionId : undefined,
      );
      if (liveCount >= MAX_WORKSPACE_EXTENSIONS) {
        return apiError(c, "workspace_extension_limit", "This workspace already has the maximum number of synced extensions.", 400);
      }
    }

    const now = isoNow();
    const repositoryUrl = input.repositoryUrl ?? null;
    const releaseTag = input.releaseTag ?? null;
    const publisher = input.publisher ?? null;
    await c.env.storage.db.prepare(
      `INSERT INTO workspace_extensions (
        workspace_id, extension_id, extension_type, version, enabled, source_kind, verified,
        manifest_url, repository_url, release_tag, publisher, installed_at, updated_at, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
      ON CONFLICT(workspace_id, extension_id) DO UPDATE SET
        extension_type = excluded.extension_type,
        version = excluded.version,
        enabled = excluded.enabled,
        source_kind = excluded.source_kind,
        verified = excluded.verified,
        manifest_url = excluded.manifest_url,
        repository_url = excluded.repository_url,
        release_tag = excluded.release_tag,
        publisher = excluded.publisher,
        installed_at = excluded.installed_at,
        updated_at = excluded.updated_at,
        deleted_at = NULL`,
    ).bind(
      workspaceId,
      extensionId,
      input.type,
      input.version,
      input.enabled ? 1 : 0,
      input.sourceKind,
      input.verified ? 1 : 0,
      input.manifestUrl,
      repositoryUrl,
      releaseTag,
      publisher,
      input.installedAt,
      now,
    ).run();

    if (input.type === "theme" && input.enabled) {
      await c.env.storage.db.prepare(
        `UPDATE workspace_extensions
         SET enabled = 0, updated_at = ?
         WHERE workspace_id = ? AND extension_type = 'theme' AND extension_id != ? AND deleted_at IS NULL AND enabled = 1`,
      ).bind(now, workspaceId, extensionId).run();
    }

    const row = await getWorkspaceExtensionRow(c.env.storage.db, workspaceId, extensionId);
    if (!row) return notFound(c, "Workspace extension not found");
    const actor = getAuditActor(c);
    await audit(c.env.storage.db, actor.actorType, actor.actorId, "workspace_extension.upsert", "workspace_extension", extensionId, {
      type: input.type,
      version: input.version,
      enabled: input.enabled,
      sourceKind: input.sourceKind,
    });
    return c.json({ extension: mapWorkspaceExtensionRow(row) });
  });

  app.delete("/api/v1/workspace-extensions/:extensionId", async (c) => {
    const extensionId = parseExtensionId(c.req.param("extensionId"));
    if (!extensionId) return badRequest(c, "Extension id is invalid.");
    const workspaceId = getWorkspaceId(c);
    const existing = await getWorkspaceExtensionRow(c.env.storage.db, workspaceId, extensionId);
    if (!existing) return notFound(c, "Workspace extension not found");
    if (existing.deleted_at) return c.json({ extension: mapWorkspaceExtensionRow(existing) });
    const now = isoNow();
    await c.env.storage.db.prepare(
      `UPDATE workspace_extensions
       SET enabled = 0, deleted_at = ?, updated_at = ?
       WHERE workspace_id = ? AND extension_id = ?`,
    ).bind(now, now, workspaceId, extensionId).run();
    const row = await getWorkspaceExtensionRow(c.env.storage.db, workspaceId, extensionId);
    const actor = getAuditActor(c);
    await audit(c.env.storage.db, actor.actorType, actor.actorId, "workspace_extension.delete", "workspace_extension", extensionId, {
      type: existing.extension_type,
    });
    return c.json({ extension: row ? mapWorkspaceExtensionRow(row) : mapWorkspaceExtensionRow({ ...existing, enabled: 0, deleted_at: now, updated_at: now }) });
  });
};
