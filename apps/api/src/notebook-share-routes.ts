import {
  NotebookShareUpdateSchema,
  PublicShareUnlockSchema,
  collectMemoLinkIds,
  accountNoteProseFromRow,
  publicNoteProseFromAccount,
  sanitizeNoteProseCss,
  parsePublishedNoteBodyFont,
  resolveMemoContentDoc,
  type NotebookShare,
  type PublicNotebookShare,
  type PublicMemoShare,
  type NoteProseAccountRow,
  type TiptapDoc,
} from "@edgeever/shared";
import { zValidator } from "@hono/zod-validator";
import type { Hono } from "hono";
import type { AppEnv } from "./api-context";
import { hashPassword, verifyPassword, randomToken } from "./auth-crypto";
import { audit } from "./audit";
import { createId, isoNow, parseJsonArray } from "./entity-utils";
import { apiError, notFound } from "./http-errors";
import { getAuditActor, getWorkspaceId, requireUser } from "./request-auth";
import { serveSharedResource } from "./share-routes";
import { allowPasswordProtectedShare, setShareAccessCookie } from "./share-http-access";
import { isShareUnlockBlocked, nextShareUnlockFailure, type ShareUnlockState } from "./share-access";
import { encryptSharePassword, readSharePassword } from "./share-password-encryption";
import { generateSharePassword } from "./share-password";

// Every public query starts at the live share, and constrains every level to
// its workspace. Deleted ancestors stop traversal; UNION also tolerates cycles.
const publicTreeSql = `WITH RECURSIVE tree(id, workspace_id) AS (
  SELECT n.id, n.workspace_id FROM notebook_shares ns
  JOIN notebooks n ON n.id = ns.notebook_id AND n.workspace_id = ns.workspace_id
  WHERE ns.token = ? AND n.is_deleted = 0
  UNION
  SELECT n.id, n.workspace_id FROM notebooks n JOIN tree t ON n.parent_id = t.id
  WHERE n.workspace_id = t.workspace_id AND n.is_deleted = 0
)`;

type ShareRow = {
  password_hash: string | null;
  password_encrypted: string | null;
  notebook_id: string;
  notebook_name: string;
  token: string;
  created_at: string;
  updated_at: string;
};
const mapShare = (row: ShareRow, password?: string): NotebookShare => ({
  passwordProtected: Boolean(row.password_hash),
  ...(password ? { password } : {}),
  notebookId: row.notebook_id,
  notebookName: row.notebook_name,
  token: row.token,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});
const selectShareSql = `SELECT ns.notebook_id, n.name AS notebook_name, ns.password_encrypted, ns.password_hash, ns.token, ns.created_at, ns.updated_at
  FROM notebook_shares ns JOIN notebooks n ON n.id = ns.notebook_id AND n.workspace_id = ns.workspace_id
  WHERE ns.workspace_id = ? AND n.is_deleted = 0`;
const validToken = (token: string) => /^[A-Za-z0-9_-]{43}$/.test(token);

