import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  captureDisplayScreenshot,
  createScreenshotCaptureGuard,
  isScreenshotCancelledExit,
  macScreencaptureArgs,
  normalizeIpcBytes,
  readCapturedScreenshot,
  screenshotFileName,
  screenshotImportIpcPayload,
  screenshotNoteTitle,
} from "./screenshot-capture.mjs";

const mainSource = readFileSync(new URL("./index.mjs", import.meta.url), "utf8");
const preloadSource = readFileSync(new URL("../preload/index.cjs", import.meta.url), "utf8");
const workspaceSource = readFileSync(new URL("../../../web/src/components/WorkspaceApp.tsx", import.meta.url), "utf8");

describe("screenshot capture helpers", () => {
  test("captures the full screen on macOS without an interactive selection", () => {
    expect(macScreencaptureArgs("/tmp/capture.png")).toEqual(["-x", "-t", "png", "/tmp/capture.png"]);
  });

  test("treats screencapture cancel exit codes as a quiet abort", () => {
    expect(isScreenshotCancelledExit({ code: 1 })).toBe(true);
    expect(isScreenshotCancelledExit({ code: 2 })).toBe(true);
    expect(isScreenshotCancelledExit({ code: "ENOENT" })).toBe(false);
  });

  test("captures the display under the cursor without a crop overlay", async () => {
    const bytes = await captureDisplayScreenshot({
      screen: {
        getCursorScreenPoint: () => ({ x: 10, y: 10 }),
        getDisplayNearestPoint: () => ({
          id: 2,
          size: { width: 100, height: 50 },
          scaleFactor: 2,
        }),
      },
      desktopCapturer: {
        getSources: async (options) => {
          expect(options).toEqual({ types: ["screen"], thumbnailSize: { width: 200, height: 100 } });
          return [{
            display_id: "2",
            thumbnail: {
              isEmpty: () => false,
              toPNG: () => Buffer.from("png"),
            },
          }];
        },
      },
    });
    expect(bytes).toEqual(Buffer.from("png"));
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

  test("restores Electron Buffer JSON instead of constructing an empty typed array", () => {
    const encoded = { type: "Buffer", data: [137, 80, 78, 71] };
    expect(new Uint8Array(encoded).byteLength).toBe(0);
    expect(Array.from(normalizeIpcBytes(encoded))).toEqual([137, 80, 78, 71]);
    expect(Array.from(screenshotImportIpcPayload({
      name: "screenshot.png",
      type: "image/png",
      title: "截图",
      bytes: Buffer.from([1, 2, 3]),
    }).bytes)).toEqual([1, 2, 3]);
  });
});

describe("screenshot capture guard", () => {
  test("rejects a second capture until the cooldown elapses", () => {
    const timers = [];
    const guard = createScreenshotCaptureGuard({
      cooldownMs: 20,
      schedule: (fn) => {
        timers.push(fn);
        return timers.length;
      },
      cancel: () => {},
    });
    expect(guard.tryBegin()).toBe(true);
    expect(guard.tryBegin()).toBe(false);
    guard.end();
    expect(guard.tryBegin()).toBe(false);
    timers.at(-1)();
    expect(guard.tryBegin()).toBe(true);
  });
});

describe("desktop screenshot to note wiring", () => {
  test("replaces the tray sync and backup actions with screenshot capture", () => {
    expect(mainSource).toContain("captureScreenshotToNote");
    expect(mainSource).toContain("captureScreenToNote");
    expect(mainSource).toContain("createScreenshotCaptureGuard");
    expect(mainSource).toContain("pendingScreenshotImport = null");
    expect(mainSource).not.toContain("overlay.html");
    expect(mainSource).toContain("copy.screenshotToNote");
    expect(mainSource).not.toContain('label: copy.syncNow, click: () => sendDesktopCommand("sync-now")');
    expect(mainSource).not.toContain('label: copy.backupNow, click: () => sendDesktopCommand("backup-now")');
    expect(preloadSource).toContain("onImportScreenshot");
    expect(preloadSource).toContain("screenshotImportListener");
    expect(preloadSource).toContain('value.type === "Buffer"');
    expect(workspaceSource).toContain("onImportScreenshot");
    expect(workspaceSource).toContain("createScreenshotMemo");
    expect(workspaceSource).toContain("screenshotImportGate");
    expect(workspaceSource).toContain("screenshotFileFromImportPayload");
    expect(workspaceSource).not.toContain("setPendingEditorInsert");
  });
});
