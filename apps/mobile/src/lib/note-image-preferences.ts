import {
  DEFAULT_NOTE_IMAGE_PREFERENCES,
  parseNoteImagePreferences,
  updateNoteImagePreference,
  type NoteImagePreferences,
} from "@edgeever/shared/note-image-preferences";

export const MOBILE_NOTE_IMAGE_PREFERENCES_KEY = "edgeever.mobile.noteImagePreferences";

type PreferenceStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<unknown>;
};

export const createMobileNoteImagePreferenceStore = (storage: PreferenceStorage) => {
  let snapshot: NoteImagePreferences | undefined;
  let loading: Promise<void> | undefined;
  let writing: Promise<unknown> = Promise.resolve();
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach(listener => listener());
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    load: () => loading ??= (async () => {
      try {
        snapshot = parseNoteImagePreferences(await storage.getItem(MOBILE_NOTE_IMAGE_PREFERENCES_KEY));
      } catch {
        snapshot = { ...DEFAULT_NOTE_IMAGE_PREFERENCES };
      }
      notify();
    })(),
    update: <K extends keyof NoteImagePreferences>(key: K, value: NoteImagePreferences[K]) => {
      // The sheet stays in its loading state until hydration finishes.
      if (!snapshot) return;
      snapshot = updateNoteImagePreference(snapshot, key, value);
      const raw = JSON.stringify(snapshot);
      notify();
      // Serialize writes so a slow earlier write cannot replace the latest choice.
      // Keep the in-memory snapshot if persistence fails for this session.
      writing = writing.then(() => storage.setItem(MOBILE_NOTE_IMAGE_PREFERENCES_KEY, raw)).catch(() => undefined);
    },
    flush: () => writing,
  };
};
