import { deflateRawSync } from "node:zlib";
import { mkdir, mkdtemp, readFile, rename, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import {
  WECHAT_INCOMING_DIRECTORY_NAME,
  createWeChatShareController,
  isPathInsideDirectory,
  wechatImportFilePath,
} from "./wechat-share-import.mjs";

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
const zipOf = (name, text, extraName, extra) => {
  const files = [
    { name, data: Buffer.from(text) },
    { name: extraName, data: Buffer.from(extra) },
  ];
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const file of files) {
    const entryName = Buffer.from(file.name, "utf8");
    const compressed = deflateRawSync(file.data);
    const crc = crc32(file.data);
    const local = Buffer.concat([
      u32(0x04034b50), u16(20), u16(0x0800), u16(8), u16(0), u16(0),
      u32(crc), u32(compressed.length), u32(file.data.length), u16(entryName.length), u16(0),
      entryName, compressed,
    ]);
    centrals.push(Buffer.concat([
      u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(8), u16(0), u16(0),
      u32(crc), u32(compressed.length), u32(file.data.length), u16(entryName.length), u16(0), u16(0),
      u16(0), u16(0), u32(0), u32(offset), entryName,
    ]));
    locals.push(local);
    offset += local.length;
  }
  const directory = Buffer.concat(centrals);
  return Buffer.concat([
    ...locals, directory,
    u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(directory.length), u32(offset), u16(0),
  ]);
};

