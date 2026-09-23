import { inflateRawSync } from "node:zlib";
import { posix } from "node:path";

const MAX_ENTRIES = 1000;
const MAX_EXPANDED_BYTES = 512 * 1024 * 1024;
const MAX_TEXT_BYTES = 16 * 1024 * 1024;
const TRANSCRIPT_NAME = "聊天记录.txt";
const PREFERRED_MEDIA_DIRECTORY = "聊天记录内的图片、视频和文件/";
const MEDIA_LINE = /^\[(图片|视频|文件|语音)\]\s+(.+?)\s*$/;
const LINK_LINE = /^\[链接\]\s+(.+)$/;
const DATE_LINE = /^\d{4}年\d{1,2}月\d{1,2}日 \d{1,2}:\d{2}(?::\d{2})?$/;
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp"]);
const MIME_TYPES = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  mp4: "video/mp4",
  mov: "video/quicktime",
  m4v: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  pdf: "application/pdf",
};

const CRC_TABLE = new Uint32Array(256);
for (let index = 0; index < 256; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  CRC_TABLE[index] = value >>> 0;
}

const crc32 = (bytes) => {
  let value = 0xffffffff;
  for (const byte of bytes) value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
};

const readUInt16 = (bytes, offset) => {
  if (offset < 0 || offset + 2 > bytes.length) throw new WeChatArchiveError("invalid");
  return bytes.readUInt16LE(offset);
};

const readUInt32 = (bytes, offset) => {
  if (offset < 0 || offset + 4 > bytes.length) throw new WeChatArchiveError("invalid");
  return bytes.readUInt32LE(offset);
};

export class WeChatArchiveError extends Error {
  constructor(code) {
    super(code);
    this.name = "WeChatArchiveError";
    this.code = code;
  }
}

const extensionOf = (filename) => filename.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";

const mimeTypeFor = (filename) => MIME_TYPES[extensionOf(filename)] ?? "application/octet-stream";

const isImage = (filename) => IMAGE_EXTENSIONS.has(extensionOf(filename));

