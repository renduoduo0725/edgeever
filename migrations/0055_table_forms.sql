PRAGMA foreign_keys = ON;

CREATE TABLE table_forms (
  id TEXT PRIMARY KEY,
  memo_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  token TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  password_hash TEXT,
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  submit_label TEXT NOT NULL DEFAULT '',
  fields_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(fields_json)),
  unlock_failed_count INTEGER NOT NULL DEFAULT 0,
  unlock_window_started_at TEXT,
  unlock_blocked_until TEXT,
  submit_count INTEGER NOT NULL DEFAULT 0,
  submit_window_started_at TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (memo_id) REFERENCES memos(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  UNIQUE (memo_id),
  UNIQUE (token)
);

CREATE INDEX idx_table_forms_workspace
  ON table_forms(workspace_id, updated_at DESC);
