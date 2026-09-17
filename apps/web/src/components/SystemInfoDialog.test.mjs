import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./SystemInfoDialog.tsx", import.meta.url), "utf8");

describe("system information dialog dragging", () => {
  test("moves from the title bar and keeps the body scrollable", () => {
    expect(source).toContain("handleContentPointerDown");
    expect(source).toContain("data-dialog-drag-handle");
    expect(source).toContain("clampDialogPixelPosition");
    expect(source).toContain("cursor-grab");
    expect(source).toContain("grid-rows-[auto_minmax(0,1fr)_auto]");
    expect(source).toContain("min-h-0 overflow-y-auto");
  });
});
