import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CompanionCreatedNoteLinks, missingCreatedNoteLinks } from "./CompanionCreatedNoteLinks.tsx";

const created = { id: "tool-1", name: "create_diagram_memo", status: "done", effects: [
  { kind: "created", memoId: "memo_abc", notebookId: "nb_inbox", title: "个人理财入门" },
] };

describe("created note links", () => {
  test("adds a real note link when the model reports only an ID", () => {
    expect(missingCreatedNoteLinks("已创建（ID：memo_abc）", [created])).toEqual([
      { memoId: "memo_abc", notebookId: "nb_inbox", title: "个人理财入门" },
    ]);
    const html = renderToStaticMarkup(createElement(CompanionCreatedNoteLinks, {
      response: "已创建（ID：memo_abc）", tools: [created], onOpenNote() {},
    }));
    expect(html).toContain('href="#memo=memo_abc"');
    expect(html).toContain("个人理财入门");
  });

  test("does not duplicate a note link already in the answer", () => {
    expect(missingCreatedNoteLinks("[个人理财入门](#memo=memo_abc)", [created])).toEqual([]);
    expect(missingCreatedNoteLinks("[note:memo_abc]", [created])).toEqual([]);
  });

  test("does not duplicate a created note linked through a legacy absolute URL", () => {
    const id = "memo_328cb20d4b4040edb3ecb24638abc2d5";
    const tool = { ...created, effects: [{ kind: "created", memoId: id, title: "流程图" }] };
    expect(missingCreatedNoteLinks(`[流程图](https://edgeever.ai/memo/${id})`, [tool])).toEqual([]);
  });

  test("ignores failed tools and links each successful creation once", () => {
    expect(missingCreatedNoteLinks("", [
      { ...created, status: "error" }, created, created,
    ])).toHaveLength(1);
  });
});
