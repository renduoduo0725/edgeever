ALTER TABLE notebook_shares ADD COLUMN password_hash TEXT;
ALTER TABLE notebook_shares ADD COLUMN unlock_failed_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE notebook_shares ADD COLUMN unlock_window_started_at TEXT;
ALTER TABLE notebook_shares ADD COLUMN unlock_blocked_until TEXT;
