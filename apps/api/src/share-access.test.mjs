import { describe, expect, test } from "bun:test";
import {
  createShareAccessCookieValue,
  isShareUnlockBlocked,
  isValidShareAccessCookieValue,
  nextShareUnlockFailure,
  SHARE_UNLOCK_MAX_ATTEMPTS,
} from "./share-access.ts";

describe("share access cookies", () => {
  test("accepts a cookie created for the same password hash and token", async () => {
    const value = await createShareAccessCookieValue("hash-a", "token-a", 1_000);
    expect(await isValidShareAccessCookieValue(value, "hash-a", "token-a", 1_000)).toBe(true);
    expect(await isValidShareAccessCookieValue(value, "hash-b", "token-a", 1_000)).toBe(false);
    expect(await isValidShareAccessCookieValue(value, "hash-a", "token-b", 1_000)).toBe(false);
  });

  test("rejects expired cookies", async () => {
    const value = await createShareAccessCookieValue("hash-a", "token-a", 1_000);
    expect(await isValidShareAccessCookieValue(value, "hash-a", "token-a", 8 * 24 * 60 * 60 * 1000)).toBe(false);
  });
});

describe("share unlock rate limit", () => {
  test("blocks after the allowed number of failures in a window", () => {
    let state = { unlock_failed_count: 0, unlock_window_started_at: null, unlock_blocked_until: null };
    const now = Date.parse("2026-09-17T00:00:00.000Z");
    for (let attempt = 1; attempt <= SHARE_UNLOCK_MAX_ATTEMPTS; attempt += 1) {
      const next = nextShareUnlockFailure(state, now);
      state = {
        unlock_failed_count: next.failureCount,
        unlock_window_started_at: next.windowStartedAt,
        unlock_blocked_until: next.blockedUntil,
      };
    }
    expect(state.unlock_failed_count).toBe(SHARE_UNLOCK_MAX_ATTEMPTS);
    expect(isShareUnlockBlocked(state.unlock_blocked_until, now + 1000)).toBe(true);
    expect(isShareUnlockBlocked(state.unlock_blocked_until, now + 16 * 60 * 1000)).toBe(false);
  });
});
