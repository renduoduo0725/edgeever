import type { Bindings } from "./api-context";
import { verifyPassword } from "./auth-crypto";
import { AppError } from "./app-error";
import { decryptSecret, encryptSecret } from "./secret-encryption";

type Environment = Pick<Bindings,
  "EDGE_EVER_CREDENTIALS_ENCRYPTION_KEY" | "EDGE_EVER_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS" |
  "EDGE_EVER_AUTH_PASSWORD" | "EDGE_EVER_AUTH_PASSWORD_HASH" | "EDGE_EVER_AUTH_PASSWORD_FALLBACK">;

// Bind the ciphertext to its share, and separate it from AI/storage credentials.
const keys = (env: Environment, token: string) => [
  env.EDGE_EVER_CREDENTIALS_ENCRYPTION_KEY,
  env.EDGE_EVER_AUTH_PASSWORD,
  env.EDGE_EVER_AUTH_PASSWORD_HASH,
  env.EDGE_EVER_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS,
  env.EDGE_EVER_AUTH_PASSWORD_FALLBACK,
].flatMap((value) => value?.trim() ? [`edgeever:share-password:v1:${token}:${value.trim()}`] : []);

export const encryptSharePassword = async (password: string, token: string, env: Environment) => {
  const key = keys({ ...env, EDGE_EVER_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS: undefined,
    EDGE_EVER_AUTH_PASSWORD_FALLBACK: undefined }, token)[0];
  if (!key) throw new AppError("share_encryption_unavailable", "Configure a deployment credential encryption key before generating a share password.", 503);
  return encryptSecret(password, key);
};

export const readSharePassword = async (encrypted: string | null | undefined, token: string, env: Environment, passwordHash?: string) => {
  if (!encrypted) return undefined;
  for (const key of keys(env, token)) {
    try {
      const password = await decryptSecret(encrypted, key);
      // Older servers can rotate the hash without clearing this additive column.
      return !passwordHash || await verifyPassword(password, passwordHash) ? password : undefined;
    } catch {
      // A lost/rotated key must not break an existing share's hash verification.
    }
  }
  return undefined;
};
