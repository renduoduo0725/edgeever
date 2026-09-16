import { describe, expect, test } from "bun:test";
import { getEditorSaveChrome } from "./editor-save-chrome.ts";

const t = (key) => key;

describe("getEditorSaveChrome", () => {
  test("keeps conflict chrome over unsaved edits", () => {
    expect(getEditorSaveChrome({ saveState: "conflict", hasUnsavedChanges: true, t })).toEqual({
      saveLabel: "editor.saveState.conflict",
      saveStateClassName: "bg-rose-50 text-rose-700",
    });
  });

  test("shows queued chrome while the outbox holds the save", () => {
    expect(getEditorSaveChrome({ saveState: "queued", hasUnsavedChanges: false, t }).saveLabel).toBe(
      "editor.saveState.queued",
    );
  });

  test("marks dirty idle saves as unsaved", () => {
    expect(getEditorSaveChrome({ saveState: "idle", hasUnsavedChanges: true, t }).saveLabel).toBe(
      "editor.saveState.unsaved",
    );
  });
});
