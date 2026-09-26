import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const brand = readFileSync(new URL("./brand.css", import.meta.url), "utf8");
const globalCss = readFileSync(new URL("./global.css", import.meta.url), "utf8");

describe("site decorative wide gamut", () => {
  test("keeps the celadon brand in sRGB and limits oklch to decorative tokens", () => {
    expect(brand).toContain("--edgeever-celadon-600: #2b968b;");
    expect(brand).toContain("--edgeever-brand: var(--edgeever-celadon-600);");
    expect(brand).toContain("--edgeever-decor-gradient: linear-gradient(135deg, var(--edgeever-decor-from) 0%, var(--edgeever-decor-to) 100%);");
    expect(brand).toContain("@media (color-gamut: p3)");
    expect(brand).toContain("--edgeever-decor-to: oklch(0.611 0.129 185);");
    expect(brand).not.toContain("--edgeever-brand: oklch(");
    expect(globalCss).toContain("background-image: var(--edgeever-decor-gradient);");
    expect(globalCss).toContain("box-shadow: 0 20px 40px -15px var(--edgeever-decor-shadow);");
    expect(globalCss).toContain("box-shadow: 0 0 50px -12px var(--edgeever-decor-glow);");
  });
});
