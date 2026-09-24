import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

describe("editor body font preference", () => {
  test("is chosen from settings and offers the bundled faces", () => {
    const preferenceCard = readFileSync(new URL("./PreferenceCard.tsx", import.meta.url), "utf8");
    const editorFonts = readFileSync(new URL("../../styles/editor-body-fonts.css", import.meta.url), "utf8");
    const fontFaces = readFileSync(new URL("../../lib/editor-body-font-faces.ts", import.meta.url), "utf8");

    expect(preferenceCard).toContain('t("settings.editorBodyFontTitle")');
    expect(preferenceCard).toContain('value="wenkai"');
    expect(preferenceCard).toContain('value="source-han-serif"');
    expect(preferenceCard).toContain('value="custom"');
    expect(fontFaces).toContain('fontFace("EdgeEver Kai"');
    expect(fontFaces).toContain('fontFace("EdgeEver Fangsong"');
    expect(fontFaces).toContain('fontFace("EdgeEver Zhi Song"');
    expect(fontFaces).toContain('fontFace("EdgeEver Song"');
    expect(fontFaces).toContain("kai.woff2?url");
    expect(fontFaces).toContain("fangsong.woff2?url");
    expect(fontFaces).toContain("zhi-song.woff2?url");
    expect(preferenceCard).toContain('t("settings.uiFontTitle")');
    expect(preferenceCard).toContain("applyUiFontPreference");
    expect(preferenceCard).toContain("getFontChoicePreviewStack");
    expect(preferenceCard).toContain("BookOpenText");
    expect(preferenceCard).toContain("AppWindow");
    expect(preferenceCard).toContain("CUSTOM_FONT_SUGGESTIONS");
    expect(preferenceCard).toContain('t("settings.editorBodyFontSuggestions")');
    expect(editorFonts).toContain("html[data-editor-body-font] .edgeever-editor .ProseMirror");
    expect(editorFonts).toContain("html[data-ui-font]");
    expect(editorFonts).toContain("html[data-ui-font]:not([data-editor-body-font]) .edgeever-editor[data-editor-theme=\"default\"] .ProseMirror");
    expect(editorFonts).toContain("html[data-ui-font] .edgeever-public-share");
    expect(editorFonts).not.toContain(".edgeever-code-source");
    for (const fileName of ["kai.woff2", "kai-screen.woff2", "fangsong.woff2", "song.woff2", "zhi-song.woff2", "hei.woff2", "source-serif-4-regular.woff2", "OFL-lxgw-wenkai.txt", "OFL-zhuque-fangsong.txt", "OFL-source-han-serif.txt", "OFL-source-serif-4.txt", "IPA-lxgw-neo-zhi-song.txt"]) {
      expect(existsSync(new URL(`../../assets/fonts/editor-body/${fileName}`, import.meta.url))).toBe(true);
    }
  });
});

describe("editor content alignment preference", () => {
  test("is configured from settings instead of the per-note toolbar", () => {
    const preferenceCard = readFileSync(new URL("./PreferenceCard.tsx", import.meta.url), "utf8");
    const editorPane = readFileSync(new URL("../EditorPane.tsx", import.meta.url), "utf8");

    expect(preferenceCard).toContain('t("settings.editorContentAlignmentTitle")');
    expect(preferenceCard).toContain('onEditorContentAlignmentChange(value as EditorContentAlignment)');
    expect(editorPane).not.toContain("onToggleEditorContentAlignment");
  });
});

describe("appearance preference", () => {
  test("exposes light, dark, and system as a first-class setting", () => {
    const preferenceCard = readFileSync(new URL("./PreferenceCard.tsx", import.meta.url), "utf8");

    expect(preferenceCard).toContain('t("settings.themeTitle")');
    expect(preferenceCard).toContain('setAppearancePreference(value as ThemePreference)');
    expect(preferenceCard).toContain('value="system"');
    expect(preferenceCard).toContain('value="light"');
    expect(preferenceCard).toContain('value="dark"');
  });
});

describe("paper editor themes", () => {
  test("keeps theme switching in the editor toolbar instead of settings", () => {
    const preferenceCard = readFileSync(new URL("./PreferenceCard.tsx", import.meta.url), "utf8");
    const editorToolbar = readFileSync(new URL("../EditorToolbar.tsx", import.meta.url), "utf8");

    expect(preferenceCard).not.toContain('t("settings.publishLayoutTitle")');
    expect(preferenceCard).not.toContain('t("settings.editorThemeTitle")');
    expect(preferenceCard).not.toContain('t("settings.markdownThemeTitle")');
    expect(preferenceCard).toContain('t("settings.customEditorTheme.settingsTitle")');
    expect(editorToolbar).toContain('t(`settings.editorThemes.${theme}`)');
    expect(editorToolbar).toContain("markdownThemePreference");
  });
});

describe("custom editor theme portability", () => {
  test("offers import and export while keeping contrast as a warning", () => {
    const dialog = readFileSync(new URL("./CustomEditorThemeDialog.tsx", import.meta.url), "utf8");

    expect(dialog).toContain('t("settings.customEditorTheme.import")');
    expect(dialog).toContain('t("settings.customEditorTheme.export")');
    expect(dialog).toContain("activeContrastIssues.length > 0");
    expect(dialog).not.toContain("hasAccessibleContrast(draft.light)");
  });
});
