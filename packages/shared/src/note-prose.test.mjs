import { describe, expect, test } from "bun:test";
import {
  MAX_NOTE_PROSE_CSS_BYTES,
  NoteProseUpdateSchema,
  noteProseCodeFontSize,
  noteProseMigrationPatch,
  paletteForLegacyEditorTheme,
  parseNoteProsePalette,
  resolveNoteProse,
  DEFAULT_NOTE_PROSE_CSS,
  noteProseCssDropsDeclarations,
  sanitizeNoteProseCss,
} from "@edgeever/shared";

const emptyAccount = () => ({
  fontSize: null,
  lineHeight: null,
  palette: null,
  customCss: null,
  customColors: null,
});

describe("note prose", () => {
  test("maps retired editor themes onto color names and leaves the native theme unset", () => {
    expect(paletteForLegacyEditorTheme("stance")).toBe("clay");
    expect(paletteForLegacyEditorTheme("stub")).toBe("dawn");
    expect(paletteForLegacyEditorTheme("letter")).toBe("dawn");
    expect(paletteForLegacyEditorTheme("grove")).toBeNull();
    expect(paletteForLegacyEditorTheme("minimal-emerald")).toBeNull();
    expect(paletteForLegacyEditorTheme("outline-emerald")).toBeNull();
    expect(paletteForLegacyEditorTheme("wechat-green")).toBeNull();
    expect(paletteForLegacyEditorTheme("modern-mint")).toBeNull();
    expect(parseNoteProsePalette("emerald")).toBe("native");
    expect(parseNoteProsePalette("green")).toBe("native");
    expect(NoteProseUpdateSchema.safeParse({ palette: "green" }).success).toBe(false);
    expect(parseNoteProsePalette("plum")).toBe("native");
    expect(NoteProseUpdateSchema.safeParse({ palette: "plum" }).success).toBe(false);
    expect(resolveNoteProse({ palette: "emerald" }).palette).toBe("native");
    expect(paletteForLegacyEditorTheme("brief")).toBe("teal");
    expect(paletteForLegacyEditorTheme("zen")).toBe("teal");
    expect(paletteForLegacyEditorTheme("guide")).toBe("azure");
    expect(paletteForLegacyEditorTheme("blueprint")).toBe("azure");
    expect(paletteForLegacyEditorTheme("outline")).toBe("violet");
    expect(paletteForLegacyEditorTheme("journal")).toBe("slate");
    expect(paletteForLegacyEditorTheme("default")).toBeNull();
    expect(paletteForLegacyEditorTheme("marxico")).toBeNull();
    expect(paletteForLegacyEditorTheme("custom-default")).toBeNull();
    expect(parseNoteProsePalette("custom")).toBe("native");
    expect(resolveNoteProse({ palette: "custom" }).palette).toBe("native");
    expect(paletteForLegacyEditorTheme("not-a-theme")).toBeNull();
  });

  test("steps code one preset below the body size", () => {
    expect(noteProseCodeFontSize(14)).toBe(12);
    expect(noteProseCodeFontSize(16)).toBe(14);
    expect(noteProseCodeFontSize(18)).toBe(16);
    expect(noteProseCodeFontSize(20)).toBe(18);
  });

  test("drops font size, line height, and urls from account CSS", () => {
    const css = sanitizeNoteProseCss("p { color: red; font-size: 40px; line-height: 3; margin: 1em 0; background: url(https://evil.test/a.png); } @import 'x';");
    expect(css).toContain("color: red");
    expect(css).toContain("margin: 1em 0");
    expect(css).not.toContain("font-size");
    expect(css).not.toContain("line-height");
    expect(css).not.toContain("url(");
    expect(css).not.toContain("@import");
  });

  test("fills only account fields that were never set", () => {
    expect(noteProseMigrationPatch(emptyAccount(), {
      palette: "teal",
      customCss: "p { color: red; }",
      customColors: null,
    })).toEqual({
      palette: "teal",
      customCss: "p { color: red; }",
    });

    expect(noteProseMigrationPatch({
      ...emptyAccount(),
      palette: "native",
      customCss: "",
    }, {
      palette: "clay",
      customCss: "h1 { letter-spacing: 0.04em; }",
      customColors: null,
    })).toEqual({});

    expect(noteProseMigrationPatch(emptyAccount(), {
      palette: "custom",
      customCss: "   ",
      customColors: null,
    })).toEqual({});
  });

  test("ships a light and dark starter sheet without font size or line height", () => {
    expect(DEFAULT_NOTE_PROSE_CSS).toContain("/* 正文。text-indent 是首行缩进，margin-bottom 是段距。 */");
    expect(DEFAULT_NOTE_PROSE_CSS).toContain("text-indent: 0;");
    expect(DEFAULT_NOTE_PROSE_CSS).toContain("/* 深色 · 标题 */");
    expect(DEFAULT_NOTE_PROSE_CSS).toContain("color: #212121;");
    expect(DEFAULT_NOTE_PROSE_CSS).toContain("color: #dee3e0;");
    expect(DEFAULT_NOTE_PROSE_CSS).not.toContain("font-size");
    expect(DEFAULT_NOTE_PROSE_CSS).not.toContain("line-height");
    const sanitized = sanitizeNoteProseCss(DEFAULT_NOTE_PROSE_CSS);
    expect(sanitized).toContain(":root.dark p");
    expect(sanitized).toContain("color: #dee3e0");
    expect(DEFAULT_NOTE_PROSE_CSS.indexOf(":root.dark p")).toBeGreaterThan(DEFAULT_NOTE_PROSE_CSS.indexOf("p {"));
    expect(DEFAULT_NOTE_PROSE_CSS.indexOf(":root.dark p")).toBeLessThan(DEFAULT_NOTE_PROSE_CSS.indexOf("/* 一级标题 */"));
    expect(DEFAULT_NOTE_PROSE_CSS.indexOf(":root.dark a")).toBeGreaterThan(DEFAULT_NOTE_PROSE_CSS.indexOf("\na {"));
    expect(DEFAULT_NOTE_PROSE_CSS.indexOf(":root.dark a")).toBeLessThan(DEFAULT_NOTE_PROSE_CSS.indexOf("/* 粗体 */"));
    expect(noteProseCssDropsDeclarations(DEFAULT_NOTE_PROSE_CSS)).toBe(false);
    expect(noteProseCssDropsDeclarations("p { color: red; }")).toBe(false);
    expect(noteProseCssDropsDeclarations("p { font-size: 18px; color: red; }")).toBe(true);
    expect(noteProseCssDropsDeclarations("p { line-height: 2; }")).toBe(true);
    expect(noteProseCssDropsDeclarations("p { color: red; } /* font-size: 1px */")).toBe(false);
    expect(noteProseCssDropsDeclarations('@import "x.css"; p { color: red; }')).toBe(true);
    expect(new TextEncoder().encode(DEFAULT_NOTE_PROSE_CSS).byteLength).toBeLessThan(MAX_NOTE_PROSE_CSS_BYTES);
  });

  test("rejects a stylesheet larger than 8 KB", () => {
    expect(NoteProseUpdateSchema.safeParse({
      customCss: "p { color: red; }",
    }).success).toBe(true);
    expect(NoteProseUpdateSchema.safeParse({
      customCss: "a".repeat(MAX_NOTE_PROSE_CSS_BYTES + 1),
    }).success).toBe(false);
    expect(NoteProseUpdateSchema.safeParse({}).success).toBe(false);
    expect(MAX_NOTE_PROSE_CSS_BYTES).toBe(8192);
  });
});
