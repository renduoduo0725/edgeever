import { describe, expect, test } from "bun:test";
import { clampDialogPixelPosition } from "./dialog-drag.ts";

describe("clampDialogPixelPosition", () => {
  const base = {
    width: 400,
    height: 300,
    viewportWidth: 1000,
    viewportHeight: 800,
  };

  test("keeps unconstrained movement", () => {
    expect(clampDialogPixelPosition({ ...base, x: 240, y: 80 })).toEqual({ x: 240, y: 80 });
  });

  test("keeps a slice of the dialog inside the viewport", () => {
    expect(clampDialogPixelPosition({ ...base, x: 2000, y: 2000 })).toEqual({ x: 952, y: 752 });
    expect(clampDialogPixelPosition({ ...base, x: -2000, y: -2000 })).toEqual({ x: -352, y: 0 });
  });
});
