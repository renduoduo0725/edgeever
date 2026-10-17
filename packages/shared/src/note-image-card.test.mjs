import { describe, expect, test } from "bun:test";
import {
  NOTE_IMAGE_THEME_OPTIONS, NOTE_IMAGE_THEMES, NOTE_IMAGE_BACKGROUND_COLORS, NOTE_IMAGE_FONT_FAMILIES,
  resolveTheme, resolveNoteImageTypography, buildImageExportBasename, buildNoteImageCardMarkup,
  estimateReadingStats, generateCardCss,
} from "./note-image-card";
import { zhCN } from "./i18n/zh-CN";
import { enUS } from "./i18n/en-US";
import { ja } from "./i18n/ja";
import { pl } from "./i18n/pl";

describe("note image templates", () => {
  test("every selectable template is localized and has renderable colors", () => {
    for (const theme of NOTE_IMAGE_THEME_OPTIONS) {
      expect(NOTE_IMAGE_THEMES[theme]).toBeDefined();
      expect(NOTE_IMAGE_BACKGROUND_COLORS[theme]).toMatch(/^#[\da-f]{6}$/i);
      for (const locale of [zhCN, enUS, ja, pl]) expect(locale.editor.imageShare.themes[theme]).toBeTruthy();
    }
    for (const retired of ["paper", "press", "highlight", "slate", "mint", "aurora", "sunset", "terminal"]) {
      expect(NOTE_IMAGE_THEME_OPTIONS).not.toContain(retired);
    }
  });

  test("old export settings resolve to supported templates through either input", () => {
    const mapping = {
      paper: "handwritten", press: "book", highlight: "memo", slate: "frame", mint: "quote",
      aurora: "gradient", sunset: "glass", terminal: "code", midnight: "black-sun", editorial: "frame",
      film: "book", lavender: "glass", notepad: "memo", xuan: "handwritten", polaroid: "frame", warm: "glass",
    };
    for (const [old, active] of Object.entries(mapping)) {
      expect(resolveTheme(old)).toBe(active);
      expect(resolveTheme(undefined, old)).toBe(active);
      expect(buildNoteImageCardMarkup({ title: "Note", bodyHtml: "<p>Text</p>", theme: old })).toContain(`data-theme="${active}"`);
    }
    expect(resolveTheme()).toBe("gradient");
    expect(resolveTheme("book", "missing")).toBe("book");
    expect(resolveTheme("__proto__", "constructor")).toBe("gradient");
  });

  test("explicit fonts override both heading and body for every template", () => {
    expect(resolveNoteImageTypography("book").bodyFamily).toContain("SourceHanSerifCN_SemiBold");
    expect(resolveNoteImageTypography("handwritten").bodyFamily).toContain("Long Cang");
    expect(resolveNoteImageTypography("code").bodyFamily).toContain("Geist Mono Variable");
    for (const theme of NOTE_IMAGE_THEME_OPTIONS) for (const font of ["sans", "serif", "kai", "mono"]) {
      const typography = resolveNoteImageTypography(theme, font);
      expect(typography.bodyFamily).toBe(NOTE_IMAGE_FONT_FAMILIES[font]);
      expect(typography.headingFamily).toBe(NOTE_IMAGE_FONT_FAMILIES[font]);
    }
  });

  test("unselected metadata stays private in all decorations", () => {
    for (const theme of NOTE_IMAGE_THEME_OPTIONS) {
      const markup = buildNoteImageCardMarkup({
        theme, title: "Private title", notebook: "Private notebook", author: "Private author", tags: ["Private tag"],
        updatedAt: "Private date", bodyHtml: "<p>Public body</p>", showUpdatedAt: false, showBranding: false,
      });
      for (const hidden of ["Private title", "Private notebook", "Private author", "Private tag", "Private date", "EdgeEver"]) expect(markup).not.toContain(hidden);
      expect(markup).toContain("<p>Public body</p>");
    }
  });

  test("escapes enabled metadata while preserving prepared rich text", () => {
    const markup = buildNoteImageCardMarkup({
      theme: "frame", title: '<img src=x onerror="x">', notebook: "A&B", tags: ["<tag>"],
      author: "<author>", updatedAt: "<date>", bodyHtml: '<p><strong>Kept</strong></p><img src="data:image/png;base64,AA==">',
      showTitle: true, showNotebook: true, showTags: true, showAuthor: true,
    });
    expect(markup).not.toContain('<img src=x');
    expect(markup).toContain("&lt;img");
    expect(markup).toContain("A&amp;B");
    expect(markup).toContain("#&lt;tag&gt;");
    expect(markup).toContain("&lt;author&gt;");
    expect(markup).toContain("&lt;date&gt;");
    expect(markup).toContain('<p><strong>Kept</strong></p><img src="data:image/png;base64,AA==">');
  });

  test("code window respects the title and notebook visibility switches", () => {
    const hidden = buildNoteImageCardMarkup({ theme: "code", title: "Secret", notebook: "Hidden", bodyHtml: "" });
    expect(hidden).toContain("note.md");
    expect(hidden).not.toContain("Secret");
    expect(hidden).not.toContain("Hidden");
    const shown = buildNoteImageCardMarkup({ theme: "code", title: "Visible", bodyHtml: "", showTitle: true });
    expect(shown.match(/Visible/g)).toHaveLength(1);
    const mono = buildNoteImageCardMarkup({ theme: "book", title: "Note", bodyHtml: "", fontStyle: "mono" });
    expect(mono).not.toContain("edgeever-terminal-header");
  });

  test("an empty author does not create an empty footer when branding is hidden", () => {
    const markup = buildNoteImageCardMarkup({ title: "Note", bodyHtml: "", author: "  ", showAuthor: true, showBranding: false });
    expect(markup).not.toContain("edgeever-card-footer");
  });

  test("export styles stay scoped and do not depend on viewport height", () => {
    for (const theme of NOTE_IMAGE_THEME_OPTIONS) {
      const css = generateCardCss({ theme, fontStyle: "auto", fontSize: "lg", cardWidth: "compact" });
      expect(css).not.toContain(":root");
      expect(css).not.toMatch(/(?:^|\n)\s*\*\s*\{/);
      expect(css).not.toMatch(/\d+vh/);
      expect(css).not.toMatch(/url\(["']?https?:\/\//);
    }
  });

  test("keeps mixed-language reading statistics and portable filenames", () => {
    const stats = estimateReadingStats("<p>中文阅读与 English words.</p>");
    expect(stats.totalCount).toBe(7);
    expect(stats.minutes).toBe(1);
    expect(buildImageExportBasename(" Roadmap: Q3/Q4. ", "Untitled")).toBe("Roadmap- Q3-Q4");
    expect(buildImageExportBasename("CON", "Untitled")).toBe("_CON");
    expect(buildImageExportBasename("   ", "Untitled")).toBe("Untitled");
  });
});
