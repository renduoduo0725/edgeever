import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

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
