PRAGMA foreign_keys = ON;

CREATE TABLE notebook_shares (
  id TEXT PRIMARY KEY,
  notebook_id TEXT NOT NULL UNIQUE REFERENCES notebooks(id) ON UPDATE CASCADE ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON UPDATE CASCADE ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_notebook_shares_workspace ON notebook_shares(workspace_id, updated_at DESC);
