import { describe, expect, test } from "bun:test";
import { encryptSharePassword, readSharePassword } from "./share-password-encryption";

const env = { EDGE_EVER_CREDENTIALS_ENCRYPTION_KEY: "original-root" };
describe("recoverable share passwords", () => {
  test("encrypts with random IVs and binds each ciphertext to its share", async () => {
    const first = await encryptSharePassword("secret12", "token1", env);
    const second = await encryptSharePassword("secret12", "token1", env);
    expect(first).not.toContain("secret12");
    expect(first).not.toBe(second);
    expect(await readSharePassword(first, "token1", env)).toBe("secret12");
    expect(await readSharePassword(first, "token2", env)).toBeUndefined();
    expect(await readSharePassword(`${first}corrupt`, "token1", env)).toBeUndefined();
  });
  test("uses a previous key after rotation; missing keys never fall back to plaintext", async () => {
    const encrypted = await encryptSharePassword("secret12", "token", env);
    expect(await readSharePassword(encrypted, "token", {
      EDGE_EVER_CREDENTIALS_ENCRYPTION_KEY: "new-root",
      EDGE_EVER_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS: "original-root",
    })).toBe("secret12");
    expect(await readSharePassword(encrypted, "token", {})).toBeUndefined();
    expect(await readSharePassword(null, "token", env)).toBeUndefined();
    await expect(encryptSharePassword("secret12", "token", {})).rejects.toMatchObject({ code: "share_encryption_unavailable" });
  });
  test("supports existing deployment authentication secrets and their fallback", async () => {
    const encrypted = await encryptSharePassword("secret12", "token", { EDGE_EVER_AUTH_PASSWORD: "old-auth" });
    expect(await readSharePassword(encrypted, "token", {
      EDGE_EVER_AUTH_PASSWORD_HASH: "new-auth-hash",
      EDGE_EVER_AUTH_PASSWORD_FALLBACK: "old-auth",
    })).toBe("secret12");
  });
});
