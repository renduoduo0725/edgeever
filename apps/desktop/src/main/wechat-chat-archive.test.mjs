import { deflateRawSync } from "node:zlib";
import { describe, expect, test } from "bun:test";
import { WeChatArchiveError, wechatChatNoteFromArchive } from "./wechat-chat-archive.mjs";

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

const u16 = (value) => {
  const bytes = Buffer.alloc(2);
  bytes.writeUInt16LE(value);
  return bytes;
};

const u32 = (value) => {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32LE(value >>> 0);
  return bytes;
};

const zipOf = (entries) => {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const data = Buffer.from(entry.data);
    const method = entry.method ?? 0;
    const compressed = method === 8 ? deflateRawSync(data) : data;
    const crc = crc32(data);
    const local = Buffer.concat([
      u32(0x04034b50), u16(20), u16(0x0800), u16(method), u16(0), u16(0),
      u32(crc), u32(compressed.length), u32(data.length), u16(name.length), u16(0),
      name, compressed,
    ]);
    const central = Buffer.concat([
      u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(method), u16(0), u16(0),
      u32(crc), u32(compressed.length), u32(data.length), u16(name.length), u16(0), u16(0),
      u16(0), u16(0), u32(0), u32(offset), name,
    ]);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }
  const directory = Buffer.concat(centrals);
  return Buffer.concat([
    ...locals,
    directory,
    u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length),
    u32(directory.length), u32(offset), u16(0),
  ]);
};

const transcript = [
  "·鱼",
  "2026年9月22日 22:15",
  "[链接] 发布说明 https://example.com/post",
  "",
  "·Flechazo",
  "2026年9月22日 22:15",
  "[图片] 微信图片_202609222215_1.jpg",
  "",
  "·鱼",
  "2026年9月22日 22:16",
  "[发呆]还没注册",
  "",
  "·鱼",
  "2026年9月22日 22:19",
  "[动画表情]",
  "",
  "·鱼",
  "2026年9月22日 22:20",
  "[视频] 微信视频_1.mp4",
  "",
].join("\n");

const sampleArchive = () => zipOf([
  { name: "聊天记录.txt", data: transcript, method: 8 },
  { name: "聊天记录内的图片、视频和文件/微信图片_202609222215_1.jpg", data: "jpeg-bytes", method: 0 },
  { name: "聊天记录内的图片、视频和文件/微信视频_1.mp4", data: "video-bytes", method: 8 },
  { name: "聊天记录内的图片、视频和文件/说明.pdf", data: "pdf-bytes" },
]);

describe("WeChat chat archive", () => {
  test("turns the exported zip into messages, an inline image, and attachments", () => {
    const note = wechatChatNoteFromArchive(sampleArchive(), "聊天记录_20260922_223222.zip");
    expect(note.title).toBe("聊天记录_20260922_223222");
    expect(note.markdown).toContain("**鱼** · 2026年9月22日 22:15");
    expect(note.markdown).toContain("[发布说明](https://example.com/post)");
    expect(note.markdown).toContain("![微信图片_202609222215_1.jpg](edgeever-wechat-media://m1)");
    expect(note.markdown).toContain("\\[发呆\\]还没注册");
    expect(note.markdown).toContain("\\[动画表情\\]");
    expect(note.markdown).toContain("[附件：微信视频_1.mp4](edgeever-wechat-media://m2)");
    expect(note.markdown).toContain("[附件：说明.pdf](edgeever-wechat-media://m3)");
    expect(note.markdown).not.toContain(".zip");
    expect(note.media.map((item) => [item.filename, item.mimeType, Buffer.from(item.bytes).toString()])).toEqual([
      ["微信图片_202609222215_1.jpg", "image/jpeg", "jpeg-bytes"],
      ["微信视频_1.mp4", "video/mp4", "video-bytes"],
      ["说明.pdf", "application/pdf", "pdf-bytes"],
    ]);
  });

  test("adds the first message time when WeChat provides only a generic archive name", () => {
    expect(wechatChatNoteFromArchive(sampleArchive(), "聊天记录.zip").title).toBe("聊天记录 · 2026-09-22 22:15");
    expect(wechatChatNoteFromArchive(sampleArchive()).title).toBe("聊天记录 · 2026-09-22 22:15");
    const withoutMessages = zipOf([{ name: "聊天记录.txt", data: "无法识别时间的旧聊天记录" }]);
    expect(wechatChatNoteFromArchive(withoutMessages, "聊天记录.zip").title).toBe("聊天记录");
  });

  test("preserves transcript text that does not match a message header", () => {
    const archive = zipOf([{ name: "聊天记录.txt", data: [
      "聊天开始前的说明",
      "·鱼",
      "2026年9月22日 22:15",
      "你好",
      "",
      "[系统消息] 群名已更改",
      "",
      "·鱼",
      "2026年9月22日 22:16",
      "收到",
    ].join("\n") }]);
    const note = wechatChatNoteFromArchive(archive, "聊天记录.zip");
    expect(note.title).toBe("聊天记录 · 2026-09-22 22:15");
    expect(note.markdown).toContain("聊天开始前的说明");
    expect(note.markdown).toContain("\\[系统消息\\] 群名已更改");
    expect(note.markdown).toContain("收到");
  });

  test("rejects archives that are not a WeChat transcript", () => {
    expect(() => wechatChatNoteFromArchive(zipOf([{ name: "readme.txt", data: "hello" }]))).toThrow(WeChatArchiveError);
    expect(() => wechatChatNoteFromArchive(Buffer.from("not a zip"))).toThrow(WeChatArchiveError);
    expect(() => wechatChatNoteFromArchive(zipOf([{ name: "../聊天记录.txt", data: transcript }]))).toThrow(WeChatArchiveError);
  });
});