export const registerNotebookShareRoutes = (app: Hono<AppEnv>) => {
  app.get("/api/v1/notebook-shares", async (c) => {
    const denied = requireUser(c);
    if (denied) return denied;
    const rows = await c.env.storage.db
      .prepare(`${selectShareSql} ORDER BY ns.created_at DESC, ns.id`)
      .bind(getWorkspaceId(c))
      .all<ShareRow>();
    c.header("Cache-Control", "private, no-store");
    return c.json({ shares: rows.results.map((row) => mapShare(row)) });
  });
  app.get("/api/v1/notebooks/:id/share", async (c) => {
    const denied = requireUser(c);
    if (denied) return denied;
    const row = await c.env.storage.db
      .prepare(`${selectShareSql} AND ns.notebook_id = ?`)
      .bind(getWorkspaceId(c), c.req.param("id"))
      .first<ShareRow>();
    c.header("Cache-Control", "private, no-store");
    return c.json({ share: row ? mapShare(row, row.password_hash ? await readSharePassword(row.password_encrypted, row.token, c.env, row.password_hash) : undefined) : null });
  });
  app.post("/api/v1/notebooks/:id/share", async (c) => {
    const denied = requireUser(c);
    if (denied) return denied;
    const workspaceId = getWorkspaceId(c);
    const notebookId = c.req.param("id");
    const notebook = await c.env.storage.db
      .prepare(
        "SELECT id FROM notebooks WHERE id = ? AND workspace_id = ? AND is_deleted = 0",
      )
      .bind(notebookId, workspaceId)
      .first();
    if (!notebook) return notFound(c, "Notebook not found");
    const token = randomToken(32);
    const now = isoNow();
    await c.env.storage.db
      .prepare(
        `INSERT OR IGNORE INTO notebook_shares (id, notebook_id, workspace_id, token, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        createId("nbshare"),
        notebookId,
        workspaceId,
        token,
        getAuditActor(c).actorId,
        now,
        now,
      )
      .run();
    const row = await c.env.storage.db
      .prepare(`${selectShareSql} AND ns.notebook_id = ?`)
      .bind(workspaceId, notebookId)
      .first<ShareRow>();
    if (!row) throw new Error("Could not allocate notebook share");
    if (row.token === token)
      await audit(
        c.env.storage.db,
        getAuditActor(c).actorType,
        getAuditActor(c).actorId,
        "notebook.share.create",
        "notebook",
        notebookId,
        {},
      );
    c.header("Cache-Control", "private, no-store");
    return c.json({ share: mapShare(row, row.password_hash ? await readSharePassword(row.password_encrypted, row.token, c.env, row.password_hash) : undefined) });
  });
  app.patch("/api/v1/notebooks/:id/share", zValidator("json", NotebookShareUpdateSchema), async (c) => {
    const denied = requireUser(c);
    if (denied) return denied;
    const workspaceId = getWorkspaceId(c);
    const notebookId = c.req.param("id");
    const existing = await c.env.storage.db.prepare(`${selectShareSql} AND ns.notebook_id = ?`)
      .bind(workspaceId, notebookId).first<ShareRow>();
    if (!existing) return notFound(c, "Active share not found");
    const password = c.req.valid("json").passwordProtected ? generateSharePassword() : undefined;
    const passwordHash = password ? await hashPassword(password) : null;
    const encrypted = password ? await encryptSharePassword(password, existing.token, c.env) : null;
    const now = isoNow();
    await c.env.storage.db.prepare(`UPDATE notebook_shares SET password_hash = ?, password_encrypted = ?, unlock_failed_count = 0,
      unlock_window_started_at = NULL, unlock_blocked_until = NULL, updated_at = ?
      WHERE notebook_id = ? AND workspace_id = ?`).bind(passwordHash, encrypted, now, notebookId, workspaceId).run();
    const actor = getAuditActor(c);
    await audit(c.env.storage.db, actor.actorType, actor.actorId,
      password ? (existing.password_hash ? "notebook.share_password_rotate" : "notebook.share_password_set") : "notebook.share_password_clear",
      "notebook", notebookId, {});
    c.header("Cache-Control", "private, no-store");
    return c.json({ share: mapShare({ ...existing, password_hash: passwordHash, updated_at: now }, password) });
  });
  app.delete("/api/v1/notebooks/:id/share", async (c) => {
    const denied = requireUser(c);
    if (denied) return denied;
    await c.env.storage.db
      .prepare(
        "DELETE FROM notebook_shares WHERE notebook_id = ? AND workspace_id = ?",
      )
      .bind(c.req.param("id"), getWorkspaceId(c))
      .run();
    await audit(
      c.env.storage.db,
      getAuditActor(c).actorType,
      getAuditActor(c).actorId,
      "notebook.share.revoke",
      "notebook",
      c.req.param("id"),
      {},
    );
    c.header("Cache-Control", "private, no-store");
    return c.json({ ok: true });
  });
};

export const registerPublicNotebookShareRoutes = (app: Hono<AppEnv>) => {
  app.use("/api/public/notebook-shares/*", async (c, next) => {
    c.header("Cache-Control", "private, no-store");
    c.header("X-Robots-Tag", "noindex, nofollow, noarchive");
    const token = c.req.path.split("/")[4] ?? "";
    if (!validToken(token)) return notFound(c, "Shared notebook not found");
    const gate = await c.env.storage.db.prepare(`SELECT ns.workspace_id, ns.password_hash FROM notebook_shares ns
      JOIN notebooks n ON n.id = ns.notebook_id AND n.workspace_id = ns.workspace_id
      WHERE ns.token = ? AND n.is_deleted = 0`).bind(token)
      .first<{ workspace_id: string; password_hash: string | null }>();
    if (!gate) return notFound(c, "Shared notebook not found");
    // Only the password submission bypasses the gate; all reads, including blobs, share it.
    const unlocking = c.req.method === "POST" && c.req.path === `/api/public/notebook-shares/${token}/unlock`;
    if (!unlocking && gate.password_hash && !(await allowPasswordProtectedShare(c, token, gate.password_hash))) {
      return apiError(c, "share_password_required", "Password required to view this shared notebook", 403);
    }
    await next();
  });
  app.post("/api/public/notebook-shares/:token/unlock", zValidator("json", PublicShareUnlockSchema), async (c) => {
    const token = c.req.param("token");
    const gate = await c.env.storage.db.prepare(`SELECT password_hash, unlock_failed_count, unlock_window_started_at, unlock_blocked_until
      FROM notebook_shares WHERE token = ?`).bind(token).first<ShareUnlockState & { password_hash: string | null }>();
    if (!gate) return notFound(c, "Shared notebook not found");
    if (!gate.password_hash) return apiError(c, "share_password_not_required", "This shared notebook does not require a password", 400);
    const rateLimited = () => apiError(c, "share_unlock_rate_limited", "Too many share password attempts. Try again later.", 429);
    if (isShareUnlockBlocked(gate.unlock_blocked_until)) return rateLimited();
    if (!(await verifyPassword(c.req.valid("json").password, gate.password_hash))) {
      const failure = nextShareUnlockFailure(gate);
      await c.env.storage.db.prepare(`UPDATE notebook_shares SET unlock_failed_count = ?, unlock_window_started_at = ?, unlock_blocked_until = ?
        WHERE token = ?`).bind(failure.failureCount, failure.windowStartedAt, failure.blockedUntil, token).run();
      return failure.blockedUntil ? rateLimited() : apiError(c, "share_password_invalid", "Incorrect share password", 403);
    }
    await c.env.storage.db.prepare(`UPDATE notebook_shares SET unlock_failed_count = 0, unlock_window_started_at = NULL, unlock_blocked_until = NULL
      WHERE token = ?`).bind(token).run();
    await setShareAccessCookie(c, token, gate.password_hash, `/api/public/notebook-shares/${token}`);
    return c.json({ ok: true });
  });
  app.get("/api/public/notebook-shares/:token", async (c) => {
    const token = c.req.param("token");
    if (!validToken(token)) return notFound(c, "Shared notebook not found");
    const root = await c.env.storage.db
      .prepare(
        `SELECT n.id, n.name FROM notebook_shares ns
      JOIN notebooks n ON n.id = ns.notebook_id AND n.workspace_id = ns.workspace_id
      WHERE ns.token = ? AND n.is_deleted = 0`,
      )
      .bind(token)
      .first<{ id: string; name: string }>();
    if (!root) return notFound(c, "Shared notebook not found");
    const notebooks = await c.env.storage.db
      .prepare(
        `${publicTreeSql}
      SELECT n.id, n.parent_id AS parentId, n.name FROM notebooks n JOIN tree t ON n.id = t.id AND n.workspace_id = t.workspace_id
      ORDER BY n.sort_order, n.name, n.id`,
      )
      .bind(token)
      .all<PublicNotebookShare["notebooks"][number]>();
    if (!notebooks.results.length)
      return notFound(c, "Shared notebook not found");
    const memos = await c.env.storage.db
      .prepare(
        `${publicTreeSql}
      SELECT m.id, m.notebook_id AS notebookId, m.title FROM memos m JOIN tree t ON m.notebook_id = t.id AND m.workspace_id = t.workspace_id
      WHERE m.is_deleted = 0 ORDER BY m.is_pinned DESC, m.updated_at DESC, m.id`,
      )
      .bind(token)
      .all<PublicNotebookShare["memos"][number]>();
    const share: PublicNotebookShare = {
      notebookId: root.id,
      name: root.name,
      notebooks: notebooks.results.map((n) => ({
        ...n,
        parentId: n.id === root.id ? null : n.parentId,
      })),
      memos: memos.results,
    };
    return c.json({ share });
  });
  app.get("/api/public/notebook-shares/:token/memos/:memoId", async (c) => {
    const token = c.req.param("token");
    if (!validToken(token)) return notFound(c, "Shared note not found");
    const row = await c.env.storage.db
      .prepare(
        `${publicTreeSql}
      SELECT m.title, mc.content_json, mc.content_markdown, m.tags_json, m.updated_at, u.note_body_font,
        u.note_prose_font_size, u.note_prose_line_height, u.note_prose_palette, u.note_prose_custom_css, u.note_prose_custom_colors
      FROM memos m JOIN tree t ON m.notebook_id = t.id AND m.workspace_id = t.workspace_id
      JOIN memo_contents mc ON mc.memo_id = m.id
      JOIN notebook_shares ns ON ns.token = ?
      LEFT JOIN users u ON u.id = ns.created_by
      WHERE m.id = ? AND m.is_deleted = 0`,
      )
      .bind(token, token, c.req.param("memoId"))
      .first<
        NoteProseAccountRow & {
          title: string | null;
          content_json: string;
          content_markdown: string;
          tags_json: string;
          updated_at: string;
          note_body_font: string | null;
        }
      >();
    if (!row) return notFound(c, "Shared note not found");
    const contentJson = JSON.parse(row.content_json) as TiptapDoc;
    const memoUrls: Record<string, string> = {};
    const ids = collectMemoLinkIds(
      resolveMemoContentDoc(contentJson, row.content_markdown),
    );
    for (let offset = 0; offset < ids.length; offset += 80) {
      const batch = ids.slice(offset, offset + 80);
      const linked = await c.env.storage.db
        .prepare(
          `${publicTreeSql}
        SELECT m.id FROM memos m JOIN tree t ON m.notebook_id = t.id AND m.workspace_id = t.workspace_id
        WHERE m.is_deleted = 0 AND m.id IN (${batch.map(() => "?").join(",")})`,
        )
        .bind(token, ...batch)
        .all<{ id: string }>();
      for (const memo of linked.results)
        memoUrls[memo.id] =
          `/share/notebook/${encodeURIComponent(token)}/${encodeURIComponent(memo.id)}`;
    }
    const account = accountNoteProseFromRow(row);
    const share: PublicMemoShare = {
      title: row.title,
      contentJson,
      contentMarkdown: row.content_markdown,
      tags: parseJsonArray(row.tags_json),
      updatedAt: row.updated_at,
      memoShareTokens: {},
      bodyFont: parsePublishedNoteBodyFont(row.note_body_font),
      prose: publicNoteProseFromAccount({
        ...account,
        customCss:
          account.customCss === null
            ? null
            : sanitizeNoteProseCss(account.customCss),
      }),
    };
    return c.json({ share, memoUrls });
  });
  app.get(
    "/api/public/notebook-shares/:token/resources/:resourceId/blob",
    async (c) => {
      const token = c.req.param("token");
      if (!validToken(token)) return notFound(c, "Shared resource not found");
      const resource = await c.env.storage.db
        .prepare(
          `${publicTreeSql}
      SELECT r.object_key, r.storage_config_id, r.kind, r.mime_type, r.filename, r.byte_size,
        m.workspace_id, NULL AS password_hash
      FROM resources r JOIN memos m ON r.memo_id = m.id
      JOIN tree t ON m.notebook_id = t.id AND m.workspace_id = t.workspace_id
      WHERE r.id = ? AND r.is_deleted = 0 AND m.is_deleted = 0`,
        )
        .bind(token, c.req.param("resourceId"))
        .first<Parameters<typeof serveSharedResource>[1]>();
      if (!resource) return notFound(c, "Shared resource not found");
      return serveSharedResource(c, resource);
    },
  );
};
