import { expect, test } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { PINNED_FONT_RESOURCES, pinnedFontUrl, OFFLINE_SANS_URL } from "./font-resources";
import { remoteFontIntegrity, remoteFontUrls } from "./font-catalog";

// Validate actual bytes, so changing a font without updating its immutable source cannot pass.
test("optional template and legacy fonts have pinned sources and verified original bytes", () => {
  for (const [key, entry] of Object.entries(PINNED_FONT_RESOURCES)) {
    const data = readFileSync(new URL(`../../../${entry.path}`, import.meta.url));
    expect(data.byteLength).toBe(entry.bytes);
    expect(createHash("sha256").update(data).digest("hex")).toBe(entry.sha256);
    const url = pinnedFontUrl(key);
    expect(url).toContain("@cb13c0759256caed174b4063845c7948d90fc1bd/");
    expect(remoteFontIntegrity(url)).toEqual(entry);
    expect(remoteFontUrls(url)[1]).toStartWith("https://raw.githubusercontent.com/tianma-if/edgeever/cb13c0759256caed174b4063845c7948d90fc1bd/");
  }
});

test("all platforms bundle only the same two defaults and textures, with fonts below 1.5 MiB", () => {
  const shared = readFileSync(new URL("./note-image-asset-urls.ts", import.meta.url), "utf8");
  const mobile = readFileSync(new URL("../../../apps/mobile/src/components/note-image-asset-urls.ts", import.meta.url), "utf8");
  const keys = source => [...source.matchAll(/^  "([^"]+)":/gm)].map(match => match[1]);
  expect(keys(shared)).toEqual(["offline-sans.woff2", "geist/GeistMono.ttf", "paper.png", "paper-text.png"]);
  expect(keys(mobile)).toEqual(keys(shared));
  const sans = readFileSync(new URL("./font-assets/poster/notosans.woff2", import.meta.url));
  const mono = readFileSync(new URL("./note-image-assets/geist/GeistMono.ttf", import.meta.url));
  expect(sans.byteLength + mono.byteLength).toBeLessThan(1.5 * 1024 * 1024);
  expect(createHash("sha256").update(sans).digest("hex")).toBe(remoteFontIntegrity(OFFLINE_SANS_URL).sha256);
  expect(existsSync(new URL("../../../apps/web/public/poster-fonts", import.meta.url))).toBe(false);
  const body = readFileSync(new URL("../../../apps/web/src/lib/editor-body-font-faces.ts", import.meta.url), "utf8");
  expect(body).not.toContain("assets/fonts/editor-body/");
});
