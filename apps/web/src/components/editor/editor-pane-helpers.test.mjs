import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
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

describe("editor document reset", () => {
  test("rebuilds EditorState from JSON so undo history does not follow a memo switch", () => {
    const source = readFileSync(new URL("./editor-pane-helpers.ts", import.meta.url), "utf8");

    expect(source).toContain("export const resetEditorDocument");
    expect(source).toContain("releaseEditorMedia(editor)");
    expect(source).toContain("editor.view.updateState(EditorState.create({");
    expect(source).toContain("doc: editor.schema.nodeFromJSON(content)");
    expect(source).toContain("plugins: editor.state.plugins");
  });
});
