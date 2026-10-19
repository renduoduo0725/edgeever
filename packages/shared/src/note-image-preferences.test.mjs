import { expect, test } from "bun:test";
import { DEFAULT_NOTE_IMAGE_PREFERENCES, resolveNoteImagePreferences, updateNoteImagePreference } from "./note-image-preferences";
import { NOTE_IMAGE_THEME_OPTIONS, resolveNoteImageTypography } from "./note-image-card";

test("glass replaces the old default without discarding other saved preferences", () => {
  expect(DEFAULT_NOTE_IMAGE_PREFERENCES.theme).toBe("glass");
  expect(NOTE_IMAGE_THEME_OPTIONS[0]).toBe("glass");
  expect(NOTE_IMAGE_THEME_OPTIONS).not.toContain("gradient");
  const saved = { ...DEFAULT_NOTE_IMAGE_PREFERENCES, theme: "gradient", fontStyle: "heavy", showTitle: false, author: "天马" };
  expect(resolveNoteImagePreferences(saved)).toEqual({ ...saved, theme: "glass" });
  expect(resolveNoteImagePreferences(saved, { ...DEFAULT_NOTE_IMAGE_PREFERENCES, theme: "book" }).theme).toBe("glass");
});

test("selecting any template restores its typography after a custom font", () => {
  const custom = { ...DEFAULT_NOTE_IMAGE_PREFERENCES, fontStyle: "heavy", showAuthor: true, author: "天马" };
  for (const theme of NOTE_IMAGE_THEME_OPTIONS) {
    const selected = updateNoteImagePreference(custom, "theme", theme);
    expect(selected).toEqual({ ...custom, theme, fontStyle: "auto" });
    expect(resolveNoteImageTypography(theme, selected.fontStyle)).toEqual(resolveNoteImageTypography(theme));
    const manual = updateNoteImagePreference(selected, "fontStyle", "serif");
    expect(manual.fontStyle).toBe("serif");
    expect(updateNoteImagePreference(manual, "fontSize", "sm").fontStyle).toBe("serif");
    expect(updateNoteImagePreference(manual, "theme", theme).fontStyle).toBe("auto");
  }
});
