import { describe, expect, test } from "bun:test";
import { ApiRequestError } from "@edgeever/client";
import { LocalDatabaseUnavailableError } from "@/lib/local-database-recovery";
import { MemoSaveRequestError } from "./editor-pane-helpers.ts";
import { classifyEditorSaveFailure, shouldLeaveEditorAfterSaveError } from "./editor-save-failure.ts";

const queuedPayload = {
  memoId: "memo-1",
  expectedRevision: 1,
  expectedContentHash: "base",
  editSessionId: "session-1",
  title: "Draft",
  contentJson: { type: "doc", content: [] },
  contentMarkdown: "hi",
  tags: [],
};

describe("classifyEditorSaveFailure", () => {
  test("treats local storage outages as a retryable storage failure", () => {
    expect(classifyEditorSaveFailure(new LocalDatabaseUnavailableError(new Error("idb")))).toEqual({
      kind: "storage",
    });
  });

  test("keeps revision conflicts visible instead of queueing them", () => {
    const error = new ApiRequestError("Conflict", 409, "revision_conflict", {
      expectedRevision: 3,
      currentRevision: 4,
    });
    expect(classifyEditorSaveFailure(error)).toEqual({
      kind: "conflict",
      conflict: {
        code: "revision_conflict",
        details: {
          expectedRevision: 3,
          currentRevision: 4,
          expectedContentHash: undefined,
          currentContentHash: undefined,
          source: undefined,
        },
      },
    });
    expect(shouldLeaveEditorAfterSaveError(error)).toBe(false);
  });

  test("queues network-like save failures so leaving the editor can proceed", () => {
    const error = new MemoSaveRequestError(new TypeError("Failed to fetch"), queuedPayload, "tag");
    expect(classifyEditorSaveFailure(error)).toMatchObject({
      kind: "queue",
      tagsText: "tag",
      payload: queuedPayload,
    });
    expect(shouldLeaveEditorAfterSaveError(error)).toBe(true);
  });

  test("falls back to a generic error for unknown failures", () => {
    expect(classifyEditorSaveFailure(new Error("boom"))).toEqual({ kind: "error" });
  });
});
