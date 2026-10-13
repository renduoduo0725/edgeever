import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  MEMO_EDITOR_METADATA_ROW_CLASS_NAME,
  MEMO_EDITOR_TOP_ROW_CLASS_NAME,
  nextTitleStatusClearance,
} from "./MemoEditorChromeDensity.ts";

describe("title status clearance", () => {
  test("pads the title until it clears the status cluster", () => {
    expect(nextTitleStatusClearance(0, 1750, 1680)).toBe(78);
    expect(nextTitleStatusClearance(78, 1672, 1680)).toBe(78);
  });

  test("drops clearance once the title already sits clear of the status", () => {
    expect(nextTitleStatusClearance(40, 1500, 1700)).toBe(0);
    expect(nextTitleStatusClearance(0, 1500, 1700)).toBe(0);
  });

  test("stops growing once the inset reaches the header cap", () => {
    expect(nextTitleStatusClearance(480, 2000, 1000)).toBe(480);
  });
});

describe("title row width", () => {
  test("keeps Smart Tag visible beside the compact tag selector", () => {
    const css = readFileSync(new URL("../styles/globals.css", import.meta.url), "utf8");
    const compactTags = css.slice(css.indexOf('[data-metadata-density="tags"]'), css.indexOf("/* On very narrow headers"));
    expect(compactTags).not.toContain(".edgeever-editor-tag-ai");
    expect(compactTags).toContain("min-width: 4rem");
    expect(compactTags).toContain("flex: 0 0 auto");
  });

  test("keeps the title field ahead of notebook and tags on a compact desktop row", () => {
    expect(MEMO_EDITOR_METADATA_ROW_CLASS_NAME).toContain("min-w-[7rem]");
    expect(MEMO_EDITOR_TOP_ROW_CLASS_NAME).toContain("sm:[container-type:inline-size]");
    expect(MEMO_EDITOR_METADATA_ROW_CLASS_NAME).not.toContain("[container-type:inline-size]");
    expect(MEMO_EDITOR_METADATA_ROW_CLASS_NAME).toContain("w-max");
    expect(MEMO_EDITOR_METADATA_ROW_CLASS_NAME).toContain("shrink-0");
    expect(MEMO_EDITOR_METADATA_ROW_CLASS_NAME).not.toContain("max-w-[40%]");
    const leading = readFileSync(new URL("./MemoEditorTopRowLeading.tsx", import.meta.url), "utf8");
    expect(leading).toContain("basis-full");
    expect(leading).toContain("min-w-0");
    expect(leading).toContain("sm:flex-1");
    const metadata = readFileSync(new URL("./MemoEditorMetadataRow.tsx", import.meta.url), "utf8");
    expect(metadata).toContain("edgeever-editor-notebook-select");
    expect(metadata).toContain("edgeever-editor-metadata-icon");
    expect(metadata).toContain("[&>span]:truncate");
    expect(metadata).toContain('<SelectTrigger aria-label={t("editor.currentNotebookAria"');
    expect(metadata).toContain('<IconTooltip label={t("editor.currentNotebookAria"');
    expect(metadata).not.toContain("min-w-[9rem]");
    const tagPicker = readFileSync(new URL("./EditorTagPicker.tsx", import.meta.url), "utf8");
    expect(tagPicker).toContain("edgeever-editor-tag-picker");
    expect(tagPicker).toContain("edgeever-editor-tag-trigger");
    expect(tagPicker).toContain('selectedTags.map((tag) => `#${tag}`).join(" · ")');
    const css = readFileSync(new URL("../styles/globals.css", import.meta.url), "utf8");
    expect(css).toContain('[data-metadata-density="tags"]');
    expect(css).toMatch(/@media \(min-width: 640px\) \{\s+\[data-metadata-density\]/);
    expect(MEMO_EDITOR_METADATA_ROW_CLASS_NAME).toContain("sm:flex-nowrap");
    expect(css).not.toContain("calc(23vw + var(--memo-list-width)");
    expect(css).toContain('[data-metadata-density="compact"]');
    expect(css).toContain(".edgeever-editor-notebook-select");
    expect(css).toContain(".edgeever-editor-tag-picker");
    for (const file of ["EditorPane.tsx", "DiagramEditorPane.tsx", "InfographicEditorPane.tsx"]) {
      const source = readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
      expect(source).toContain("rowClassName={MEMO_EDITOR_METADATA_ROW_CLASS_NAME}");
      expect(source).not.toContain('className="min-w-0 flex-1"');
    }
  });
});
