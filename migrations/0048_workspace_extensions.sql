PRAGMA foreign_keys = ON;

CREATE TABLE workspace_extensions (
  workspace_id TEXT NOT NULL,
  extension_id TEXT NOT NULL,
  extension_type TEXT NOT NULL CHECK (extension_type IN ('plugin', 'theme')),
  version TEXT NOT NULL CHECK (length(trim(version)) > 0 AND length(version) <= 80),
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  source_kind TEXT NOT NULL CHECK (source_kind IN ('marketplace', 'github', 'manifest')),
  verified INTEGER NOT NULL CHECK (verified IN (0, 1)),
  manifest_url TEXT NOT NULL CHECK (length(trim(manifest_url)) > 0 AND length(manifest_url) <= 2000),
  repository_url TEXT CHECK (repository_url IS NULL OR (length(trim(repository_url)) > 0 AND length(repository_url) <= 500)),
  release_tag TEXT CHECK (release_tag IS NULL OR (length(trim(release_tag)) > 0 AND length(release_tag) <= 80)),
  publisher TEXT CHECK (publisher IS NULL OR publisher = 'edgeever'),
  installed_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  PRIMARY KEY (workspace_id, extension_id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
);

CREATE INDEX idx_workspace_extensions_workspace_updated
  ON workspace_extensions(workspace_id, deleted_at, updated_at DESC);
