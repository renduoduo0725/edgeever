import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const editorPaneSource = readFileSync(new URL("./EditorPane.tsx", import.meta.url), "utf8");
const diagramEditorPaneSource = readFileSync(new URL("./DiagramEditorPane.tsx", import.meta.url), "utf8");
const infographicEditorPaneSource = readFileSync(new URL("./InfographicEditorPane.tsx", import.meta.url), "utf8");
const topRowLeadingSource = readFileSync(new URL("./MemoEditorTopRowLeading.tsx", import.meta.url), "utf8");

const expectIconOnlyFocusModeEntry = (source) => {
  const normalizedSource = source.replace(/\s+/g, " ");
  expect(normalizedSource).toContain('size="icon"');
  expect(normalizedSource).toContain('variant={desktopFocusMode ? "soft" : "ghost"}');
  expect(normalizedSource).toContain("<IconTooltip label={focusModeLabel}>");
  expect(normalizedSource).not.toContain("<span>{focusModeLabel}</span>");
  expect(source).not.toContain('size="sm"\n                      variant="solid"');
};

describe("focus mode entry", () => {
  test("keeps an icon-only focus action with a tooltip in every desktop note editor", () => {
    expectIconOnlyFocusModeEntry(topRowLeadingSource);
    for (const source of [editorPaneSource, diagramEditorPaneSource]) {
      expect(source).toContain("<MemoEditorTopRowLeading");
      expect(source).toContain("desktopFocusMode={desktopFocusMode}");
      expect(source).toContain("onToggleDesktopFocusMode={onToggleDesktopFocusMode}");
    }
  });

  test("keeps status copy ahead of the action icons and leaves the updated time off the header", () => {
    expect(topRowLeadingSource).not.toContain("MemoEditorUpdatedLabel");
    for (const source of [editorPaneSource, diagramEditorPaneSource, infographicEditorPaneSource]) {
      const statusIndex = source.indexOf('ref={setHeaderStatusCluster}');
      const focusIndex = source.indexOf("<MemoEditorFocusModeButton");
      const headerActionsIndex = source.indexOf("<MemoEditorHeaderActions");
      expect(source).not.toContain("MemoEditorUpdatedLabel");
      expect(source).not.toContain("formatDateTime(memo.updatedAt)");
      expect(statusIndex).toBeGreaterThan(-1);
      expect(focusIndex).toBeGreaterThan(statusIndex);
      expect(headerActionsIndex).toBeGreaterThan(focusIndex);
      expect(source.indexOf("<MemoEditorTopRowLeading")).toBeGreaterThan(-1);
    }
  });
});
