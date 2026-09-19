import { describe, expect, test } from "bun:test";
import { isRevocableObjectUrl, releaseHtmlMediaSources } from "./editor-media-release.ts";

describe("editor media release", () => {
  test("recognizes blob object URLs", () => {
    expect(isRevocableObjectUrl("blob:http://127.0.0.1/abc")).toBe(true);
    expect(isRevocableObjectUrl("edgeever-resource://resource/img_1")).toBe(false);
  });

  test("blanks image sources and revokes blob URLs", () => {
    const revoked = [];
    const originalRevoke = URL.revokeObjectURL;
    URL.revokeObjectURL = (url) => {
      revoked.push(url);
    };

    const blobSrc = "blob:http://edgeever.local/1";
    const img = {
      src: blobSrc,
      removeAttribute(name) {
        if (name === "src") this.src = "";
      },
    };
    const canvas = { width: 640, height: 480 };
    const root = {
      querySelectorAll(selector) {
        if (selector === "img") return [img];
        if (selector === "canvas") return [canvas];
        return [];
      },
    };

    try {
      expect(releaseHtmlMediaSources(root)).toEqual({ images: 1, revoked: 1 });
      expect(img.src).toBe("");
      expect(canvas).toEqual({ width: 0, height: 0 });
      expect(revoked).toEqual([blobSrc]);
    } finally {
      URL.revokeObjectURL = originalRevoke;
    }
  });
});
