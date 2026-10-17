import { DEFAULT_NOTE_IMAGE_PREFERENCES, resolveNoteImagePreferences, type NoteImagePreferences } from "@edgeever/shared/note-image-preferences";
export type { NoteImagePreferences } from "@edgeever/shared/note-image-preferences";
export const NOTE_IMAGE_PREFERENCES_STORAGE_KEY = "edgeever_share_image_preferences";

// Retain choices across dialog remounts when browser storage rejects writes.
let unsavedPreferences: NoteImagePreferences | undefined;

export const readNoteImagePreferences = (): NoteImagePreferences => {
  if (unsavedPreferences) return { ...unsavedPreferences };
  const preferences = { ...DEFAULT_NOTE_IMAGE_PREFERENCES };
  try {
    // Keep the title and signature choices saved by earlier versions.
    preferences.showTitle = localStorage.getItem("edgeever_share_image_show_title") !== "false";
    preferences.author = (localStorage.getItem("edgeever_share_author_name") || "").slice(0, 32);
    preferences.showAuthor = Boolean(preferences.author);
    const stored: unknown = JSON.parse(localStorage.getItem(NOTE_IMAGE_PREFERENCES_STORAGE_KEY) || "null");
    return resolveNoteImagePreferences(stored, preferences);
  } catch {
    // Missing, malformed or blocked storage falls back to usable preferences.
  }
  return preferences;
};

export const writeNoteImagePreferences = (preferences: NoteImagePreferences): void => {
  try {
    localStorage.setItem(NOTE_IMAGE_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
    unsavedPreferences = undefined;
  } catch {
    unsavedPreferences = { ...preferences };
  }
};
