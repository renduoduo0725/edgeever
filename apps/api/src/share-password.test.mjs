import { describe, expect, test } from "bun:test";
import { generateSharePassword, SHARE_PASSWORD_ALPHABET, SHARE_PASSWORD_LENGTH } from "./share-password.ts";

describe("generateSharePassword", () => {
  test("returns an unambiguous password of the expected length", () => {
    const password = generateSharePassword();
    expect(password).toHaveLength(SHARE_PASSWORD_LENGTH);
    expect([...password].every((character) => SHARE_PASSWORD_ALPHABET.includes(character))).toBe(true);
  });

  test("does not repeat the same password across draws", () => {
    const passwords = new Set(Array.from({ length: 20 }, () => generateSharePassword()));
    expect(passwords.size).toBe(20);
  });
});
