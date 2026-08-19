import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("memo context menu", () => {
  test("uses a Radix submenu for notebook moves so opening the picker does not close the menu", () => {
    const source = readFileSync(new URL("./MemoListPane.tsx", import.meta.url), "utf8");

    expect(source).toContain("<DropdownMenuSub>");
    expect(source).toContain("<DropdownMenuSubTrigger");
    expect(source).toContain("<DropdownMenuSubContent");
    expect(source).not.toContain("contextMoveOpen");
  });
});
