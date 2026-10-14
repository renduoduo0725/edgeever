-- Keep hashes for existing access checks and older server versions.
-- Legacy passwords cannot be recovered; ciphertext is populated on regeneration.
ALTER TABLE memo_shares ADD COLUMN password_encrypted TEXT;
ALTER TABLE notebook_shares ADD COLUMN password_encrypted TEXT;
