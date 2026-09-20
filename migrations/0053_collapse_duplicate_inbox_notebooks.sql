PRAGMA foreign_keys = ON;

-- 0046 restored a workspace-scoped inbox id, but only looked for `nb_inbox`
-- or `{workspace}_inbox`. Workspaces whose inbox already existed under a
-- different id (slug `inbox`) got a second empty "等待分类". Keep one active
-- inbox per workspace: prefer the notebook that already has notes.
CREATE TABLE _inbox_dedup_canonical (
  workspace_id TEXT PRIMARY KEY,
  id TEXT NOT NULL
);

INSERT INTO _inbox_dedup_canonical (workspace_id, id)
SELECT n.workspace_id, n.id
FROM notebooks n
WHERE n.is_deleted = 0
  AND (n.slug = 'inbox' OR n.id = 'nb_inbox' OR n.id = n.workspace_id || '_inbox')
  AND n.id = (
    SELECT keep.id
    FROM notebooks keep
    WHERE keep.workspace_id = n.workspace_id
      AND keep.is_deleted = 0
      AND (keep.slug = 'inbox' OR keep.id = 'nb_inbox' OR keep.id = keep.workspace_id || '_inbox')
    ORDER BY
      (SELECT COUNT(*) FROM memos m WHERE m.notebook_id = keep.id AND m.is_deleted = 0) DESC,
      CASE
        WHEN keep.id = keep.workspace_id || '_inbox' THEN 0
        WHEN keep.id = 'nb_inbox' THEN 1
        ELSE 2
      END,
      keep.created_at ASC,
      keep.id ASC
    LIMIT 1
  );

UPDATE notebooks
SET
  parent_id = (
    SELECT canonical.id
    FROM _inbox_dedup_canonical canonical
    WHERE canonical.workspace_id = notebooks.workspace_id
  ),
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE parent_id IN (
  SELECT extra.id
  FROM notebooks extra
  JOIN _inbox_dedup_canonical canonical
    ON canonical.workspace_id = extra.workspace_id
  WHERE extra.is_deleted = 0
    AND (extra.slug = 'inbox' OR extra.id = 'nb_inbox' OR extra.id = extra.workspace_id || '_inbox')
    AND extra.id <> canonical.id
);

UPDATE memos
SET notebook_id = (
  SELECT canonical.id
  FROM _inbox_dedup_canonical canonical
  WHERE canonical.workspace_id = memos.workspace_id
)
WHERE notebook_id IN (
  SELECT extra.id
  FROM notebooks extra
  JOIN _inbox_dedup_canonical canonical
    ON canonical.workspace_id = extra.workspace_id
  WHERE extra.is_deleted = 0
    AND (extra.slug = 'inbox' OR extra.id = 'nb_inbox' OR extra.id = extra.workspace_id || '_inbox')
    AND extra.id <> canonical.id
);

UPDATE companion_memories
SET scope_notebook_id = (
  SELECT canonical.id
  FROM _inbox_dedup_canonical canonical
  WHERE canonical.workspace_id = companion_memories.workspace_id
)
WHERE scope_notebook_id IN (
  SELECT extra.id
  FROM notebooks extra
  JOIN _inbox_dedup_canonical canonical
    ON canonical.workspace_id = extra.workspace_id
  WHERE extra.is_deleted = 0
    AND (extra.slug = 'inbox' OR extra.id = 'nb_inbox' OR extra.id = extra.workspace_id || '_inbox')
    AND extra.id <> canonical.id
);

UPDATE companion_actions
SET result_notebook_id = (
  SELECT canonical.id
  FROM _inbox_dedup_canonical canonical
  WHERE canonical.workspace_id = companion_actions.workspace_id
)
WHERE result_notebook_id IN (
  SELECT extra.id
  FROM notebooks extra
  JOIN _inbox_dedup_canonical canonical
    ON canonical.workspace_id = extra.workspace_id
  WHERE extra.is_deleted = 0
    AND (extra.slug = 'inbox' OR extra.id = 'nb_inbox' OR extra.id = extra.workspace_id || '_inbox')
    AND extra.id <> canonical.id
);

UPDATE notebooks
SET
  is_deleted = 1,
  deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE is_deleted = 0
  AND (slug = 'inbox' OR id = 'nb_inbox' OR id = workspace_id || '_inbox')
  AND id NOT IN (SELECT id FROM _inbox_dedup_canonical);

DROP TABLE _inbox_dedup_canonical;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notebooks_one_active_inbox
  ON notebooks(workspace_id)
  WHERE is_deleted = 0 AND slug = 'inbox';
