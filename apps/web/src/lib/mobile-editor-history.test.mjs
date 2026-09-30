import { describe, expect, test } from "bun:test";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { clearMobileEditorUndoHistory } from "@edgeever/shared/mobile-editor";

const createEditor = () => {
  const editor = new Editor({
    extensions: [StarterKit],
    content: { type: "doc", content: [{ type: "paragraph" }] },
  });
  // Headless Bun has no DOM, so Editor.createView never reconfigures plugins.
  // Mount the same plugin set a browser view installs before the first paint.
  editor.view.updateState(editor.state.reconfigure({
    plugins: editor.extensionManager.plugins,
  }));
  return editor;
};

describe("mobile editor undo history", () => {
  test("drops a programmatic document load and keeps later typing undoable", () => {
    const editor = createEditor();
    editor.commands.setContent({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "loaded" }] }],
    }, { emitUpdate: false });
    expect(editor.can().undo()).toBe(true);

    clearMobileEditorUndoHistory(editor);
    expect(editor.getText()).toBe("loaded");
    expect(editor.can().undo()).toBe(false);

    editor.view.dispatch(editor.state.tr.insertText("!"));
    expect(editor.getText()).toBe("loaded!");
    expect(editor.can().undo()).toBe(true);
    expect(editor.commands.undo()).toBe(true);
    expect(editor.getText()).toBe("loaded");
    expect(editor.can().undo()).toBe(false);
    editor.destroy();
  });
});
