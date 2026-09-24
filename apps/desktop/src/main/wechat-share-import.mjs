import { randomUUID } from "node:crypto";
import { mkdir, readFile, realpath, readdir, rmdir, rm, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { WeChatArchiveError, wechatChatNoteFromArchive } from "./wechat-chat-archive.mjs";

export const WECHAT_INCOMING_DIRECTORY_NAME = "EdgeEver Incoming";
const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/;

export const isPathInsideDirectory = (filePath, directory) => {
  if (!filePath || !directory) return false;
  const root = resolve(directory);
  const candidate = resolve(filePath);
  const fromRoot = relative(root, candidate);
  return fromRoot !== "" && fromRoot !== ".." && !fromRoot.startsWith(`..${sep}`) && !isAbsolute(fromRoot);
};

export const wechatImportFilePath = (value) => {
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "edgeever:" || url.hostname !== "wechat-import") return null;
  const filePath = url.searchParams.get("path");
  if (!filePath || !isAbsolute(filePath) || filePath.includes("\0")) return null;
  return filePath;
};

const incomingDirectory = (downloadsPath) => join(downloadsPath, WECHAT_INCOMING_DIRECTORY_NAME);

const assertIncomingZip = async (filePath, downloadsPath) => {
  const root = incomingDirectory(downloadsPath);
  if (!isPathInsideDirectory(filePath, root) || !filePath.toLowerCase().endsWith(".zip")) {
    throw new WeChatArchiveError("rejected-path");
  }
  const [realRoot, realFile] = await Promise.all([realpath(root), realpath(filePath)]);
  if (!isPathInsideDirectory(realFile, realRoot)) throw new WeChatArchiveError("rejected-path");
  return realFile;
};

const removeImportedZip = async (zipPath, downloadsPath) => {
  if (!zipPath) return;
  const root = await realpath(incomingDirectory(downloadsPath)).catch(() => null);
  const parent = dirname(zipPath);
  const realParent = await realpath(parent).catch(() => null);
  if (root && realParent && isPathInsideDirectory(realParent, root)) {
    await rm(zipPath, { force: true }).catch(() => {});
    await rmdir(realParent).catch(() => {});
    return;
  }
};

export const createWeChatShareController = ({
  downloadsPath,
  tempPath,
  sendToRenderer,
  onActivity = () => {},
  writeDiagnostic = () => {},
}) => {
  const sessions = new Map();
  const preparedPaths = new Set();
  const inFlightPaths = new Set();
  const completedPaths = new Set();
  const failedPaths = new Set();

  const finish = async (importId, success) => {
    if (!SAFE_ID.test(importId || "")) return;
    const session = sessions.get(importId);
    if (!session) return;
    if (!success) {
      session.failed = true;
      failedPaths.add(session.zipPath);
      void writeDiagnostic("wechat-import.save-failed");
      return;
    }
    sessions.delete(importId);
    preparedPaths.delete(session.zipPath);
    completedPaths.add(session.zipPath);
    failedPaths.delete(session.zipPath);
    await removeImportedZip(session.zipPath, downloadsPath());
    await rm(session.directory, { recursive: true, force: true }).catch(() => {});
    void writeDiagnostic("wechat-import.saved", { media: session.media.size });
  };

  const retry = (importId) => {
    if (!SAFE_ID.test(importId || "")) return false;
    const session = sessions.get(importId);
    if (!session?.failed) return false;
    session.failed = false;
    failedPaths.delete(session.zipPath);
    sendToRenderer(session.payload);
    return true;
  };

  const readMedia = async (importId, mediaId) => {
    if (!SAFE_ID.test(importId || "") || !SAFE_ID.test(mediaId || "")) {
      throw new WeChatArchiveError("rejected-path");
    }
    const session = sessions.get(importId);
    const media = session?.media.get(mediaId);
    if (!media) throw new WeChatArchiveError("missing-media");
    const bytes = await readFile(media.path);
    if (bytes.length !== media.byteSize) throw new WeChatArchiveError("invalid");
    return { filename: media.filename, mimeType: media.mimeType, bytes };
  };

  const importFromProtocolUrl = async (value) => {
    const requestedPath = wechatImportFilePath(value);
    if (!requestedPath || inFlightPaths.has(requestedPath) || preparedPaths.has(requestedPath)
      || completedPaths.has(requestedPath) || failedPaths.has(requestedPath)) return;
    inFlightPaths.add(requestedPath);
    onActivity();
    const downloads = downloadsPath();
    let zipPath = null;
    let preparedDirectory = null;
    try {
      zipPath = await assertIncomingZip(requestedPath, downloads);
      const archive = await readFile(zipPath);
      const note = wechatChatNoteFromArchive(archive, basename(zipPath));
      const importId = randomUUID();
      const directory = join(tempPath(), "edgeever-wechat-import", importId);
      preparedDirectory = directory;
      await mkdir(directory, { recursive: true });
      const media = new Map();
      const listed = [];
      for (const item of note.media) {
        const path = join(directory, `${item.id}.bin`);
        await writeFile(path, item.bytes);
        media.set(item.id, {
          filename: item.filename,
          mimeType: item.mimeType,
          byteSize: item.bytes.length,
          path,
        });
        listed.push({
          id: item.id,
          filename: item.filename,
          mimeType: item.mimeType,
          byteSize: item.bytes.length,
        });
      }
      const payload = {
        ok: true,
        importId,
        title: note.title,
        markdown: note.markdown,
        media: listed,
      };
      sessions.set(importId, { directory, media, zipPath, payload, failed: false });
      preparedPaths.add(requestedPath);
      preparedDirectory = null;
      sendToRenderer(payload);
      void writeDiagnostic("wechat-import.prepared", { media: listed.length, bytes: archive.length });
    } catch (error) {
      if (preparedDirectory) await rm(preparedDirectory, { recursive: true, force: true }).catch(() => {});
      const reason = error instanceof WeChatArchiveError ? error.code : "failed";
      failedPaths.add(requestedPath);
      sendToRenderer({ ok: false, reason: reason === "unrecognized" ? "unrecognized" : "failed" });
      void writeDiagnostic("wechat-import.rejected", { reason });
    } finally {
      inFlightPaths.delete(requestedPath);
    }
  };

  const importPending = async () => {
    const root = incomingDirectory(downloadsPath());
    const batches = await readdir(root, { withFileTypes: true }).catch(() => []);
    for (const batch of batches) {
      if (!batch.isDirectory()) continue;
      const directory = join(root, batch.name);
      const files = await readdir(directory, { withFileTypes: true }).catch(() => []);
      for (const file of files) {
        if (!file.isFile() || !file.name.toLowerCase().endsWith(".zip")) continue;
        const url = new URL("edgeever://wechat-import");
        url.searchParams.set("path", join(directory, file.name));
        await importFromProtocolUrl(url.href);
      }
    }
  };

  return { importFromProtocolUrl, importPending, readMedia, finish, retry };
};
