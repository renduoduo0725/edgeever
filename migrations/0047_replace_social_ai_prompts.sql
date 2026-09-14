PRAGMA foreign_keys = ON;

-- Replace Xiaohongshu / Twitter starters with extract-todos and continue-writing.
-- Untouched and edited presets both leave the catalog so they do not linger as
-- unexpected custom prompts. User-created prompts have no seed_key and are kept.
DELETE FROM ai_prompt_templates
WHERE seed_key IN ('rewrite-proofread', 'simplify-language');

INSERT OR IGNORE INTO ai_prompt_templates (
  id, workspace_id, seed_key, action, parameter_kind, result_mode,
  name, description, instruction,
  name_customized, description_customized, instruction_customized,
  created_at, updated_at
)
SELECT
  id || '_aiprompt_extract-todos', id, 'extract-todos', 'extract-todos', 'none', 'append',
  '提取待办', '识别可执行任务，生成任务清单',
  '从笔记中提取明确或隐含的可执行任务，用 Markdown 任务列表（- [ ]）输出。保持原语言，不要编造任务。若没有可执行事项，用原文语言简短说明。',
  0, 0, 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM workspaces;

INSERT OR IGNORE INTO ai_prompt_templates (
  id, workspace_id, seed_key, action, parameter_kind, result_mode,
  name, description, instruction,
  name_customized, description_customized, instruction_customized,
  created_at, updated_at
)
SELECT
  id || '_aiprompt_continue-writing', id, 'continue-writing', 'continue-writing', 'none', 'append',
  '继续写作', '从笔记末尾自然续写',
  '从笔记结束处自然续写。只返回新增续写内容，不要重复原文。保持原语言与 Markdown 风格。',
  0, 0, 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM workspaces;
