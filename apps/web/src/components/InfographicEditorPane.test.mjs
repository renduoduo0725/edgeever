import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./InfographicEditorPane.tsx", import.meta.url), "utf8");

describe("infographic editor header", () => {
  test("uses the shared note title row instead of a separate save and export bar", () => {
    const topRow = source.indexOf('cn(MEMO_EDITOR_TOP_ROW_CLASS_NAME, "border-b-0")');
    const metadata = source.indexOf("<MemoEditorMetadataRow");
    const status = source.indexOf("ref={setHeaderStatusCluster}");
    const headerEnd = source.indexOf("</header>");
    expect(topRow).toBeGreaterThan(-1);
    expect(metadata).toBeGreaterThan(topRow);
    expect(status).toBeGreaterThan(metadata);
    expect(headerEnd).toBeGreaterThan(status);
    expect(source).toContain("<MemoEditorHeaderActions");
    expect(source).toContain('t("infographic.exportSvg")');
    expect(source).toContain('t("infographic.exportPng")');
    expect(source).not.toContain("<PieChart");
    expect(source).not.toContain('t("infographic.save")');
    expect(source).toContain("parseTagsText(tagsRef.current)");
    expect(source).toContain("repository.moveMemos");
  });
});
