CREATE TABLE poster_render_jobs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  memo_id TEXT NOT NULL REFERENCES memos(id) ON DELETE CASCADE,
  expected_revision INTEGER NOT NULL,
  template_id TEXT,
  status TEXT NOT NULL CHECK(status IN ('pending','rendering','completed','failed')),
  claim_token TEXT,
  expires_at TEXT NOT NULL,
  result_revision INTEGER,
  error_code TEXT,
  created_at TEXT NOT NULL,
  commit_guard INTEGER NOT NULL DEFAULT 1 CHECK(commit_guard = 1)
);
CREATE INDEX idx_poster_render_pending ON poster_render_jobs(workspace_id, status, created_at);
CREATE UNIQUE INDEX idx_poster_render_active ON poster_render_jobs(workspace_id, memo_id)
  WHERE status IN ('pending','rendering');
