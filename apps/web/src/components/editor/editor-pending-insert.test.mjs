import { describe, expect, test } from "bun:test";
import {
  pendingEditorInsertMatchesMemo,
  shouldInsertPendingEditorFiles,
  usablePendingInsertFiles,
} from "./editor-pending-insert.ts";

const file = (size) => ({ size });

describe("pending editor screenshot insert", () => {
  test("matches a remapped memo id through aliases", () => {
    expect(pendingEditorInsertMatchesMemo(
      { memoId: "local_memo", files: [file(12)] },
      "memo_remote",
      new Set(["local_memo", "memo_remote"]),
    )).toBe(true);
    expect(pendingEditorInsertMatchesMemo(
      { memoId: "local_memo", files: [file(12)] },
      "memo_other",
      new Set(["memo_other"]),
    )).toBe(false);
  });

  test("waits until the editor is hydrated for the new memo", () => {
    const pendingInsertFiles = { memoId: "memo_1", files: [file(24)] };
    expect(shouldInsertPendingEditorFiles({
      pendingInsertFiles,
      memoId: "memo_1",
      editorHydratedForMemo: false,
      editorReady: true,
      readOnly: false,
    })).toBe(false);
    expect(shouldInsertPendingEditorFiles({
      pendingInsertFiles,
      memoId: "memo_1",
      editorHydratedForMemo: true,
      editorReady: true,
      readOnly: false,
    })).toBe(true);
  });

  test("ignores empty screenshot files instead of inserting a blank image", () => {
    const pendingInsertFiles = { memoId: "memo_1", files: [file(0)] };
    expect(usablePendingInsertFiles(pendingInsertFiles)).toEqual([]);
    expect(shouldInsertPendingEditorFiles({
      pendingInsertFiles,
      memoId: "memo_1",
      editorHydratedForMemo: true,
      editorReady: true,
      readOnly: false,
    })).toBe(false);
  });
});
