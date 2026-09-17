-- User-facing answer stays in response; tool-side narration is stored separately.
ALTER TABLE companion_turns ADD COLUMN process_text TEXT NOT NULL DEFAULT '';
