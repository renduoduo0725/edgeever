export const EDITOR_BODY_FONT_STORAGE_KEY = "edgeever.editorBodyFont";
export const EDITOR_BODY_FONT_CUSTOM_STORAGE_KEY = "edgeever.editorBodyFontCustom";

export const EDITOR_BODY_FONT_CHOICES = [
  "system",
  "wenkai",
  "wenkai-screen",
  "zhuque",
  "source-han-serif",
  "neo-zhi-song",
  "source-han-sans",
  "source-serif",
  "custom",
] as const;

export type EditorBodyFontChoice = (typeof EDITOR_BODY_FONT_CHOICES)[number];

export type EditorBodyFontPreference = {
  choice: EditorBodyFontChoice;
  customFamily: string;
};

const CJK_FALLBACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif';

export const BUNDLED_FONT_STACKS: Record<Exclude<EditorBodyFontChoice, "system" | "custom">, string> = {
  wenkai: `"EdgeEver Kai", ${CJK_FALLBACK}`,
  "wenkai-screen": `"EdgeEver Kai Screen", ${CJK_FALLBACK}`,
  zhuque: `"EdgeEver Fangsong", ${CJK_FALLBACK}`,
  "source-han-serif": `"Source Serif 4", "EdgeEver Song", ${CJK_FALLBACK}`,
  "neo-zhi-song": `"EdgeEver Zhi Song", ${CJK_FALLBACK}`,
  "source-han-sans": `"EdgeEver Hei", ${CJK_FALLBACK}`,
  "source-serif": `"Source Serif 4", ${CJK_FALLBACK}`,
};

export const getFontChoicePreviewStack = (choice: EditorBodyFontChoice): string | undefined => {
  if (choice === "system" || choice === "custom") return undefined;
  return BUNDLED_FONT_STACKS[choice];
};

const CUSTOM_FONT_FAMILY_PATTERN = /^[\p{L}\p{N}\s,'"._-]+$/u;
const MAX_CUSTOM_FONT_FAMILY_LENGTH = 200;

const DEFAULT_PREFERENCE: EditorBodyFontPreference = {
  choice: "system",
  customFamily: "",
};

export const isEditorBodyFontChoice = (value: string | null | undefined): value is EditorBodyFontChoice =>
  EDITOR_BODY_FONT_CHOICES.some((choice) => choice === value);

export const sanitizeEditorBodyFontFamily = (value: string) => {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized || normalized.length > MAX_CUSTOM_FONT_FAMILY_LENGTH || !CUSTOM_FONT_FAMILY_PATTERN.test(normalized)) {
    return "";
  }
  return normalized;
};

export const resolveEditorBodyFontStack = (preference: EditorBodyFontPreference) => {
  if (preference.choice === "system") return null;
  if (preference.choice === "custom") {
    const family = sanitizeEditorBodyFontFamily(preference.customFamily);
    return family ? `${family}, ${CJK_FALLBACK}` : null;
  }
  return BUNDLED_FONT_STACKS[preference.choice];
};

const readStorage = (key: string) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStorage = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Local storage can be unavailable in private or restricted browser contexts.
  }
};

export const readEditorBodyFontPreference = (): EditorBodyFontPreference => {
  const storedChoice = readStorage(EDITOR_BODY_FONT_STORAGE_KEY);
  const customFamily = readStorage(EDITOR_BODY_FONT_CUSTOM_STORAGE_KEY) ?? "";
  if (!isEditorBodyFontChoice(storedChoice)) return { ...DEFAULT_PREFERENCE, customFamily };
  return { choice: storedChoice, customFamily };
};

export const writeEditorBodyFontPreference = (preference: EditorBodyFontPreference) => {
  writeStorage(EDITOR_BODY_FONT_STORAGE_KEY, preference.choice);
  writeStorage(EDITOR_BODY_FONT_CUSTOM_STORAGE_KEY, preference.customFamily.slice(0, MAX_CUSTOM_FONT_FAMILY_LENGTH));
};

export const applyEditorBodyFontPreference = (preference = readEditorBodyFontPreference()) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const stack = resolveEditorBodyFontStack(preference);
  if (!stack) {
    delete root.dataset.editorBodyFont;
    root.style.removeProperty("--editor-body-font-family");
    return;
  }
  root.dataset.editorBodyFont = preference.choice;
  root.style.setProperty("--editor-body-font-family", stack);
};
