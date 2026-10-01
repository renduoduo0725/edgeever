import { describe, expect, test } from "bun:test";
import { sidebarCompanionFocus, sidebarLocalContextText } from "./ai-sidebar-context.ts";

const note = {
  memoId: "note-1",
  notebookId: "book-1",
  notebookTitle: "音乐",
  noteTitle: "QQ 音乐等级",
  contentMarkdown: "关于 QQ 音乐等级的长篇笔记",
};

describe("AI sidebar note context", () => {
  test("an independent request receives no current-note context", () => {
    expect(sidebarCompanionFocus(note, false)).toBeUndefined();
    expect(sidebarLocalContextText(note, false)).toBe("");
  });

  test("explicitly including the current note works for both assistant modes", () => {
    expect(sidebarCompanionFocus(note, true)).toEqual({
      memoId: "note-1",
      notebookId: "book-1",
      notebookTitle: "音乐",
      title: "QQ 音乐等级",
      contentMarkdown: "关于 QQ 音乐等级的长篇笔记",
    });
    expect(sidebarLocalContextText(note, true)).toContain("关于 QQ 音乐等级的长篇笔记");
  });

  test("an explicitly pinned selection is retained without the rest of the note", () => {
    const selected = { ...note, selectionMarkdown: "  需要解释的句子  " };
    expect(sidebarCompanionFocus(selected, false)).toEqual({ selectionMarkdown: "需要解释的句子" });
    expect(sidebarLocalContextText(selected, false)).toContain("需要解释的句子");
    expect(sidebarLocalContextText(selected, false)).not.toContain(note.contentMarkdown);
  });
});
