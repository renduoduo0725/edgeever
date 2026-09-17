import { describe, expect, test } from "bun:test";
import { shouldRetryCreatedMemoFocus } from "./editor-pane-helpers.ts";

describe("created memo focus retry", () => {
  test("keeps retrying until the editor is hydrated, editable, and focused", () => {
    expect(shouldRetryCreatedMemoFocus({
      attempt: 0,
      editorReady: false,
      editorEditable: false,
      editorFocused: false,
      hydratedForMemo: false,
    })).toBe(true);
    expect(shouldRetryCreatedMemoFocus({
      attempt: 3,
      editorReady: true,
      editorEditable: false,
      editorFocused: false,
      hydratedForMemo: true,
    })).toBe(true);
    expect(shouldRetryCreatedMemoFocus({
      attempt: 4,
      editorReady: true,
      editorEditable: true,
      editorFocused: false,
      hydratedForMemo: true,
    })).toBe(true);
    expect(shouldRetryCreatedMemoFocus({
      attempt: 5,
      editorReady: true,
      editorEditable: true,
      editorFocused: true,
      hydratedForMemo: true,
    })).toBe(false);
  });

  test("stops retrying after the attempt budget", () => {
    expect(shouldRetryCreatedMemoFocus({
      attempt: 120,
      editorReady: true,
      editorEditable: false,
      editorFocused: false,
      hydratedForMemo: true,
    })).toBe(false);
  });
});
