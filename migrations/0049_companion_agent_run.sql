-- Agent-run timeline, pinned mentions, todos, and pause/resume state.
-- Additive JSON columns; existing turns stay valid with empty arrays.
ALTER TABLE companion_turns ADD COLUMN tools_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE companion_turns ADD COLUMN todos_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE companion_turns ADD COLUMN questions_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE companion_turns ADD COLUMN mentions_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE companion_turns ADD COLUMN focus_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE companion_turns ADD COLUMN answers_json TEXT NOT NULL DEFAULT '[]';
