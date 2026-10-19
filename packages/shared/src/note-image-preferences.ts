import { FONT_IDS } from "./font-catalog";
import {
  NOTE_IMAGE_THEME_OPTIONS,
  type NoteImageActiveTheme,
  type NoteImageFontStyle,
  type NoteImageFontSize,
  type NoteImageCardWidth,
} from "./note-image-card";

export type NoteImagePreferences = {
  theme: NoteImageActiveTheme;
  fontStyle: NoteImageFontStyle;
  fontSize: NoteImageFontSize;
  cardWidth: NoteImageCardWidth;
  format: "png" | "jpeg";
  showTitle: boolean;
  showNotebook: boolean;
  showTags: boolean;
  showUpdatedAt: boolean;
  showReadingTime: boolean;
  showAuthor: boolean;
  showBranding: boolean;
  author: string;
};

export const DEFAULT_NOTE_IMAGE_PREFERENCES: NoteImagePreferences = {
  theme: "glass", fontStyle: "auto", fontSize: "lg", cardWidth: "wide", format: "png",
  showTitle: false, showNotebook: false, showTags: false, showUpdatedAt: true,
  showReadingTime: false, showAuthor: false, showBranding: true, author: "",
};

/** Selecting a template restores its typography; later font choices override it. */
export const updateNoteImagePreference = <K extends keyof NoteImagePreferences>(
  preferences: NoteImagePreferences,
  key: K,
  value: NoteImagePreferences[K],
): NoteImagePreferences => ({
  ...preferences,
  [key]: value,
  ...(key === "theme" ? { fontStyle: "auto" as const } : {}),
});

const choices = {
  theme: NOTE_IMAGE_THEME_OPTIONS,
  fontStyle: ["auto", "kai", "serif", "sans", "mono", ...FONT_IDS],
  fontSize: ["sm", "md", "lg"],
  cardWidth: ["compact", "standard", "wide"],
  format: ["png", "jpeg"],
} as const;

export const resolveNoteImagePreferences = (
  stored: unknown,
  fallback: NoteImagePreferences = DEFAULT_NOTE_IMAGE_PREFERENCES,
): NoteImagePreferences => {
  const preferences = { ...fallback };
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return preferences;
  const values = stored as Record<string, unknown>;
  if (values.theme === "gradient") preferences.theme = "glass";
  for (const key of Object.keys(choices) as Array<keyof typeof choices>) {
    const value = values[key];
    if (typeof value === "string" && (choices[key] as readonly string[]).includes(value)) {
      Object.assign(preferences, { [key]: value });
    }
  }
  for (const key of Object.keys(DEFAULT_NOTE_IMAGE_PREFERENCES) as Array<keyof NoteImagePreferences>) {
    if (typeof DEFAULT_NOTE_IMAGE_PREFERENCES[key] === "boolean" && typeof values[key] === "boolean") {
      Object.assign(preferences, { [key]: values[key] });
    }
  }
  if (typeof values.author === "string") preferences.author = values.author.slice(0, 32);
  return preferences;
};

export const parseNoteImagePreferences = (raw: string | null): NoteImagePreferences => {
  try { return resolveNoteImagePreferences(JSON.parse(raw || "null")); }
  catch { return { ...DEFAULT_NOTE_IMAGE_PREFERENCES }; }
};
