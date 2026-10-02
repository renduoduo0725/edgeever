import { describe, expect, test } from "bun:test";
import {
  EDITOR_ARTICLE_ROW_GAP_PX,
  EDITOR_DESKTOP_READING_GUTTER_PX,
  EDITOR_PANE_TIGHT_PX,
  shouldCompactEditorReadingGutter,
} from "./editor-reading-gutter.ts";

const outlineBesideArticle = 300 + EDITOR_ARTICLE_ROW_GAP_PX;
const standardReading = 880;
const comfortableWithOutline =
  standardReading + outlineBesideArticle + EDITOR_DESKTOP_READING_GUTTER_PX * 2;

describe("editor reading gutter", () => {
  test("keeps the 6rem gutters when the assistant is closed", () => {
    expect(shouldCompactEditorReadingGutter({
      aiAssistantOpen: false,
      desktopColumn: true,
      columnWidth: 920,
      articleMaxWidth: standardReading,
      reservedBesideArticle: outlineBesideArticle,
    })).toBe(false);
  });

  test("compacts once an open assistant leaves no room for the article, outline, and 6rem gutters", () => {
    expect(comfortableWithOutline).toBe(1404);
    expect(EDITOR_PANE_TIGHT_PX).toBe(720);
    expect(shouldCompactEditorReadingGutter({
      aiAssistantOpen: true,
      desktopColumn: true,
      columnWidth: 920,
      articleMaxWidth: standardReading,
      reservedBesideArticle: outlineBesideArticle,
    })).toBe(true);
    expect(shouldCompactEditorReadingGutter({
      aiAssistantOpen: true,
      desktopColumn: true,
      columnWidth: comfortableWithOutline,
      articleMaxWidth: standardReading,
      reservedBesideArticle: outlineBesideArticle,
    })).toBe(false);
  });

  test("keeps the wide reading measure when that column still fits", () => {
    expect(shouldCompactEditorReadingGutter({
      aiAssistantOpen: true,
      desktopColumn: true,
      columnWidth: 1600,
      articleMaxWidth: 1040,
      reservedBesideArticle: outlineBesideArticle,
    })).toBe(false);
    expect(shouldCompactEditorReadingGutter({
      aiAssistantOpen: true,
      desktopColumn: true,
      columnWidth: 1563,
      articleMaxWidth: 1040,
      reservedBesideArticle: outlineBesideArticle,
    })).toBe(true);
  });

  test("leaves the narrower breakpoints and an unmeasured column alone", () => {
    expect(shouldCompactEditorReadingGutter({
      aiAssistantOpen: true,
      desktopColumn: false,
      columnWidth: 800,
      articleMaxWidth: standardReading,
      reservedBesideArticle: outlineBesideArticle,
    })).toBe(false);
    expect(shouldCompactEditorReadingGutter({
      aiAssistantOpen: true,
      desktopColumn: true,
      columnWidth: 0,
      articleMaxWidth: standardReading,
      reservedBesideArticle: outlineBesideArticle,
    })).toBe(false);
  });

  test("uses the 1400px focus row when deciding", () => {
    expect(shouldCompactEditorReadingGutter({
      aiAssistantOpen: true,
      desktopColumn: true,
      columnWidth: 1800,
      articleMaxWidth: 960,
      reservedBesideArticle: outlineBesideArticle,
      focusRow: true,
    })).toBe(true);
    expect(shouldCompactEditorReadingGutter({
      aiAssistantOpen: true,
      desktopColumn: true,
      columnWidth: 1800,
      articleMaxWidth: 960,
      reservedBesideArticle: 0,
      focusRow: true,
    })).toBe(false);
  });
});
