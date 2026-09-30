import {
  paletteForLegacyEditorTheme,
  type NoteProseCustomColors,
  type NoteProsePaletteChoice,
} from "@edgeever/shared";

const EDITOR_THEME_STORAGE_KEY = "edgeever.editor-theme";
const CUSTOM_EDITOR_THEMES_STORAGE_KEY = "edgeever.custom-editor-themes";

export type LocalNoteProseMigration = {
  palette: NoteProsePaletteChoice | null;
  customCss: string | null;
  customColors: NoteProseCustomColors | null;
};

const readStorage = (key: string) => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const readLocalNoteProseMigration = (): LocalNoteProseMigration => {
  const theme = readStorage(EDITOR_THEME_STORAGE_KEY);
  const palette = paletteForLegacyEditorTheme(theme);
  let customCss: string | null = null;
  const rawThemes = readStorage(CUSTOM_EDITOR_THEMES_STORAGE_KEY);
  if (rawThemes) {
    try {
      const parsed = JSON.parse(rawThemes) as unknown;
      if (Array.isArray(parsed)) {
        const selected = parsed.find((item) =>
          typeof item === "object" && item !== null && (item as { id?: unknown }).id === theme);
        const cssOwner = [selected, ...parsed].find((item) =>
          typeof item === "object"
          && item !== null
          && typeof (item as { customCss?: unknown }).customCss === "string"
          && (item as { customCss: string }).customCss.trim());
        if (cssOwner) customCss = (cssOwner as { customCss: string }).customCss;
      }
    } catch {
      customCss = null;
    }
  }
  return { palette, customCss, customColors: null };
};
