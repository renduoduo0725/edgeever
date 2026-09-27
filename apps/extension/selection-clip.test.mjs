import { describe, expect, test } from "bun:test";
import { selectionNoteMarkdown, selectionNoteTitle } from "./src/selection-clip.ts";

describe("selection note", () => {
  test("uses the selected passage as the title and keeps the page as a fallback", () => {
    expect(selectionNoteTitle("第一句。\n后面还有", "文章标题", "选中文字")).toBe("第一句。 后面还有");
    expect(selectionNoteTitle("   ", "文章标题", "选中文字")).toBe("文章标题");
    expect(selectionNoteTitle("", "", "选中文字")).toBe("选中文字");
    expect(selectionNoteTitle("字".repeat(100), "", "选中文字")).toHaveLength(80);
  });

  test("saves the passage and a source link without the rest of the page", () => {
    const markdown = selectionNoteMarkdown({
      markdown: "保留的段落。\n\n\n\n第二段。",
      pageUrl: "https://example.com/a(b)",
      capturedAt: "2026-09-27T00:00:00.000Z",
      sourceLabel: "来源",
      capturedAtLabel: "抓取时间",
    });
    expect(markdown.startsWith("保留的段落。\n\n第二段。")).toBe(true);
    expect(markdown).toContain("[https://example.com/a(b)](https://example.com/a%28b%29)");
    expect(markdown).toContain("抓取时间: 2026-09-27T00:00:00.000Z");
    expect(markdown).not.toContain("\n\n\n");
  });
});