const escapeMarkdownText = (value) => value.replace(/[\\`*[\]_]/g, "\\$&");
const escapeMarkdownLabel = (value) => value.replace(/[\\[\]]/g, "\\$&");

const decodeUtf8 = (bytes) => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new WeChatArchiveError("invalid");
  }
};

const assertSafeEntryName = (name) => {
  if (!name || name.includes("\\") || name.includes("\0")) throw new WeChatArchiveError("invalid");
  const parts = name.split("/");
  if (parts.some((part) => part === ".." || part === ".")) throw new WeChatArchiveError("invalid");
  if (posix.isAbsolute(name)) throw new WeChatArchiveError("invalid");
};

const readZipEntries = (bytes) => {
  const data = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (data.length < 22 || data.length > MAX_EXPANDED_BYTES) throw new WeChatArchiveError("invalid");
  let end = -1;
  const earliest = Math.max(0, data.length - 22 - 65535);
  for (let offset = data.length - 22; offset >= earliest; offset -= 1) {
    if (readUInt32(data, offset) !== 0x06054b50) continue;
    if (offset + 22 + readUInt16(data, offset + 20) === data.length) {
      end = offset;
      break;
    }
  }
  if (end < 0) throw new WeChatArchiveError("invalid");
  if (readUInt16(data, end + 4) !== 0 || readUInt16(data, end + 6) !== 0) throw new WeChatArchiveError("invalid");
  const count = readUInt16(data, end + 8);
  const listed = readUInt16(data, end + 10);
  const directorySize = readUInt32(data, end + 12);
  let cursor = readUInt32(data, end + 16);
  if (count !== listed || count < 1 || count > MAX_ENTRIES || cursor + directorySize !== end) {
    throw new WeChatArchiveError("invalid");
  }

  const entries = [];
  let expandedTotal = 0;
  const seen = new Set();
  for (let index = 0; index < count; index += 1) {
    if (readUInt32(data, cursor) !== 0x02014b50) throw new WeChatArchiveError("invalid");
    const flags = readUInt16(data, cursor + 8);
    const method = readUInt16(data, cursor + 10);
    const crc = readUInt32(data, cursor + 16);
    const compressedSize = readUInt32(data, cursor + 20);
    const expandedSize = readUInt32(data, cursor + 24);
    const nameLength = readUInt16(data, cursor + 28);
    const extraLength = readUInt16(data, cursor + 30);
    const commentLength = readUInt16(data, cursor + 32);
    const localOffset = readUInt32(data, cursor + 42);
    if (flags & 1 || ![0, 8].includes(method) || compressedSize === 0xffffffff || expandedSize === 0xffffffff) {
      throw new WeChatArchiveError("invalid");
    }
    const nameBytes = data.subarray(cursor + 46, cursor + 46 + nameLength);
    const name = decodeUtf8(nameBytes);
    assertSafeEntryName(name);
    if (seen.has(name)) throw new WeChatArchiveError("invalid");
    seen.add(name);
    expandedTotal += expandedSize;
    if (expandedTotal > MAX_EXPANDED_BYTES || localOffset >= cursor) throw new WeChatArchiveError("invalid");
    entries.push({ name, method, crc, compressedSize, expandedSize, localOffset });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  if (cursor !== end) throw new WeChatArchiveError("invalid");

  return entries.map((entry) => {
    if (entry.name.endsWith("/")) {
      if (entry.expandedSize !== 0) throw new WeChatArchiveError("invalid");
      return { name: entry.name, data: Buffer.alloc(0) };
    }
    if (readUInt32(data, entry.localOffset) !== 0x04034b50) throw new WeChatArchiveError("invalid");
    if (readUInt16(data, entry.localOffset + 8) !== entry.method) throw new WeChatArchiveError("invalid");
    const start = entry.localOffset + 30 + readUInt16(data, entry.localOffset + 26) + readUInt16(data, entry.localOffset + 28);
    const compressed = data.subarray(start, start + entry.compressedSize);
    if (compressed.length !== entry.compressedSize) throw new WeChatArchiveError("invalid");
    const inflated = entry.method === 0 ? Buffer.from(compressed) : inflateRawSync(compressed);
    if (inflated.length !== entry.expandedSize || crc32(inflated) !== entry.crc) throw new WeChatArchiveError("invalid");
    return { name: entry.name, data: inflated };
  });
};

const isIgnoredEntry = (name) => {
  const base = posix.basename(name);
  return !base || base === ".DS_Store" || name.startsWith("__MACOSX/") || base.startsWith("._");
};

const isMessageHeader = (lines, index) =>
  index + 1 < lines.length && lines[index].startsWith("·") && DATE_LINE.test(lines[index + 1].trim());

const parseMessages = (text) => {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const messages = [];
  let index = 0;
  while (index < lines.length) {
    while (index < lines.length && lines[index].trim() === "") index += 1;
    if (index >= lines.length) break;
    if (!isMessageHeader(lines, index)) {
      index += 1;
      continue;
    }
    const sender = lines[index].slice(1).trim();
    const time = lines[index + 1].trim();
    index += 2;
    const body = [];
    while (index < lines.length) {
      if (lines[index].trim() === "") {
        let next = index + 1;
        while (next < lines.length && lines[next].trim() === "") next += 1;
        if (next >= lines.length || isMessageHeader(lines, next)) {
          index = next;
          break;
        }
      }
      if (isMessageHeader(lines, index)) break;
      body.push(lines[index]);
      index += 1;
    }
    messages.push({ sender, time, body });
  }
  return messages;
};

const parseLink = (line) => {
  const match = LINK_LINE.exec(line.trim());
  if (!match) return null;
  const urlMatch = match[1].match(/^(.*?)(https?:\/\/[^\s)]+)$/);
  if (!urlMatch) return null;
  const title = urlMatch[1].trim();
  if (!title) return null;
  return { title, url: urlMatch[2] };
};

const mediaMarkdown = (item) => {
  const label = escapeMarkdownLabel(item.filename);
  const url = `edgeever-wechat-media://${item.id}`;
  return isImage(item.filename) ? `![${label}](${url})` : `[附件：${label}](${url})`;
};

const renderBody = (lines, mediaByName) => lines.map((line) => {
  const mediaMatch = MEDIA_LINE.exec(line.trim());
  if (mediaMatch) {
    const item = mediaByName.get(posix.basename(mediaMatch[2]));
    if (item) {
      item.used = true;
      return mediaMarkdown(item);
    }
  }
  const link = parseLink(line);
  if (link) return `[${escapeMarkdownText(link.title)}](${link.url})`;
  return escapeMarkdownText(line);
}).join("\n\n");

const archiveTitle = (archiveName) => {
  const base = posix.basename(archiveName || "").replace(/\.zip$/i, "").trim();
  return base || "聊天记录";
};

/**
 * Turn one WeChat merged-forward ZIP into a note. The archive itself is not
 * part of the result; pictures land on the message that names them.
 */
export const wechatChatNoteFromArchive = (bytes, archiveName = TRANSCRIPT_NAME) => {
  const entries = readZipEntries(bytes).filter((entry) => !entry.name.endsWith("/") && !isIgnoredEntry(entry.name));
  const transcript = entries.find((entry) => posix.basename(entry.name) === TRANSCRIPT_NAME);
  if (!transcript || transcript.data.length === 0 || transcript.data.length > MAX_TEXT_BYTES) {
    throw new WeChatArchiveError("unrecognized");
  }
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(transcript.data).replace(/^\uFEFF/, "");
  } catch {
    throw new WeChatArchiveError("unrecognized");
  }

  const mediaEntries = entries.filter((entry) => entry !== transcript && entry.data.length > 0);
  const mediaByName = new Map();
  const ranked = [...mediaEntries].sort((left, right) => {
    const leftPreferred = left.name.startsWith(PREFERRED_MEDIA_DIRECTORY) ? 1 : 0;
    const rightPreferred = right.name.startsWith(PREFERRED_MEDIA_DIRECTORY) ? 1 : 0;
    return leftPreferred - rightPreferred;
  });
  const items = [];
  for (const entry of ranked) {
    const filename = posix.basename(entry.name);
    const existing = mediaByName.get(filename);
    const item = existing ?? {
      id: `m${items.length + 1}`,
      filename,
      mimeType: mimeTypeFor(filename),
      bytes: entry.data,
      used: false,
    };
    if (!existing) items.push(item);
    else item.bytes = entry.data;
    mediaByName.set(filename, item);
  }

  const messages = parseMessages(text);
  const sections = messages.length > 0
    ? messages.map((message) => {
      const body = renderBody(message.body, mediaByName);
      const header = `**${escapeMarkdownText(message.sender)}** · ${escapeMarkdownText(message.time)}`;
      return body ? `${header}\n\n${body}` : header;
    })
    : [escapeMarkdownText(text.trim())];
  const unused = items.filter((item) => !item.used).map((item) => mediaMarkdown(item));
  const markdown = [...sections, ...unused].filter(Boolean).join("\n\n").trim();
  if (!markdown) throw new WeChatArchiveError("unrecognized");
  return {
    title: archiveTitle(archiveName),
    markdown,
    media: items.map(({ id, filename, mimeType, bytes: mediaBytes }) => ({
      id,
      filename,
      mimeType,
      bytes: mediaBytes,
    })),
  };
};
