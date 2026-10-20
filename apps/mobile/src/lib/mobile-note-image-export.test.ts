import { describe, expect, test } from "bun:test";
import { PathUtilities } from "../../node_modules/expo-file-system/src/pathUtilities";
import { buildImageExportBasename } from "@edgeever/shared/note-image-card";
import { encodeMobileNoteImageFileUri, planMobileNoteImageRender } from "./mobile-note-image-export";

describe("mobile note image file URI", () => {
  test.each(["png", "jpg"])("preserves bracketed titles for %s exports through Expo path joining", (extension) => {
    const filename = `${buildImageExportBasename("[Serv00.com] Account activation tuuki", "Untitled")}.${extension}`;
    const uri = encodeMobileNoteImageFileUri(PathUtilities.join("file:///cache/exports/request-1/", filename));
    expect(uri).toBe(`file:///cache/exports/request-1/%5BServ00.com%5D%20Account%20activation%20tuuki.${extension}`);
    // File's constructor joins the URI once more before handing it to Android.
    expect(PathUtilities.join(uri)).toBe(uri);
    expect(decodeURIComponent(new URL(uri).pathname.split("/").at(-1)!)).toBe(filename);
  });

  test.each(["中文 [标题] 100% #1.png", "literal %5Bname%5D.png", "普通笔记.jpg"])("preserves the filename %s without double encoding", (filename) => {
    const uri = encodeMobileNoteImageFileUri(PathUtilities.join("file:///cache/exports/", filename));
    expect(uri).not.toMatch(/[[\]]/);
    expect(decodeURIComponent(new URL(uri).pathname.split("/").at(-1)!)).toBe(filename);
    expect(encodeMobileNoteImageFileUri(uri)).toBe(uri);
  });
});

describe("planMobileNoteImageRender", () => {
  test("keeps a short card at full quality", () => {
    expect(planMobileNoteImageRender(680, 1_000)).toEqual({
      pixelRatio: 2,
      sourceHeight: 1_000,
      sourceScale: 1,
      sourceWidth: 680,
    });
  });

  test("fits a long digest within the mobile image budget", () => {
    const plan = planMobileNoteImageRender(680, 20_000);
    expect(plan.sourceScale).toBe(0.75);
    expect(plan.sourceHeight).toBeLessThanOrEqual(15_000);
    expect(plan.sourceHeight * plan.pixelRatio).toBeLessThanOrEqual(15_000);
    expect(plan.sourceWidth * plan.sourceHeight * plan.pixelRatio ** 2).toBeLessThanOrEqual(12_000_000);
  });

  test("rejects a card that would be unreadable as one image", () => {
    expect(() => planMobileNoteImageRender(680, 40_000)).toThrow("NOTE_IMAGE_TOO_LONG");
  });
});
