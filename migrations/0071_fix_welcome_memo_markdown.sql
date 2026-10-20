-- Repair only the exact, untouched installation seed. SQL does not interpret \n.
-- Update the memo first so existing sync triggers announce the content change.
-- Both statements re-check the old content; replaying this migration is a no-op.
UPDATE memos
SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'memo_welcome'
  AND id IN (SELECT memo_id FROM memo_contents WHERE memo_id = 'memo_welcome'
  AND revision = 0
  AND content_hash = '4edcf7092f86c561210d4eb788e96f28ec5c045f93952c82f5f57e1902f548bd'
  AND content_json = '{"type":"doc","content":[{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"欢迎来到 EdgeEver"}]},{"type":"paragraph","content":[{"type":"text","text":"这是第一条 EdgeEver 笔记，三栏、边缘、Agent-ready。"}]},{"type":"paragraph","content":[{"type":"text","text":"接下来可以创建笔记本、写笔记、搜索内容，并把多条笔记合并成一条新的长期笔记。"}]}]}'
  AND content_markdown = '## 欢迎来到 EdgeEver\n\n这是第一条 EdgeEver 笔记，三栏、边缘、Agent-ready。\n\n接下来可以创建笔记本、写笔记、搜索内容，并把多条笔记合并成一条新的长期笔记。'
  AND content_text = '欢迎来到 EdgeEver 这是第一条 EdgeEver 笔记，三栏、边缘、Agent-ready。 接下来可以创建笔记本、写笔记、搜索内容，并把多条笔记合并成一条新的长期笔记。'
  AND NOT EXISTS (SELECT 1 FROM memo_revisions WHERE memo_id = 'memo_welcome')
  AND EXISTS (
    SELECT 1 FROM memos
    WHERE id = 'memo_welcome' AND workspace_id = 'ws_default'
      AND title = '欢迎来到 EdgeEver'
      AND created_by = 'system' AND updated_by = 'system' AND is_deleted = 0
  ));

UPDATE memo_contents
SET content_markdown = replace(content_markdown, '\n', char(10)),
    content_hash = '30fae5a337f8b9709505c5ab00ee921410b78632c14f4b7577c88aea0f9fc390',
    revision = revision + 1,
    updated_at = (SELECT updated_at FROM memos WHERE id = 'memo_welcome')
WHERE memo_id = 'memo_welcome'
  AND revision = 0
  AND content_hash = '4edcf7092f86c561210d4eb788e96f28ec5c045f93952c82f5f57e1902f548bd'
  AND content_json = '{"type":"doc","content":[{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"欢迎来到 EdgeEver"}]},{"type":"paragraph","content":[{"type":"text","text":"这是第一条 EdgeEver 笔记，三栏、边缘、Agent-ready。"}]},{"type":"paragraph","content":[{"type":"text","text":"接下来可以创建笔记本、写笔记、搜索内容，并把多条笔记合并成一条新的长期笔记。"}]}]}'
  AND content_markdown = '## 欢迎来到 EdgeEver\n\n这是第一条 EdgeEver 笔记，三栏、边缘、Agent-ready。\n\n接下来可以创建笔记本、写笔记、搜索内容，并把多条笔记合并成一条新的长期笔记。'
  AND content_text = '欢迎来到 EdgeEver 这是第一条 EdgeEver 笔记，三栏、边缘、Agent-ready。 接下来可以创建笔记本、写笔记、搜索内容，并把多条笔记合并成一条新的长期笔记。'
  AND NOT EXISTS (SELECT 1 FROM memo_revisions WHERE memo_id = 'memo_welcome')
  AND EXISTS (
    SELECT 1 FROM memos
    WHERE id = 'memo_welcome' AND workspace_id = 'ws_default'
      AND title = '欢迎来到 EdgeEver'
      AND created_by = 'system' AND updated_by = 'system' AND is_deleted = 0
  );
