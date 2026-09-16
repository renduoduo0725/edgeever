import { execFile as execFileCallback } from "node:child_process";
import { readFile, stat, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFileCallback);
const MAC_SCREENCAPTURE = "/usr/sbin/screencapture";

export const macScreencaptureArgs = (outputPath) => ["-x", "-t", "png", outputPath];

export const normalizeIpcBytes = (value) => {
  if (value instanceof Uint8Array) {
    const copy = new Uint8Array(value.byteLength);
    copy.set(value);
    return copy;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value.slice(0));
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
  }
  if (Array.isArray(value)) {
    return Uint8Array.from(value);
  }
  if (value && typeof value === "object" && value.type === "Buffer") {
    return normalizeIpcBytes(value.data);
  }
  return new Uint8Array();
};

export const screenshotImportIpcPayload = (captured) => ({
  name: captured.name,
  type: captured.type,
  title: captured.title,
  bytes: normalizeIpcBytes(captured.bytes),
});

// Full-screen capture finishes in a few hundred milliseconds. macOS/Electron
// tray menus can deliver the same click twice after that, so keep the capture
// locked through a short cooldown instead of releasing it in the same tick.
export const SCREENSHOT_CAPTURE_COOLDOWN_MS = 2000;

export const createScreenshotCaptureGuard = ({
  cooldownMs = SCREENSHOT_CAPTURE_COOLDOWN_MS,
  schedule = setTimeout,
  cancel = clearTimeout,
} = {}) => {
  let inFlight = false;
  let cooldownTimer = null;
  return {
    tryBegin() {
      if (inFlight) return false;
      inFlight = true;
      if (cooldownTimer != null) {
        cancel(cooldownTimer);
        cooldownTimer = null;
      }
      return true;
    },
    end() {
      if (cooldownTimer != null) cancel(cooldownTimer);
      cooldownTimer = schedule(() => {
        inFlight = false;
        cooldownTimer = null;
      }, cooldownMs);
    },
  };
};

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

export const captureMacScreenScreenshot = async ({
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

export const captureDisplayScreenshot = async ({ desktopCapturer, screen }) => {
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
  return screenshotBytes;
};

export const captureScreenToNote = async (input) => {
  const bytes = input.platform === "darwin"
    ? await captureMacScreenScreenshot(input)
    : await captureDisplayScreenshot(input);
  if (!bytes || bytes.byteLength === 0) return null;
  const capturedAt = input.now ? new Date(input.now) : new Date();
  return {
    bytes: normalizeIpcBytes(bytes),
    name: screenshotFileName(capturedAt),
    type: "image/png",
    title: screenshotNoteTitle(input.locale, capturedAt),
  };
};

export const writeScreenshotTempPath = (root = tmpdir()) =>
  join(root, `edgeever-screenshot-${Date.now()}-${Math.random().toString(16).slice(2)}.png`);
