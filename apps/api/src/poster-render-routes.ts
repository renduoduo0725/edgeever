import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { bodyLimit } from 'hono/body-limit';
import type { Hono } from 'hono';
import { PosterDocumentSchema, parsePosterDocument, serializePosterDocument } from '@edgeever/shared';
import type { AppEnv } from './api-context';
import { getWorkspaceId, requireUser, getAuditActor, getActorLabel } from './request-auth';
import { apiError } from './http-errors';
import { claimPosterRender, readPosterRenderJob, posterRenderJob } from './poster-render-service';
import { getMemoDetail, updateMemoRecord } from './memo-service';
import { getResourceRow, listResourcesForMemo } from './resource-service';
import { isoNow } from './entity-utils';

export function registerPosterRenderRoutes(app: Hono<AppEnv>) {
  app.use('/api/v1/poster-render/*', bodyLimit({ maxSize: 1024 * 1024 }));
  app.use('/api/v1/poster-render/*', async (c, next) => {
    const denied = requireUser(c); if (denied) return denied;
    c.header('Cache-Control', 'no-store');
    await next();
  });
  app.post('/api/v1/poster-render/claim', async c => {
    const row = await claimPosterRender(c.env.storage.db, getWorkspaceId(c));
    return c.json({ job: row ? { ...posterRenderJob(row), claimToken: row.claim_token } : null });
  });
  const completion = z.object({ claimToken: z.string().min(1), document: PosterDocumentSchema.optional(), errorCode: z.enum(['render_failed', 'revision_conflict', 'client_timeout']).optional() }).strict();
  app.post('/api/v1/poster-render/:id/complete', zValidator('json', completion), async c => {
    const input = c.req.valid('json'), db = c.env.storage.db, workspace = getWorkspaceId(c);
    const row = await readPosterRenderJob(db, workspace, c.req.param('id'));
    if (!row || row.claim_token !== input.claimToken) return apiError(c, 'not_found', 'Render task not found', 404);
    if (row.status === 'completed') return c.json({ job: posterRenderJob(row) });
    if (row.status !== 'rendering' || row.expires_at <= isoNow()) return apiError(c, 'render_expired', 'Render lease expired', 409);
    if (input.errorCode) {
      await db.prepare("UPDATE poster_render_jobs SET status = 'failed', error_code = ? WHERE id = ? AND workspace_id = ? AND status = 'rendering' AND claim_token = ?").bind(input.errorCode, row.id, workspace, input.claimToken).run();
      return c.json({ job: posterRenderJob((await readPosterRenderJob(db, workspace, row.id))!) });
    }
    const document = input.document;
    if (!document?.previewResourceId) return apiError(c, 'invalid_params', 'Rendered preview is required', 400);
    const memo = await getMemoDetail(db, workspace, row.memo_id);
    const current = memo && parsePosterDocument(memo.contentMarkdown);
    if (!memo || !current || memo.revision !== row.expected_revision) return apiError(c, 'revision_conflict', 'Poster changed during rendering', 409);
    if (row.template_id && (document.templateId !== row.template_id || current.elements.some(element => element.locked))) return apiError(c, 'invalid_params', 'Invalid template result', 400);
    if (!row.template_id && JSON.stringify({ ...current, previewResourceId: undefined }) !== JSON.stringify({ ...document, previewResourceId: undefined })) return apiError(c, 'invalid_params', 'Render must preserve the source', 400);
    const preview = await getResourceRow(db, workspace, document.previewResourceId);
    if (!preview || preview.memo_id !== memo.id || preview.kind !== 'image' || preview.mime_type !== 'image/png' || preview.byte_size > 4 * 1024 * 1024) return apiError(c, 'invalid_params', 'Use a PNG preview belonging to this poster, at most 4 MiB', 400);
    const owned = new Set((await listResourcesForMemo(db, workspace, memo.id)).filter(resource => resource.kind === 'image').map(resource => resource.id));
    if (document.elements.some(element => element.type === 'image' && !owned.has(element.resourceId))) return apiError(c, 'invalid_params', 'Image resources must belong to this poster', 400);
    // CHECK failure aborts the entire memo batch if either the lease or source
    // changed between validation and commit. No read-then-write race window.
    try {
      const result = await updateMemoRecord(db, workspace, memo.id, { expectedRevision: row.expected_revision, contentMarkdown: serializePosterDocument(document) }, getAuditActor(c), getActorLabel(c), false, {
        before: [db.prepare(`UPDATE poster_render_jobs SET commit_guard = CASE WHEN status = 'rendering' AND claim_token = ? AND expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          AND EXISTS (SELECT 1 FROM memo_contents mc JOIN memos m ON m.id = mc.memo_id WHERE mc.memo_id = ? AND mc.revision = ? AND m.is_deleted = 0 AND m.workspace_id = ?) THEN 1 ELSE 0 END
          WHERE id = ? AND workspace_id = ?`).bind(input.claimToken, memo.id, row.expected_revision, workspace, row.id, workspace)],
        after: () => [db.prepare("UPDATE poster_render_jobs SET status = 'completed', result_revision = (SELECT revision FROM memo_contents WHERE memo_id = ?) WHERE id = ? AND workspace_id = ?").bind(memo.id, row.id, workspace)],
      });
      if (result.error) return apiError(c, result.error, result.message, 409);
    } catch (error) {
      if (String(error).includes('commit_guard')) return apiError(c, 'revision_conflict', 'Render lease or poster changed', 409);
      throw error;
    }
    return c.json({ job: posterRenderJob((await readPosterRenderJob(db, workspace, row.id))!) });
  });
}
