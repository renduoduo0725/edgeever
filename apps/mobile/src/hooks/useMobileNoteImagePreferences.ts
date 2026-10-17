import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useSyncExternalStore } from "react";
import { DEFAULT_NOTE_IMAGE_PREFERENCES } from "@edgeever/shared/note-image-preferences";
import { createMobileNoteImagePreferenceStore } from "../lib/note-image-preferences";

const store = createMobileNoteImagePreferenceStore(AsyncStorage);

export const useMobileNoteImagePreferences = () => {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => { void store.load(); }, []);
  return {
    preferences: snapshot ?? DEFAULT_NOTE_IMAGE_PREFERENCES,
    ready: snapshot !== undefined,
    setPreference: store.update,
  };
};
