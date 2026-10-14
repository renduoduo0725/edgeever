# Recoverable share passwords

Note and notebook share passwords use the existing AES-GCM secret encryption component. The database retains a PBKDF2 hash for visitor verification and stores ciphertext for password recovery through the authenticated single-share management endpoint. Public endpoints, share lists, and audit records do not return passwords. The Web client displays the server response without saving new passwords in local or session storage.

The primary root is `EDGE_EVER_CREDENTIALS_ENCRYPTION_KEY`, falling back to `EDGE_EVER_AUTH_PASSWORD` or `EDGE_EVER_AUTH_PASSWORD_HASH` when no dedicated root is configured. Share encryption uses its own purpose prefix and is bound to the share token. Local development already supplies a credential key; Docker persists it in `/data/edgeever-secrets.json`. The business logic is shared by Docker and Cloudflare.

Back up the root separately from the database. For rotation, retain the old dedicated root in `EDGE_EVER_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS`, or the old authentication root in `EDGE_EVER_AUTH_PASSWORD_FALLBACK`. Losing all matching keys prevents password display but leaves hash-based visitor verification working. Regeneration saves a fresh ciphertext under the current root and immediately invalidates the previous password and unlock cookies. A missing root prevents generation before any password is changed; there is no plaintext fallback.

Migration `0069` adds nullable ciphertext columns without rewriting existing hashes or links. Hash-only passwords remain valid but cannot be recovered from the server. Regenerate them once to enable viewing across devices. Browser caches from older clients are no longer used as the displayed password source. Form submission passwords are outside this change.

Apply the migration before deploying the new server. Rolling back application code while retaining the additive columns keeps hash-based access available. If an older server changes a password, regenerate it after upgrading again to refresh the ciphertext. Do not roll back by deleting hashes or restoring an older database snapshot.

Automated verification upgrades an existing hash-only notebook share in place, checks its old password and unlock cookie, then regenerates and reads the password from a fresh authenticated request. Route tests cover ciphertext storage, clearing, key rotation/loss, workspace isolation, API-token/anonymous rejection, and password-free listing responses. These checks do not constitute a production deployment or native device acceptance test.
