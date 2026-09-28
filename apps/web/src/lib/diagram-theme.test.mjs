import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";
import { DIAGRAM_CANVAS_DARK, DIAGRAM_CANVAS_LIGHT } from "@edgeever/shared";
import { DIAGRAM_THEME_PALETTES, resolveDiagramPalette } from "./diagram-theme.ts";

const channel = (value) => {
  const normalized = value / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex) => {
  const channels = hex.match(/[a-f\d]{2}/gi).map((value) => channel(Number.parseInt(value, 16)));
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};

const contrast = (foreground, background) => {
  const values = [luminance(foreground), luminance(background)].sort((left, right) => right - left);
  return (values[0] + 0.05) / (values[1] + 0.05);
};

describe("diagram appearance palettes", () => {
  test("provides distinct night-mode surfaces for every diagram theme", () => {
    for (const theme of Object.keys(DIAGRAM_THEME_PALETTES)) {
      const light = resolveDiagramPalette(theme, "light");
      const dark = resolveDiagramPalette(theme, "dark");
      expect(dark.canvas).not.toBe(light.canvas);
      expect(luminance(dark.canvas)).toBeLessThan(0.02);
      expect(contrast(dark.nodeText, dark.nodeFill)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(dark.topicText, dark.topicFill)).toBeGreaterThanOrEqual(3);
    }
  });

  test("treats retired mint and forest themes as forest green", () => {
    expect(resolveDiagramPalette("ocean", "light")).toEqual(resolveDiagramPalette("brand", "light"));
    expect(resolveDiagramPalette("ink", "dark")).toEqual(resolveDiagramPalette("brand", "dark"));
  });

  test("keeps selectable color schemes distinct from forest green", () => {
    expect(Object.keys(DIAGRAM_THEME_PALETTES)).toEqual(expect.arrayContaining([
      "plain", "brand", "cosmos", "dune", "slate", "prism", "sunrise", "marine", "blossom", "mint", "macaron",
    ]));
    expect(resolveDiagramPalette("plain", "light").topicFill).toBe("#707070");
    const globals = readFileSync(new URL("../styles/globals.css", import.meta.url), "utf8");
    expect(globals).toContain(`--workspace-editor: ${DIAGRAM_CANVAS_LIGHT};`);
    expect(globals).toContain(`--workspace-editor: ${DIAGRAM_CANVAS_DARK};`);
    for (const theme of Object.keys(DIAGRAM_THEME_PALETTES)) {
      expect(resolveDiagramPalette(theme, "light").canvas).toBe(DIAGRAM_CANVAS_LIGHT);
      expect(resolveDiagramPalette(theme, "dark").canvas).toBe(DIAGRAM_CANVAS_DARK);
    }
    expect(resolveDiagramPalette("mint", "light").topicFill).not.toBe(resolveDiagramPalette("brand", "light").topicFill);
    expect(resolveDiagramPalette("ocean", "light")).toEqual(resolveDiagramPalette("brand", "light"));
  });
});
