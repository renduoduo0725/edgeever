import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("editor content alignment preference", () => {
  test("is configured from settings instead of the per-note toolbar", () => {
    const preferenceCard = readFileSync(new URL("./PreferenceCard.tsx", import.meta.url), "utf8");
    const editorPane = readFileSync(new URL("../EditorPane.tsx", import.meta.url), "utf8");

    expect(preferenceCard).toContain('t("settings.editorContentAlignmentTitle")');
    expect(preferenceCard).toContain('onEditorContentAlignmentChange(value as EditorContentAlignment)');
    expect(editorPane).not.toContain("onToggleEditorContentAlignment");
  });
});
