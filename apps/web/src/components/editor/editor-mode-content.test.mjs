import { describe, expect, test } from "bun:test";
import { docToMarkdown, markdownToDoc } from "@edgeever/shared";
import {
  analyzeMarkdownModeContent,
  createMarkdownModeSnapshot,
  docToEditableMarkdown,
  isMarkdownSourceUnchanged,
  resolveMarkdownModeContent,
  selectMarkdownSourceForDocument,
  shouldKeepLiveMarkdownSource,
} from "./editor-mode-content.ts";

const tableTaskListDocument = {
  type: "doc",
  content: [{
    type: "table",
    content: [
      {
        type: "tableRow",
        content: [{
          type: "tableHeader",
          content: [{ type: "paragraph", content: [{ type: "text", text: "事项" }] }],
        }],
      },
      {
        type: "tableRow",
        content: [{
          type: "tableCell",
          content: [{
            type: "taskList",
            content: [{
              type: "taskItem",
              attrs: { checked: false },
              content: [{ type: "paragraph", content: [{ type: "text", text: "待办" }] }],
            }],
          }],
        }],
      },
    ],
  }],
};

describe("Markdown editor mode content preservation", () => {
  test("shows literal brackets and ampersands when they remain plain text", () => {
    const content = markdownToDoc("Alpha [ ] & Bravo");

    expect(docToMarkdown(content)).toBe("Alpha \\[ \\] &amp; Bravo");
    expect(docToEditableMarkdown(content)).toBe("Alpha [ ] & Bravo");
    expect(markdownToDoc(docToEditableMarkdown(content))).toEqual(content);
  });

  test("keeps escapes when removing them would create a link or change literal entities", () => {
    const content = markdownToDoc("Literal \\[link\\](https://example.com) and &amp;amp;");
    const canonical = docToMarkdown(content);

    expect(docToEditableMarkdown(content)).toBe(canonical);
  });

  test("retains the stored source of an older note until its rich content changes", () => {
    const storedSource = "Alpha \\[ \\] &amp; Bravo";
    const content = markdownToDoc(storedSource);
    const snapshot = createMarkdownModeSnapshot("memo-1", content, storedSource);
    const changedContent = markdownToDoc("Alpha [ ] & Bravo updated");

    expect(selectMarkdownSourceForDocument(snapshot, "memo-1", content, docToEditableMarkdown(content))).toBe(storedSource);
    expect(selectMarkdownSourceForDocument(
      snapshot,
      "memo-1",
      changedContent,
      docToEditableMarkdown(changedContent),
    )).toBe("Alpha [ ] & Bravo updated");
  });

  test("preserves rich-only table task lists when source was only viewed", () => {
    const snapshot = createMarkdownModeSnapshot("memo-1", tableTaskListDocument);
    const restored = resolveMarkdownModeContent(snapshot, "memo-1", snapshot.markdownSource);

    expect(isMarkdownSourceUnchanged(snapshot, "memo-1", snapshot.markdownSource)).toBe(true);
    expect(restored).toEqual(tableTaskListDocument);
    expect(restored.content[0].content[1].content[0].content[0].type).toBe("taskList");
  });

  test("treats equivalent line endings as an unchanged source projection", () => {
    const snapshot = createMarkdownModeSnapshot("memo-1", tableTaskListDocument);
    const windowsSource = snapshot.markdownSource.replaceAll("\n", "\r\n");

    expect(isMarkdownSourceUnchanged(snapshot, "memo-1", windowsSource)).toBe(true);
    expect(resolveMarkdownModeContent(snapshot, "memo-1", windowsSource)).toEqual(tableTaskListDocument);
  });

  test("preserves a rich table cell when content outside the table changes", () => {
    const snapshot = createMarkdownModeSnapshot("memo-1", tableTaskListDocument);
    const changedSource = `${snapshot.markdownSource}\n\n新增段落`;
    const resolved = resolveMarkdownModeContent(snapshot, "memo-1", changedSource);

    expect(isMarkdownSourceUnchanged(snapshot, "memo-1", changedSource)).toBe(false);
    expect(resolved.content[0].content[1].content[0].content[0].type).toBe("taskList");
    expect(docToMarkdown(resolved)).toContain("新增段落");
  });

  test("preserves a rich table task item when its source text changes", () => {
    const snapshot = createMarkdownModeSnapshot("memo-1", tableTaskListDocument);
    const changedSource = snapshot.markdownSource.replace("待办", "待办 updated");
    const result = analyzeMarkdownModeContent(snapshot, "memo-1", changedSource);

    expect(result.hasUnsafeRichTableEdit).toBe(false);
    expect(docToMarkdown(result.contentJson)).toContain("updated");
    expect(result.contentJson.content[0].content[1].content[0].content[0].type).toBe("taskList");
    expect(result.contentJson.content[0].content[1].content[0].content[0].content[0].attrs.checked).toBe(false);
  });

  test("updates a rich table task item when its Markdown checkbox is toggled", () => {
    const snapshot = createMarkdownModeSnapshot("memo-1", tableTaskListDocument);
    const changedSource = snapshot.markdownSource.replace("- [ ] 待办", "- [x] 待办");
    const result = analyzeMarkdownModeContent(snapshot, "memo-1", changedSource);

    expect(result.hasUnsafeRichTableEdit).toBe(false);
    expect(result.contentJson.content[0].content[1].content[0].content[0].content[0].attrs.checked).toBe(true);
  });

  test("flags table shape changes rather than silently discarding a rich cell", () => {
    const snapshot = createMarkdownModeSnapshot("memo-1", tableTaskListDocument);
    const changedSource = snapshot.markdownSource.replace("| - [ ] 待办 |", "");

    expect(analyzeMarkdownModeContent(snapshot, "memo-1", changedSource).hasUnsafeRichTableEdit).toBe(true);
  });

  test("never reuses a snapshot belonging to another memo", () => {
    const snapshot = createMarkdownModeSnapshot("memo-1", tableTaskListDocument);
    const resolved = resolveMarkdownModeContent(snapshot, "memo-2", snapshot.markdownSource);

    expect(isMarkdownSourceUnchanged(snapshot, "memo-2", snapshot.markdownSource)).toBe(false);
    expect(resolved).not.toEqual(tableTaskListDocument);
  });

  test("keeps extra blank lines that a JSON roundtrip would rewrite", () => {
    const live = "时代公馆\n\n\n*提示：表格*";
    const content = markdownToDoc(live);
    const incomingMarkdown = docToMarkdown(content);
    const snapshot = createMarkdownModeSnapshot("memo-1", content, live);

    expect(incomingMarkdown).not.toBe(live);
    expect(shouldKeepLiveMarkdownSource({
      snapshot,
      memoId: "memo-1",
      liveMarkdownSource: live,
      incomingMarkdown,
      incomingContent: content,
    })).toBe(true);
    expect(selectMarkdownSourceForDocument(snapshot, "memo-1", content, incomingMarkdown)).toBe(live);
  });

  test("restores the exact markdown source when switching back to an unedited rich document", () => {
    const live = "LINE_A\n\n\nLINE_B";
    const content = markdownToDoc(live);
    const snapshot = createMarkdownModeSnapshot("memo-1", content, live);

    expect(selectMarkdownSourceForDocument(
      snapshot,
      "memo-1",
      JSON.parse(JSON.stringify(content)),
      docToMarkdown(content),
    )).toBe(live);
  });

  test("replaces the live markdown buffer when incoming content actually changed", () => {
    const live = "时代公馆\n\n\n*提示：表格*";
    const snapshot = createMarkdownModeSnapshot("memo-1", markdownToDoc(live), live);
    const incomingMarkdown = "另一段内容";
    const incomingContent = markdownToDoc(incomingMarkdown);

    expect(shouldKeepLiveMarkdownSource({
      snapshot,
      memoId: "memo-1",
      liveMarkdownSource: live,
      incomingMarkdown,
      incomingContent,
    })).toBe(false);
  });

  test("does not keep a live buffer that belongs to another memo", () => {
    const live = "时代公馆\n\n\n*提示：表格*";
    const content = markdownToDoc(live);
    const snapshot = createMarkdownModeSnapshot("memo-1", content, live);

    expect(shouldKeepLiveMarkdownSource({
      snapshot,
      memoId: "memo-2",
      liveMarkdownSource: live,
      incomingMarkdown: docToMarkdown(content),
      incomingContent: content,
    })).toBe(false);
  });
});
