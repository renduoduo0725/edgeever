export const SHARE_PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
export const SHARE_PASSWORD_LENGTH = 8;

/** Unguessable enough for a second factor on an already-secret link, short enough to copy or read aloud. */
export const generateSharePassword = (): string => {
  const result: string[] = [];
  while (result.length < SHARE_PASSWORD_LENGTH) {
    const bytes = crypto.getRandomValues(new Uint8Array(SHARE_PASSWORD_LENGTH * 2));
    const maxUnbiased = Math.floor(256 / SHARE_PASSWORD_ALPHABET.length) * SHARE_PASSWORD_ALPHABET.length;
    for (const byte of bytes) {
      if (byte >= maxUnbiased) continue;
      result.push(SHARE_PASSWORD_ALPHABET[byte % SHARE_PASSWORD_ALPHABET.length]!);
      if (result.length === SHARE_PASSWORD_LENGTH) break;
    }
  }
  return result.join("");
};