const roots = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("WeChat share handoff", () => {
  test("accepts only an absolute file from the edgeever share URL", () => {
    expect(wechatImportFilePath("edgeever://wechat-import?path=/Users/me/Downloads/EdgeEver%20Incoming/a/chat.zip")).toBe(
      "/Users/me/Downloads/EdgeEver Incoming/a/chat.zip",
    );
    expect(wechatImportFilePath("edgeever://memo/memo_1")).toBeNull();
    expect(wechatImportFilePath("https://example.com/chat.zip")).toBeNull();
    expect(wechatImportFilePath("edgeever://wechat-import?path=chat.zip")).toBeNull();
    expect(isPathInsideDirectory("/tmp/in/uuid/chat.zip", "/tmp/in")).toBe(true);
    expect(isPathInsideDirectory("/tmp/in", "/tmp/in")).toBe(false);
    expect(isPathInsideDirectory("/tmp/other/chat.zip", "/tmp/in")).toBe(false);
  });

  test("imports a zip from the incoming folder and then deletes it", async () => {
    const root = await mkdtemp(join(tmpdir(), "edgeever-wechat-share-"));
    roots.push(root);
    const downloads = join(root, "Downloads");
    const temp = join(root, "temp");
    const batch = join(downloads, WECHAT_INCOMING_DIRECTORY_NAME, "batch");
    await mkdir(batch, { recursive: true });
    const zipPath = join(batch, "聊天记录_20260922_223222.zip");
    await writeFile(zipPath, zipOf(
      "聊天记录.txt",
      "·鱼\n2026年9月22日 22:15\n[图片] 微信图片_1.jpg\n",
      "聊天记录内的图片、视频和文件/微信图片_1.jpg",
      "jpeg",
    ));
    const sent = [];
    const controller = createWeChatShareController({
      downloadsPath: () => downloads,
      tempPath: () => temp,
      sendToRenderer: (payload) => sent.push(payload),
    });
    const url = `edgeever://wechat-import?path=${encodeURIComponent(zipPath)}`;
    await controller.importFromProtocolUrl(url);
    expect(sent).toHaveLength(1);
    expect(sent[0].ok).toBe(true);
    expect(sent[0].title).toBe("聊天记录_20260922_223222");
    expect(sent[0].markdown).toContain("![微信图片_1.jpg](edgeever-wechat-media://m1)");
    const media = await controller.readMedia(sent[0].importId, "m1");
    expect(Buffer.from(media.bytes).toString()).toBe("jpeg");
    expect((await stat(zipPath)).isFile()).toBe(true);
    await controller.finish(sent[0].importId, true);
    await expect(stat(zipPath)).rejects.toThrow();
    await expect(stat(batch)).rejects.toThrow();
    await expect(readFile(join(temp, "edgeever-wechat-import", sent[0].importId, "m1.bin"))).rejects.toThrow();
  });

  test("does not read a zip outside the incoming folder", async () => {
    const root = await mkdtemp(join(tmpdir(), "edgeever-wechat-share-"));
    roots.push(root);
    const outside = join(root, "secret.zip");
    await writeFile(outside, Buffer.from("secret"));
    const sent = [];
    const controller = createWeChatShareController({
      downloadsPath: () => join(root, "Downloads"),
      tempPath: () => join(root, "temp"),
      sendToRenderer: (payload) => sent.push(payload),
    });
    await controller.importFromProtocolUrl(`edgeever://wechat-import?path=${encodeURIComponent(outside)}`);
    expect(sent[0]).toEqual({ ok: false, reason: "failed" });
    expect((await readFile(outside)).toString()).toBe("secret");
  });

  test("picks up a completed share without a protocol URL and ignores a duplicate URL", async () => {
    const root = await mkdtemp(join(tmpdir(), "edgeever-wechat-share-"));
    roots.push(root);
    const downloads = join(root, "Downloads");
    const batch = join(downloads, WECHAT_INCOMING_DIRECTORY_NAME, "batch");
    await mkdir(batch, { recursive: true });
    const zipPath = join(batch, "聊天记录.zip");
    const partialPath = `${zipPath}.partial`;
    await writeFile(partialPath, zipOf("聊天记录.txt", "·鱼\n2026年9月22日 22:15\n你好\n", "附件/readme.txt", "hello"));
    const sent = [];
    const controller = createWeChatShareController({
      downloadsPath: () => downloads,
      tempPath: () => join(root, "temp"),
      sendToRenderer: (payload) => sent.push(payload),
    });
    await controller.importPending();
    expect(sent).toHaveLength(0);
    await rename(partialPath, zipPath);
    const url = `edgeever://wechat-import?path=${encodeURIComponent(zipPath)}`;
    await Promise.all([controller.importPending(), controller.importFromProtocolUrl(url)]);
    expect(sent).toHaveLength(1);
    expect(sent[0].ok).toBe(true);
    expect((await stat(zipPath)).isFile()).toBe(true);
    await controller.importFromProtocolUrl(url);
    expect(sent).toHaveLength(1);
    await controller.finish(sent[0].importId, false);
    await controller.importPending();
    expect(sent).toHaveLength(1);
    expect(controller.retry(sent[0].importId)).toBe(true);
    expect(sent).toHaveLength(2);
    await controller.finish(sent[0].importId, true);
    await expect(stat(zipPath)).rejects.toThrow();
  });

  test("keeps multiple old pending shares available across app restarts", async () => {
    const root = await mkdtemp(join(tmpdir(), "edgeever-wechat-share-"));
    roots.push(root);
    const downloads = join(root, "Downloads");
    const incoming = join(downloads, WECHAT_INCOMING_DIRECTORY_NAME);
    const old = new Date(Date.now() - 48 * 60 * 60 * 1000);
    for (const name of ["first", "second"]) {
      const batch = join(incoming, name);
      await mkdir(batch, { recursive: true });
      const zipPath = join(batch, "聊天记录.zip");
      await writeFile(zipPath, zipOf("聊天记录.txt", `·鱼\n2026年9月22日 22:15\n${name}\n`, "附件/readme.txt", "hello"));
      await utimes(batch, old, old);
    }
    const prepared = [];
    const controller = createWeChatShareController({
      downloadsPath: () => downloads,
      tempPath: () => join(root, "temp"),
      sendToRenderer: (payload) => prepared.push(payload),
    });
    await controller.importPending();
    expect(prepared).toHaveLength(2);
    await controller.finish(prepared[0].importId, false);
    const resumed = [];
    const restarted = createWeChatShareController({
      downloadsPath: () => downloads,
      tempPath: () => join(root, "new-temp"),
      sendToRenderer: (payload) => resumed.push(payload),
    });
    await restarted.importPending();
    expect(resumed).toHaveLength(2);
    for (const name of ["first", "second"]) {
      expect((await stat(join(incoming, name, "聊天记录.zip"))).isFile()).toBe(true);
    }
  });

  test("finishing one zip keeps another zip in the same incoming batch", async () => {
    const root = await mkdtemp(join(tmpdir(), "edgeever-wechat-share-"));
    roots.push(root);
    const downloads = join(root, "Downloads");
    const batch = join(downloads, WECHAT_INCOMING_DIRECTORY_NAME, "batch");
    await mkdir(batch, { recursive: true });
    for (const name of ["first", "second"]) {
      await writeFile(join(batch, `${name}.zip`), zipOf("聊天记录.txt", `·鱼\n2026年9月22日 22:15\n${name}\n`, "附件/readme.txt", "hello"));
    }
    const sent = [];
    const controller = createWeChatShareController({
      downloadsPath: () => downloads,
      tempPath: () => join(root, "temp"),
      sendToRenderer: (payload) => sent.push(payload),
    });
    await controller.importPending();
    expect(sent).toHaveLength(2);
    const first = sent.find((payload) => payload.title === "first");
    const second = sent.find((payload) => payload.title === "second");
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    await controller.finish(first.importId, true);
    expect((await stat(join(batch, "second.zip"))).isFile()).toBe(true);
    await controller.finish(second.importId, true);
    await expect(stat(batch)).rejects.toThrow();
  });
});
