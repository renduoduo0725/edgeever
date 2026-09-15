import { execFile as execFileCallback } from "node:child_process";
import { readFile, stat, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFileCallback);
const MAC_SCREENCAPTURE = "/usr/sbin/screencapture";
const MIN_CROP_EDGE = 4;

export const macScreencaptureArgs = (outputPath) => ["-i", "-x", "-t", "png", outputPath];

export const isChineseDesktopLocale = (locale) =>
  typeof locale === "string" && locale.toLowerCase().startsWith("zh");

const pad2 = (value) => String(value).padStart(2, "0");

export const screenshotStamp = (date = new Date()) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

export const screenshotNoteTitle = (locale, date = new Date()) =>
  isChineseDesktopLocale(locale) ? `截图 ${screenshotStamp(date)}` : `Screenshot ${screenshotStamp(date)}`;

export const screenshotFileName = (date = new Date()) =>
  `screenshot-${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}-${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}.png`;

export const isScreenshotCancelledExit = (error) => {
  const code = error && typeof error === "object" ? error.code : null;
  return code === 1 || code === 2;
};

export const clampCropRect = (rect, imageSize) => {
  const x = Math.max(0, Math.round(Number(rect?.x) || 0));
  const y = Math.max(0, Math.round(Number(rect?.y) || 0));
  const width = Math.max(0, Math.round(Number(rect?.width) || 0));
  const height = Math.max(0, Math.round(Number(rect?.height) || 0));
  const maxWidth = Math.max(0, Math.round(Number(imageSize?.width) || 0) - x);
  const maxHeight = Math.max(0, Math.round(Number(imageSize?.height) || 0) - y);
  return {
    x,
    y,
    width: Math.min(width, maxWidth),
    height: Math.min(height, maxHeight),
  };
};

export const isUsableCropRect = (rect) =>
  Boolean(rect) && rect.width >= MIN_CROP_EDGE && rect.height >= MIN_CROP_EDGE;

export const readCapturedScreenshot = async (outputPath, io = { readFile, unlink, stat }) => {
  try {
    const info = await io.stat(outputPath);
    if (!info.size) {
      await io.unlink(outputPath).catch(() => {});
      return null;
    }
    const bytes = await io.readFile(outputPath);
    await io.unlink(outputPath).catch(() => {});
    return bytes;
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return null;
    throw error;
  }
};

export const captureMacInteractiveScreenshot = async ({
  execFile = execFileAsync,
  outputPath,
  readFile: readCapturedFile = readFile,
  unlink: unlinkCapturedFile = unlink,
  stat: statCapturedFile = stat,
} = {}) => {
  if (!outputPath) throw new Error("Screenshot output path is required");
  try {
    await execFile(MAC_SCREENCAPTURE, macScreencaptureArgs(outputPath));
  } catch (error) {
    await unlinkCapturedFile(outputPath).catch(() => {});
    if (isScreenshotCancelledExit(error)) return null;
    throw error;
  }
  return readCapturedScreenshot(outputPath, {
    readFile: readCapturedFile,
    unlink: unlinkCapturedFile,
    stat: statCapturedFile,
  });
};

const toPngBytes = (image) => {
  const png = image?.toPNG?.();
  return png && png.byteLength > 0 ? png : null;
};

const displayThumbnailSize = (display) => ({
  width: Math.max(1, Math.round((display.size?.width || 0) * (display.scaleFactor || 1))),
  height: Math.max(1, Math.round((display.size?.height || 0) * (display.scaleFactor || 1))),
});

const matchCaptureSource = (sources, display) => {
  if (!Array.isArray(sources) || sources.length === 0) return null;
  const displayId = display?.id == null ? "" : String(display.id);
  return sources.find((source) => source && String(source.display_id) === displayId) || sources[0];
};

export const cropCapturedImage = (image, rect, scaleFactor = 1) => {
  const size = image?.getSize?.() || { width: 0, height: 0 };
  const crop = clampCropRect({
    x: (Number(rect?.x) || 0) * scaleFactor,
    y: (Number(rect?.y) || 0) * scaleFactor,
    width: (Number(rect?.width) || 0) * scaleFactor,
    height: (Number(rect?.height) || 0) * scaleFactor,
  }, size);
  if (!isUsableCropRect(crop)) return null;
  return toPngBytes(image.crop(crop));
};

export const captureRegionScreenshot = async ({
  BrowserWindow,
  desktopCapturer,
  screen,
  ipcMain,
  overlayHtmlPath,
  overlayPreloadPath,
}) => {
  const point = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(point);
  const thumbnailSize = displayThumbnailSize(display);
  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize,
  });
  const source = matchCaptureSource(sources, display);
  const thumbnail = source?.thumbnail;
  if (!thumbnail || thumbnail.isEmpty()) {
    throw new Error("Screen capture is unavailable");
  }

  const screenshotBytes = toPngBytes(thumbnail);
  if (!screenshotBytes) throw new Error("Screen capture is unavailable");

  return await new Promise((resolve, reject) => {
    const completeChannel = "desktop:screenshot-overlay-complete";
    const cancelChannel = "desktop:screenshot-overlay-cancel";
    let settled = false;
    const overlay = new BrowserWindow({
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
      frame: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      hasShadow: false,
      show: false,
      hiddenInMissionControl: true,
      webPreferences: {
        preload: overlayPreloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    overlay.setAlwaysOnTop(true, "screen-saver");

    const finish = (result, error) => {
      if (settled) return;
      settled = true;
      ipcMain.removeListener(completeChannel, onComplete);
      ipcMain.removeListener(cancelChannel, onCancel);
      if (!overlay.isDestroyed()) overlay.close();
      if (error) reject(error);
      else resolve(result);
    };

    const onComplete = (_event, rect) => {
      try {
        finish(cropCapturedImage(thumbnail, rect, display.scaleFactor || 1));
      } catch (error) {
        finish(null, error);
      }
    };
    const onCancel = () => finish(null);

    ipcMain.on(completeChannel, onComplete);
    ipcMain.on(cancelChannel, onCancel);
    overlay.on("closed", () => finish(null));
    overlay.webContents.once("did-finish-load", () => {
      overlay.webContents.send("desktop:screenshot-overlay-init", { bytes: screenshotBytes });
      overlay.show();
      overlay.focus();
    });
    overlay.loadFile(overlayHtmlPath).catch((error) => finish(null, error));
  });
};

export const captureInteractiveScreenshot = async (input) => {
  const bytes = input.platform === "darwin"
    ? await captureMacInteractiveScreenshot(input)
    : await captureRegionScreenshot(input);
  if (!bytes) return null;
  const capturedAt = input.now ? new Date(input.now) : new Date();
  return {
    bytes,
    name: screenshotFileName(capturedAt),
    type: "image/png",
    title: screenshotNoteTitle(input.locale, capturedAt),
  };
};

export const writeScreenshotTempPath = (root = tmpdir()) =>
  join(root, `edgeever-screenshot-${Date.now()}-${Math.random().toString(16).slice(2)}.png`);
