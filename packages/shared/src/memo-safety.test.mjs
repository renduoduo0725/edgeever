import { describe, expect, test } from "bun:test";
import {
  getMemoSaveErrorReasonKey,
  isMemoEditBindingValid,
  isSuspiciousMemoOverwrite,
  SUSPICIOUS_MEMO_OVERWRITE_MESSAGE,
} from "./memo-safety.ts";

describe("isSuspiciousMemoOverwrite", () => {
  test("blocks the production incident shape", () => {
    expect(
      isSuspiciousMemoOverwrite(
        "英国 giffgaff 卡激活",
        "原".repeat(550),
        "号商 松松 GPT 菲区",
        "错".repeat(70)
      )
    ).toBe(true);
  });

  test("allows image-width-only saves", () => {
    expect(
      isSuspiciousMemoOverwrite("同一标题", "正文".repeat(300), "同一标题", "正文".repeat(300))
    ).toBe(false);
  });

  test("allows a title rename when content remains intact", () => {
    expect(
      isSuspiciousMemoOverwrite("旧标题", "正文".repeat(300), "新标题", "正文".repeat(290))
    ).toBe(false);
  });

  test("does not interfere with short notes", () => {
    expect(isSuspiciousMemoOverwrite("旧标题", "短内容", "新标题", "")).toBe(false);
  });
});

describe("isMemoEditBindingValid", () => {
  const current = { memoId: "memo_a", revision: 7, contentHash: "a".repeat(64) };
  const session = {
    id: "edit_1",
    memoId: "memo_a",
    baseRevision: 7,
    baseContentHash: "a".repeat(64),
  };
  const request = {
    editSessionId: "edit_1",
    memoId: "memo_a",
    expectedRevision: 7,
    expectedContentHash: "a".repeat(64),
  };

  test("accepts a fully bound save", () => {
    expect(isMemoEditBindingValid(current, session, request)).toBe(true);
  });

  test("rejects a session from another memo", () => {
    expect(isMemoEditBindingValid(current, { ...session, memoId: "memo_b" }, request)).toBe(false);
  });

  test("rejects a stale revision", () => {
    expect(isMemoEditBindingValid(current, session, { ...request, expectedRevision: 6 })).toBe(false);
  });

  test("rejects a stale content hash", () => {
    expect(isMemoEditBindingValid(current, session, { ...request, expectedContentHash: "b".repeat(64) })).toBe(false);
  });

  test("rejects a different edit-session id", () => {
    expect(isMemoEditBindingValid(current, session, { ...request, editSessionId: "edit_2" })).toBe(false);
  });
});

describe("getMemoSaveErrorReasonKey", () => {
  test("maps the suspicious overwrite rejection by code or by its server message", () => {
    const key = "editor.saveState.errorReason.suspiciousOverwrite";
    expect(getMemoSaveErrorReasonKey("suspicious_memo_overwrite")).toBe(key);
    expect(getMemoSaveErrorReasonKey(null, ` ${SUSPICIOUS_MEMO_OVERWRITE_MESSAGE} `)).toBe(key);
  });

  test("leaves other errors to their original message", () => {
    expect(getMemoSaveErrorReasonKey("memo_not_found", "Memo not found")).toBeNull();
    expect(getMemoSaveErrorReasonKey(null, null)).toBeNull();
  });
});
