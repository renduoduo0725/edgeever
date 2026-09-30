-- Chat attachments are turn-scoped bytes, not note resources.
-- Upload happens before a turn exists, so turn_id stays nullable and has no
-- foreign key. Historical turns keep filenames only, in attachment_meta_json.
ALTER TABLE companion_turns ADD COLUMN attachment_meta_json TEXT NOT NULL DEFAULT '[]';

CREATE TABLE companion_turn_attachments (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  turn_id TEXT,
  filename TEXT NOT NULL,
  media_type TEXT NOT NULL,
  byte_length INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX idx_companion_turn_attachments_owner
  ON companion_turn_attachments(workspace_id, owner_id, expires_at);
CREATE INDEX idx_companion_turn_attachments_turn
  ON companion_turn_attachments(turn_id);

CREATE TABLE companion_turn_attachment_parts (
  attachment_id TEXT NOT NULL,
  part_index INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY (attachment_id, part_index),
  FOREIGN KEY (attachment_id) REFERENCES companion_turn_attachments(id) ON DELETE CASCADE
);
