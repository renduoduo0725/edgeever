import { useSyncExternalStore } from "react";

export const SHOW_DESCENDANT_NOTES_STORAGE_KEY = "edgeever.showDescendantNotes";

export const SHOW_DESCENDANT_NOTES_CHANGED_EVENT = "edgeever:show-descendant-notes-changed";

// Parent notebooks keep aggregating their sub-notebooks unless turned off.
export const resolveStoredShowDescendantNotes = (stored: string | null): boolean =>
  stored !== "false";

// Holds the choice while localStorage rejects writes, so the toggle still works
// for the rest of this page session.
let unsavedPreference: boolean | null = null;

export const readShowDescendantNotesPreference = (): boolean => {
  if (typeof window === "undefined") return true;
  if (unsavedPreference !== null) return unsavedPreference;
  try {
    return resolveStoredShowDescendantNotes(
      window.localStorage?.getItem(SHOW_DESCENDANT_NOTES_STORAGE_KEY) ?? null,
    );
  } catch {
    return true;
  }
};

export const writeShowDescendantNotesPreference = (enabled: boolean) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage?.setItem(SHOW_DESCENDANT_NOTES_STORAGE_KEY, enabled ? "true" : "false");
    unsavedPreference = null;
  } catch {
    // Private mode / blocked storage — keep the choice in memory for this session.
    unsavedPreference = enabled;
  }
  window.dispatchEvent(
    new CustomEvent(SHOW_DESCENDANT_NOTES_CHANGED_EVENT, { detail: enabled }),
  );
};

const subscribe = (onChange: () => void) => {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === SHOW_DESCENDANT_NOTES_STORAGE_KEY) onChange();
  };
  window.addEventListener(SHOW_DESCENDANT_NOTES_CHANGED_EVENT, onChange);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(SHOW_DESCENDANT_NOTES_CHANGED_EVENT, onChange);
    window.removeEventListener("storage", handleStorage);
  };
};

export const useShowDescendantNotesPreference = () =>
  useSyncExternalStore(subscribe, readShowDescendantNotesPreference, () => true);
