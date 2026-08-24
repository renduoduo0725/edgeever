ALTER TABLE users ADD COLUMN email TEXT;
ALTER TABLE users ADD COLUMN password_login_enabled INTEGER NOT NULL DEFAULT 1 CHECK (password_login_enabled IN (0, 1));

CREATE UNIQUE INDEX idx_users_email_unique
  ON users(email)
  WHERE email IS NOT NULL;

CREATE TABLE oidc_identities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  issuer TEXT NOT NULL,
  subject TEXT NOT NULL,
  email TEXT,
  username TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_login_at TEXT,
  UNIQUE (issuer, subject),
  FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
);

CREATE INDEX idx_oidc_identities_user
  ON oidc_identities(user_id);

CREATE TABLE oidc_login_states (
  state TEXT PRIMARY KEY,
  nonce TEXT NOT NULL,
  code_verifier TEXT NOT NULL,
  redirect_to TEXT,
  device_id TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_oidc_login_states_expiry
  ON oidc_login_states(expires_at);
