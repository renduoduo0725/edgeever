import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { trayIconPath } from "./tray-icon.mjs";

describe("trayIconPath", () => {
  test("uses the macOS template icon during development", () => {
    expect(trayIconPath({
      isPackaged: false,
      platform: "darwin",
      projectRoot: "/project",
      resourcesPath: "/resources",
    })).toBe("/project/apps/desktop/assets/trayTemplate.png");
  });

  test("uses the packaged macOS template icon", () => {
    expect(trayIconPath({
      isPackaged: true,
      platform: "darwin",
      projectRoot: "/project",
      resourcesPath: "/resources",
    })).toBe("/resources/tray/trayTemplate.png");
  });

  test("keeps the existing cross-platform icon outside macOS", () => {
    expect(trayIconPath({
      isPackaged: true,
      platform: "win32",
      projectRoot: "/project",
      resourcesPath: "/resources",
    })).toBe("/resources/web/pwa-192x192.png");
  });

  test("uses a heavier 22pt menu-bar cat instead of the padded brand mark", () => {
    const svg = readFileSync(new URL("../../assets/trayTemplate.svg", import.meta.url), "utf8");
    expect(svg).not.toContain("M9 2h14a6 6 0 0 1 6 6v16a6 6 0 0 1-6 6H9");
    expect(svg).not.toContain("scale(0.74234234)");
    expect(svg).toContain("viewBox=\"0 0 1024 1024\"");
    expect(svg).toContain("fill=\"#000000\"");
    expect(svg).toContain("stroke=\"#000000\"");
    expect(svg).toContain("stroke-width=\"36\"");
    expect(svg).toContain("scale(1.1)");
  });

  test.each([
    ["trayTemplate.png", 22, 72],
    ["trayTemplate@2x.png", 44, 144],
  ])("%s is a crisp black template glyph", async (name, size, density) => {
    const path = fileURLToPath(new URL(`../../assets/${name}`, import.meta.url));
    const image = sharp(path);
    const metadata = await image.metadata();
    const { data } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let opaque = 0;
    let soft = 0;
    for (let offset = 3; offset < data.length; offset += 4) {
      if (data[offset] >= 250) opaque += 1;
      else if (data[offset] > 0) soft += 1;
    }
    const coverage = opaque / (size * size);

    expect(metadata).toMatchObject({
      width: size,
      height: size,
      density,
      format: "png",
      hasAlpha: true,
    });
    expect(soft).toBe(0);
    expect(coverage).toBeGreaterThan(0.22);
    expect(coverage).toBeLessThan(0.4);
  });
});
