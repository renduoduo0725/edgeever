import { afterEach, describe, expect, test } from "bun:test";
import {
  readShowDescendantNotesPreference,
  resolveStoredShowDescendantNotes,
  SHOW_DESCENDANT_NOTES_CHANGED_EVENT,
  SHOW_DESCENDANT_NOTES_STORAGE_KEY,
  writeShowDescendantNotesPreference,
} from "./descendant-notes-preference.ts";

const originalWindow = globalThis.window;
const OriginalCustomEvent = globalThis.CustomEvent;

afterEach(() => {
  globalThis.window = originalWindow;
  globalThis.CustomEvent = OriginalCustomEvent;
});

const installWindow = () => {
  const values = new Map();
  const events = [];
  globalThis.CustomEvent ??= class CustomEvent {
    constructor(type, init) {
      this.type = type;
      this.detail = init?.detail;
    }
  };
  globalThis.window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
    },
    dispatchEvent: (event) => {
      events.push(event);
      return true;
    },
  };
  return { events, values };
};

describe("show descendant notes preference", () => {
  test("defaults to showing descendant notes unless explicitly disabled", () => {
    expect(resolveStoredShowDescendantNotes(null)).toBe(true);
    expect(resolveStoredShowDescendantNotes("unsupported")).toBe(true);
    expect(resolveStoredShowDescendantNotes("false")).toBe(false);
  });

  test("persists changes and notifies the current document", () => {
    const { events, values } = installWindow();
    writeShowDescendantNotesPreference(false);
    expect(values.get(SHOW_DESCENDANT_NOTES_STORAGE_KEY)).toBe("false");
    expect(readShowDescendantNotesPreference()).toBe(false);
    expect(events.map((event) => [event.type, event.detail])).toEqual([[SHOW_DESCENDANT_NOTES_CHANGED_EVENT, false]]);
  });

  test("falls back to the default when storage is unavailable", () => {
    globalThis.window = { localStorage: { getItem: () => { throw new Error("blocked"); } } };
    expect(readShowDescendantNotesPreference()).toBe(true);
  });

  test("keeps the choice for this session when storage rejects the write", () => {
    const { events, values } = installWindow();
    values.set(SHOW_DESCENDANT_NOTES_STORAGE_KEY, "true");
    globalThis.window.localStorage.setItem = () => {
      throw new Error("QuotaExceededError");
    };

    writeShowDescendantNotesPreference(false);
    expect(readShowDescendantNotesPreference()).toBe(false);
    expect(events.map((event) => event.detail)).toEqual([false]);

    // Once storage accepts writes again, the stored value takes over.
    const restored = installWindow();
    writeShowDescendantNotesPreference(true);
    expect(restored.values.get(SHOW_DESCENDANT_NOTES_STORAGE_KEY)).toBe("true");
    restored.values.set(SHOW_DESCENDANT_NOTES_STORAGE_KEY, "false");
    expect(readShowDescendantNotesPreference()).toBe(false);
  });
});
