import { describe, expect, test } from "bun:test";
import { markdownToDoc } from "../../packages/shared/src/content.ts";
import { selectionNoteMarkdown, selectionNoteTitle, selectionTextMarkdown } from "./src/selection-clip.ts";

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
    expect(markdown.startsWith("保留的段落。\n\n\n\n第二段。")).toBe(true);
    expect(markdown).toContain("[https://example.com/a(b)](https://example.com/a%28b%29)");
    expect(markdown).toContain("抓取时间: 2026-09-27T00:00:00.000Z");
    expect(markdown).toContain("保留的段落。\n\n\n\n第二段。");
  });
});


test('frozen plain selection fallback preserves literal formatting, indentation, URLs and entities', () => {
  const values = [
    '![literal](https://example.test/a.png)\n\n# Text &copy; <img src=x>\n\n~~strike~~',
    'First\n====\n\n> quoted\n---',
    'Intro\n\n    const value = a * b;\n    if (value < 10) run();',
    '\t<img src=x> *literal*',
    '[title](https://example.test) https://example.test/a?x=1 www.example.test a@example.test',
    '&lt;literal&gt; &#32; $math$ **bold** `code`',
  ];
  for (const value of values) {
    const doc = markdownToDoc(selectionTextMarkdown(value)), nodes = [];
    const visit = (node) => { nodes.push(node); (node.content || []).forEach(visit); };
    visit(doc);
    expect(nodes.every((node) => ['doc', 'paragraph', 'text', 'hardBreak'].includes(node.type))).toBe(true);
    expect(nodes.filter((node) => node.type === 'text').map((node) => node.text).join('').replace(/\n/g, '')).toBe(value.replace(/\n/g, ''));
    expect(nodes.some((node) => node.marks?.length)).toBe(false);
  }
});
