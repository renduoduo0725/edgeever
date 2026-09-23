import { api } from "@/lib/api";
import { readEditorBodyFontPreference } from "@/lib/editor-body-font";

let lastPublished: string | undefined;

export const syncPublishedNoteBodyFont = async () => {
  const preference = readEditorBodyFontPreference();
  const bodyFont = preference.choice === "system" || preference.choice === "custom" ? null : preference.choice;
  const marker = bodyFont ?? "";
  if (lastPublished === marker) return;
  lastPublished = marker;
  try {
    await api.updatePublishedNoteBodyFont(bodyFont);
  } catch {
    lastPublished = undefined;
  }
};
