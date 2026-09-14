import { describe, expect, test } from "bun:test";
import { resolveEditorCloseAction } from "./mobile-editor-close";

describe("resolveEditorCloseAction", () => {
  test("runs close immediately when idle", () => {
    expect(resolveEditorCloseAction({ closeInFlight: false, saving: false, uploading: false })).toBe("run");
  });

  test("remembers a back tap while a save is already in flight", () => {
    expect(resolveEditorCloseAction({ closeInFlight: false, saving: true, uploading: false })).toBe("defer");
  });

  test("ignores duplicate taps while close is already running", () => {
    expect(resolveEditorCloseAction({ closeInFlight: true, saving: false, uploading: false })).toBe("defer");
    expect(resolveEditorCloseAction({ closeInFlight: true, saving: true, uploading: false })).toBe("defer");
  });

  test("does not leave while an upload is in progress", () => {
    expect(resolveEditorCloseAction({ closeInFlight: false, saving: false, uploading: true })).toBe("block");
  });
});
