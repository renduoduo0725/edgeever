import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { globToRegExp, selectReleaseAssets } from "./download-release-assets.mjs";

describe("release asset download", () => {
  test("matches the published audit filenames", () => {
    const assets = [
      { name: "EdgeEver-1.84.0-linux-x64.AppImage" },
      { name: "EdgeEver-1.84.0-windows-x64.exe" },
      { name: "edgeever-android-v1.84.0-arm64-v8a.apk" },
      { name: "latest-linux.yml" },
      { name: "SHA256SUMS-linux.txt" },
    ];
    expect(selectReleaseAssets(assets, [
      "EdgeEver-*-linux-x64.AppImage",
      "latest-linux.yml",
      "SHA256SUMS-linux.txt",
    ]).map((asset) => asset.name)).toEqual([
      "EdgeEver-1.84.0-linux-x64.AppImage",
      "latest-linux.yml",
      "SHA256SUMS-linux.txt",
    ]);
    expect(globToRegExp("edgeever-android-v*-arm64-v8a.apk").test(assets[2].name)).toBe(true);
  });

  test("rejects a pattern that matches nothing", () => {
    expect(() => selectReleaseAssets([{ name: "latest.yml" }], ["missing-*"])).toThrow(
      "Release has no asset matching missing-*.",
    );
  });

  test("published audits download through the release API", () => {
    const desktop = readFileSync(new URL("../.github/workflows/desktop-build.yml", import.meta.url), "utf8");
    const mobile = readFileSync(new URL("../.github/workflows/mobile-build.yml", import.meta.url), "utf8");
    expect(desktop).toContain("node scripts/download-release-assets.mjs");
    expect(mobile).toContain("node scripts/download-release-assets.mjs");
    expect(desktop).not.toContain('gh release download "$RELEASE_TAG"');
    expect(mobile).not.toContain('gh release download "$CURRENT_TAG"');
  });
});
