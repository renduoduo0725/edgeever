import { describe, expect, test } from "bun:test";
import { sealCompanionProcess } from "@edgeever/shared";
import { describeCompanionTool, parseJsonArray } from "./companion-tool-receipts.ts";

describe("companion tool receipts", () => {
  test("maps writes to recoverable effects and reads to listed/read", () => {
    const previous = new Map([["memo_1", { revision: 3, title: "Draft" }]]);
    expect(describeCompanionTool("create_memo", {}, { memo: { id: "memo_2", title: "New", revision: 1, notebookId: "nb_1" } }))
      .toEqual([{ kind: "created", memoId: "memo_2", notebookId: "nb_1", title: "New", revision: 1 }]);
    expect(describeCompanionTool("update_memo", { memoId: "memo_1" }, { memo: { id: "memo_1", title: "Draft", revision: 4 } }, previous))
      .toMatchObject([{ kind: "updated", memoId: "memo_1", previousRevision: 3, revision: 4 }]);
    expect(describeCompanionTool("trash_memos", { memoIds: ["memo_1"] }, { applied: true }, previous))
      .toEqual([{ kind: "trashed", memoId: "memo_1", title: "Draft" }]);
    expect(describeCompanionTool("merge_memos", { memoIds: ["memo_1", "memo_2"] }, { memo: { id: "memo_3", title: "Merged", revision: 1 } }, previous))
      .toEqual([
        { kind: "merged", memoId: "memo_3", title: "Merged", revision: 1 },
        { kind: "trashed", memoId: "memo_1", title: "Draft" },
        { kind: "trashed", memoId: "memo_2" },
      ]);
    expect(describeCompanionTool("search_memos", { query: "idea" }, { memos: [{ id: "memo_1", title: "Draft" }] }))
      .toEqual([{ kind: "listed", memoId: "memo_1", title: "Draft" }]);
    expect(describeCompanionTool("get_memo", { memoId: "memo_1" }, { memo: { id: "memo_1", title: "Draft", revision: 3 } }))
      .toMatchObject([{ kind: "read", memoId: "memo_1" }]);
  });

  test("seals streamed narration into process and clears the answer bucket", () => {
    expect(sealCompanionProcess("", "Let me look.")).toEqual({ process: "Let me look.", response: "" });
    expect(sealCompanionProcess("Looked.", "Now drawing.")).toEqual({ process: "Looked.\n\nNow drawing.", response: "" });
  });
  test("invalid json becomes an empty list", () => {
    expect(parseJsonArray(undefined)).toEqual([]);
    expect(parseJsonArray("{")).toEqual([]);
    expect(parseJsonArray("[1,2]")).toEqual([1, 2]);
  });
});
