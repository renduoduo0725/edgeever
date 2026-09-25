import { describe, expect, test } from "bun:test";
import {
  DEFAULT_IMAGE_WIDTH_PERCENT,
  NEW_IMAGE_WIDTH_PERCENT,
  IMAGE_WIDTH_PRESETS,
  clampImageWidth,
  parseImageWidth,
} from "./image-display.ts";

describe("shared image display widths", () => {
  test("keeps the four editor presets stable across clients", () => {
    expect(DEFAULT_IMAGE_WIDTH_PERCENT).toBe(72);
    expect(NEW_IMAGE_WIDTH_PERCENT).toBe(IMAGE_WIDTH_PRESETS[0].width);
    expect(IMAGE_WIDTH_PRESETS.map(({ id, width }) => [id, width])).toEqual([
      ["small", 35],
      ["medium", 50],
      ["large", 72],
      ["full", 100],
    ]);
  });

  test("parses persisted widths and clamps arbitrary resize values", () => {
    expect(parseImageWidth("width: 50%")).toBe(50);
    expect(parseImageWidth("120")).toBe(100);
    expect(parseImageWidth(null)).toBeNull();
    expect(clampImageWidth(24.6)).toBe(25);
    expect(clampImageWidth(71.6)).toBe(72);
  });
});
