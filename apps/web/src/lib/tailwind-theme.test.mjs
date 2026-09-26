import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { MOBILE_UI_METRICS } from "../../../../packages/shared/src/mobile-ui.ts";

describe("tailwind theme tokens", () => {
  test("web uses Tailwind 4 CSS tokens backed by the existing runtime palette", () => {
    const vite = readFileSync(new URL("../../vite.config.ts", import.meta.url), "utf8");
    const css = readFileSync(new URL("../styles/globals.css", import.meta.url), "utf8");

    expect(vite).toContain('import tailwindcss from "@tailwindcss/vite"');
    expect(css).toContain('@import "tailwindcss"');
    expect(css).toContain('@custom-variant dark (&:where(.dark, .dark *))');
    expect(css).toContain("--color-slate-950: rgb(var(--slate-950-rgb) / 1)");
    expect(css).toContain("--color-emerald-500: rgb(var(--brand-green-500-rgb) / 1)");
    expect(css).toContain("--color-amber-50: rgb(var(--amber-50-rgb) / 1)");
    expect(css).toContain("--color-amber-300: rgb(var(--amber-300-rgb) / 1)");
    expect(css).toContain("--color-amber-400: rgb(var(--amber-400-rgb) / 1)");
    expect(css).toContain("--color-amber-500: rgb(var(--amber-500-rgb) / 1)");
    expect(css).toContain("--color-rose-50: rgb(var(--rose-50-rgb) / 1)");
    expect(css).toContain("--color-rose-400: rgb(var(--rose-400-rgb) / 1)");
    expect(css).toContain("--color-red-100: rgb(var(--rose-100-rgb) / 1)");
    expect(css).toContain("--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05)");
    expect(css).toContain("--blur-sm: 4px");
    expect(css).toContain(".focus-visible\\:outline-none:focus-visible");
    expect(css).toContain(".edgeever-reveal-on-touch");
    expect(css).toContain(".divide-slate-200 > :not(:last-child)");
  });

  test("mobile CSS tokens match the shared layout metrics", () => {
    const css = readFileSync(new URL("../styles/globals.css", import.meta.url), "utf8");
    expect(css).toContain(`--spacing-mobile-bottom-nav: ${MOBILE_UI_METRICS.bottomNavigationHeight}px`);
    expect(css).toContain(`--spacing-mobile-control: ${MOBILE_UI_METRICS.compactControlHeight}px`);
    expect(css).toContain(`--spacing-mobile-fab: ${MOBILE_UI_METRICS.floatingCreateButtonSize}px`);
    expect(css).toContain(`--spacing-mobile-touch: ${MOBILE_UI_METRICS.minimumTouchTarget}px`);
    expect(css).toContain(`--radius-mobile-sheet: ${MOBILE_UI_METRICS.floatingSheetCornerRadius}px`);
  });
});
