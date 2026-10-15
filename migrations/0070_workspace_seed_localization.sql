-- Default notebooks, the welcome note, and the default templates of a
-- workspace are localized once, at the first sign-in of the workspace's user,
-- using that user's resolved UI locale. A row here means the workspace still
-- waits for that step; the sign-in removes it in the same transaction that
-- localizes the seed data, so a failed attempt is retried on the next sign-in.
CREATE TABLE IF NOT EXISTS workspace_seed_localizations (
  workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Only an installation that nobody has used yet qualifies: no user has ever
-- signed in, and the default workspace holds nothing beyond what the
-- migrations seed. Existing installations, including unclaimed ones that
-- already hold data, keep their notebooks and welcome note unchanged.
INSERT OR IGNORE INTO workspace_seed_localizations (workspace_id)
SELECT 'ws_default'
WHERE EXISTS (SELECT 1 FROM workspaces WHERE id = 'ws_default')
  AND NOT EXISTS (SELECT 1 FROM users)
  AND NOT EXISTS (SELECT 1 FROM workspace_members)
  AND NOT EXISTS (SELECT 1 FROM memos WHERE id <> 'memo_welcome')
  AND NOT EXISTS (
    SELECT 1 FROM memo_contents
    WHERE memo_id = 'memo_welcome'
      AND content_hash <> '4edcf7092f86c561210d4eb788e96f28ec5c045f93952c82f5f57e1902f548bd'
  )
  AND NOT EXISTS (SELECT 1 FROM memo_revisions)
  AND NOT EXISTS (SELECT 1 FROM resources)
  AND NOT EXISTS (
    SELECT 1 FROM notebooks
    WHERE slug IS NULL
       OR slug NOT IN ('inbox', 'work-projects', 'learning-resources', 'creative-ideas', 'personal-life')
  );
