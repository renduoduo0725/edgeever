import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { MEMO_EDITOR_METADATA_ROW_CLASS_NAME, nextTitleStatusClearance } from "./MemoEditorChromeDensity.ts";

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
  test("keeps the title field ahead of notebook and tags on a compact desktop row", () => {
    expect(MEMO_EDITOR_METADATA_ROW_CLASS_NAME).toContain("min-w-0");
    expect(MEMO_EDITOR_METADATA_ROW_CLASS_NAME).toContain("shrink");
    expect(MEMO_EDITOR_METADATA_ROW_CLASS_NAME).not.toContain("shrink-0");
    expect(MEMO_EDITOR_METADATA_ROW_CLASS_NAME).not.toContain("max-w-[40%]");
    const leading = readFileSync(new URL("./MemoEditorTopRowLeading.tsx", import.meta.url), "utf8");
    expect(leading).toContain("basis-full");
    expect(leading).toContain("sm:min-w-[min(12rem,45%)]");
    expect(leading).toContain("sm:flex-1");
    const metadata = readFileSync(new URL("./MemoEditorMetadataRow.tsx", import.meta.url), "utf8");
    expect(metadata).toContain("min-w-0 max-w-[18rem] shrink");
    expect(metadata).toContain("[&>span]:truncate");
    expect(metadata).not.toContain("min-w-[9rem]");
    for (const file of ["EditorPane.tsx", "DiagramEditorPane.tsx", "InfographicEditorPane.tsx"]) {
      const source = readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
      expect(source).toContain("rowClassName={MEMO_EDITOR_METADATA_ROW_CLASS_NAME}");
      expect(source).not.toContain('className="min-w-0 flex-1"');
    }
  });
});
