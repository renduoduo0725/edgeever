import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  clampCropRect,
  cropCapturedImage,
  isScreenshotCancelledExit,
  isUsableCropRect,
  macScreencaptureArgs,
  readCapturedScreenshot,
  screenshotFileName,
  screenshotNoteTitle,
} from "./screenshot-capture.mjs";

const mainSource = readFileSync(new URL("./index.mjs", import.meta.url), "utf8");
const preloadSource = readFileSync(new URL("../preload/index.cjs", import.meta.url), "utf8");
const workspaceSource = readFileSync(new URL("../../../web/src/components/WorkspaceApp.tsx", import.meta.url), "utf8");

describe("screenshot capture helpers", () => {
  test("uses macOS interactive capture without a shutter sound", () => {
    expect(macScreencaptureArgs("/tmp/capture.png")).toEqual(["-i", "-x", "-t", "png", "/tmp/capture.png"]);
  });

  test("treats screencapture cancel exit codes as a quiet abort", () => {
    expect(isScreenshotCancelledExit({ code: 1 })).toBe(true);
    expect(isScreenshotCancelledExit({ code: 2 })).toBe(true);
    expect(isScreenshotCancelledExit({ code: "ENOENT" })).toBe(false);
  });

  test("clamps and rejects tiny crop rectangles", () => {
    expect(clampCropRect({ x: -8, y: 2.8, width: 40, height: 12 }, { width: 20, height: 10 })).toEqual({
      x: 0,
      y: 3,
      width: 20,
      height: 7,
    });
    expect(isUsableCropRect({ width: 3, height: 40 })).toBe(false);
    expect(isUsableCropRect({ width: 8, height: 8 })).toBe(true);
  });

  test("crops a captured image in physical pixels", () => {
    const cropped = [];
    const image = {
      getSize: () => ({ width: 200, height: 100 }),
      crop: (rect) => {
        cropped.push(rect);
        return { toPNG: () => Buffer.from("png") };
      },
    };

    expect(cropCapturedImage(image, { x: 10, y: 5, width: 20, height: 10 }, 2)).toEqual(Buffer.from("png"));
    expect(cropped).toEqual([{ x: 20, y: 10, width: 40, height: 20 }]);
    expect(cropCapturedImage(image, { x: 0, y: 0, width: 1, height: 1 }, 1)).toBeNull();
  });

  test("returns null when the user cancelled before a file was written", async () => {
    const bytes = await readCapturedScreenshot("/missing.png", {
      readFile: async () => Buffer.from("png"),
      unlink: async () => {},
      stat: async () => {
        const error = new Error("missing");
        error.code = "ENOENT";
        throw error;
      },
    });
    expect(bytes).toBeNull();
  });

  test("localizes the generated note title", () => {
    const date = new Date(2026, 8, 14, 11, 8, 3);
    expect(screenshotNoteTitle("zh-CN", date)).toBe("截图 2026-09-14 11:08");
    expect(screenshotNoteTitle("en-US", date)).toBe("Screenshot 2026-09-14 11:08");
    expect(screenshotFileName(date)).toBe("screenshot-20260914-110803.png");
  });
});

describe("desktop screenshot to note wiring", () => {
  test("replaces the tray sync and backup actions with screenshot capture", () => {
    expect(mainSource).toContain("captureScreenshotToNote");
    expect(mainSource).toContain("copy.screenshotToNote");
    expect(mainSource).not.toContain('label: copy.syncNow, click: () => sendDesktopCommand("sync-now")');
    expect(mainSource).not.toContain('label: copy.backupNow, click: () => sendDesktopCommand("backup-now")');
    expect(preloadSource).toContain("onImportScreenshot");
    expect(workspaceSource).toContain("onImportScreenshot");
    expect(workspaceSource).toContain("setPendingEditorInsert");
  });
});
