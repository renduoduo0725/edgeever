import { describe, expect, test } from "bun:test";
import { DEFAULT_NOTE_PROSE_CSS } from "@edgeever/shared";
import { parseCustomCssToStyles, previewNoteProseCss, sanitizeAndScopeCss } from "./css-sandbox";

describe("note prose css sandbox", () => {
  test("keeps dark rules outside the editor scope", () => {
    const scoped = sanitizeAndScopeCss(DEFAULT_NOTE_PROSE_CSS);
    expect(scoped).toContain(".edgeever-editor .ProseMirror p { color: #212121; text-indent: 0; margin-top: 0; margin-bottom: 8px; }");
    expect(scoped).toContain(":root.dark .edgeever-editor .ProseMirror p { color: #dee3e0; }");
    expect(scoped).toContain(":root.dark .edgeever-editor .ProseMirror h1");
    expect(scoped).not.toContain(".ProseMirror :root.dark");
    expect(scoped).not.toContain("font-size");
  });

  test("inlines light tag rules and skips dark selectors", () => {
    const styles = parseCustomCssToStyles(DEFAULT_NOTE_PROSE_CSS);
    expect(styles.p).toContain("color: #212121");
    expect(styles.p).not.toContain("#dee3e0");
    expect(styles.blockquote).toContain("background-color: #f3f5f7");
  });

  test("binds dark rules to the sample instead of the app theme", () => {
    const preview = previewNoteProseCss(DEFAULT_NOTE_PROSE_CSS);
    expect(preview).toContain(".note-prose-css-preview-dark .edgeever-editor .ProseMirror p { color: #dee3e0; }");
    expect(preview).toContain(".edgeever-editor .ProseMirror p { color: #212121; text-indent: 0; margin-top: 0; margin-bottom: 8px; }");
    expect(preview).not.toContain(":root.dark");
  });
});
