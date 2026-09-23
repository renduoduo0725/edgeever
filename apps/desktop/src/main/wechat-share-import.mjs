import { randomUUID } from "node:crypto";
import { mkdir, readFile, realpath, readdir, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { WeChatArchiveError, wechatChatNoteFromArchive } from "./wechat-chat-archive.mjs";

export const WECHAT_INCOMING_DIRECTORY_NAME = "EdgeEver Incoming";
const STALE_INCOMING_MS = 24 * 60 * 60 * 1000;
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
    await rm(realParent, { recursive: true, force: true }).catch(() => {});
    return;
  }
  await rm(zipPath, { force: true }).catch(() => {});
};

const removeStaleIncoming = async (downloadsPath, keepPath) => {
  const root = incomingDirectory(downloadsPath);
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const cutoff = Date.now() - STALE_INCOMING_MS;
  await Promise.all(entries.map(async (entry) => {
    const path = join(root, entry.name);
    if (keepPath && (path === keepPath || keepPath.startsWith(`${path}${sep}`))) return;
    const info = await stat(path).catch(() => null);
    if (!info || info.mtimeMs > cutoff) return;
    await rm(path, { recursive: true, force: true }).catch(() => {});
  }));
};

export const createWeChatShareController = ({
  downloadsPath,
  tempPath,
  sendToRenderer,
  onActivity = () => {},
  writeDiagnostic = () => {},
}) => {
  const sessions = new Map();

  const finish = async (importId) => {
    if (!SAFE_ID.test(importId || "")) return;
    const session = sessions.get(importId);
    sessions.delete(importId);
    if (!session) return;
    await rm(session.directory, { recursive: true, force: true }).catch(() => {});
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
    if (!requestedPath) return;
    onActivity();
    const downloads = downloadsPath();
    let zipPath = null;
    let preparedDirectory = null;
    try {
      await removeStaleIncoming(downloads, requestedPath);
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
      sessions.set(importId, { directory, media });
      preparedDirectory = null;
      sendToRenderer({
        ok: true,
        importId,
        title: note.title,
        markdown: note.markdown,
        media: listed,
      });
      void writeDiagnostic("wechat-import.accepted", { media: listed.length, bytes: archive.length });
    } catch (error) {
      if (preparedDirectory) await rm(preparedDirectory, { recursive: true, force: true }).catch(() => {});
      const reason = error instanceof WeChatArchiveError ? error.code : "failed";
      sendToRenderer({ ok: false, reason: reason === "unrecognized" ? "unrecognized" : "failed" });
      void writeDiagnostic("wechat-import.rejected", { reason });
    } finally {
      await removeImportedZip(zipPath, downloads);
    }
  };

  return { importFromProtocolUrl, readMedia, finish };
};
