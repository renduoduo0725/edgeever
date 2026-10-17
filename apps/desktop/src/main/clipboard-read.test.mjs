import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { readEditorClipboard, registerClipboardReadIpc } from "./clipboard-read.mjs";

const item = (data) => ({
  types: Object.keys(data),
  async getType(type) {
    const content = data[type];
    if (content instanceof Error) throw content;
    return content instanceof Blob ? content : new Blob([content], { type });
  },
});
const snapshot = (data) => readEditorClipboard({ read: async () => [item(data)] });

describe("editor native clipboard snapshots", () => {
  test("HTML wins without reading duplicate images or plain text", async () => {
    expect(await snapshot({ "text/html": "<p><strong>Alpha</strong></p>", "text/plain": new Error("Unreadable"), "image/png": new Error("Unreadable") }))
      .toEqual({ html: "<p><strong>Alpha</strong></p>", text: "", images: [] });
  });
  test("falls back from unreadable HTML to literal plain text", async () => {
    expect(await snapshot({ "text/html": new Error("Unreadable"), "text/plain": "<literal>\ntext", "image/png": new Error("Unreadable") }))
      .toEqual({ html: "", text: "<literal>\ntext", images: [] });
  });
  test("preserves multiple native text items with line breaks", async () => {
    expect(await readEditorClipboard({ read: async () => [item({ "text/plain": "A\tB" }), item({ "text/plain": "C\nD" })] }))
      .toEqual({ html: "", text: "A\tB\nC\nD", images: [] });
  });
  test("returns image-only PNG bytes rather than file paths or bookmarks", async () => {
    const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const result = await snapshot({ "image/png": png, "electron application/bookmark": new Error("Must not read"), "electron application/filename": new Error("Must not read") });
    expect(result.html).toBe("");
    expect(result.text).toBe("");
    expect(result.images).toHaveLength(1);
    expect(result.images[0]).toBeInstanceOf(Uint8Array);
    expect(result.images[0]).toEqual(png);
  });
  test("empty and unsupported clipboard formats are a no-op", async () => {
    expect(await readEditorClipboard({ read: async () => [] })).toEqual({ html: "", text: "", images: [] });
    expect(await snapshot({ "electron application/filename": new Error("Must not read") })).toEqual({ html: "", text: "", images: [] });
  });
  test("preserves all PNG clipboard items in their native order", async () => {
    const first = Uint8Array.from([137, 80, 78, 71, 1]);
    const second = Uint8Array.from([137, 80, 78, 71, 2]);
    expect(await readEditorClipboard({ read: async () => [item({ "image/png": first }), item({ "image/png": second })] }))
      .toEqual({ html: "", text: "", images: [first, second] });
  });
  test("enforces the image limit across all PNG items rather than per file", async () => {
    const large = new Blob([new Uint8Array(16 * 1024 * 1024 + 1)]);
    await expect(readEditorClipboard({ read: async () => [item({ "image/png": large }), item({ "image/png": large })] }))
      .rejects.toThrow("Clipboard images exceed size limit");
  });
  test("propagates unavailable snapshots and enforces IPC size limits", async () => {
    await expect(snapshot({ "text/html": new Error("Unreadable") })).rejects.toThrow("Unreadable");
    await expect(readEditorClipboard({ read: async () => { throw new Error("Read denied"); } })).rejects.toThrow("Read denied");
    await expect(snapshot({ "text/plain": new Blob([new Uint8Array(8 * 1024 * 1024 + 1)]) })).rejects.toThrow("Clipboard text exceeds size limit");
    await expect(snapshot({ "image/png": new Blob([new Uint8Array(32 * 1024 * 1024 + 1)]) })).rejects.toThrow("Clipboard images exceed size limit");
    expect(await snapshot({ "text/html": new Blob([new Uint8Array(8 * 1024 * 1024 + 1)]), "text/plain": "Fallback" }))
      .toEqual({ html: "", text: "Fallback", images: [] });
  });
});

describe("native clipboard snapshot authorization", () => {
  const fixture = (rendererUrl = "edgeever-app://app/index.html") => {
    const handlers = new Map();
    let reads = 0;
    let getItems = async () => [item({ "text/plain": "Native snapshot" })];
    const mainFrame = { url: rendererUrl };
    const sender = { mainFrame, isDestroyed: () => false, isFocused: () => true };
    const window = {
      webContents: sender, isDestroyed: () => false, isVisible: () => true,
      isMinimized: () => false, isFocused: () => true,
    };
    let currentWindow = window;
    registerClipboardReadIpc({ handle: (channel, handler) => handlers.set(channel, handler) }, {
      clipboard: { read: () => { reads++; return getItems(); } },
      getMainWindow: () => currentWindow, getRendererUrl: () => rendererUrl,
    });
    return {
      read: handlers.get("desktop:read-clipboard"), sender, window,
      event: { sender, senderFrame: mainFrame }, count: () => reads,
      setWindow: (value) => { currentWindow = value; },
      setItems: (value) => { getItems = value; },
    };
  };
  test("returns an explicit snapshot without dispatching a native paste event", async () => {
    const context = fixture();
    expect(await context.read(context.event)).toEqual({ html: "", text: "Native snapshot", images: [] });
    expect(context.count()).toBe(1);
  });
  test("rejects foreign senders, subframes, missing frames and absent windows before reading", async () => {
    const context = fixture();
    for (const event of [undefined, { sender: {}, senderFrame: context.sender.mainFrame }, { sender: context.sender, senderFrame: { url: context.sender.mainFrame.url } }, { sender: context.sender }])
      await expect(context.read(event)).rejects.toThrow("Clipboard read forbidden");
    context.setWindow(null);
    await expect(context.read(context.event)).rejects.toThrow("Clipboard read forbidden");
    expect(context.count()).toBe(0);
  });
  test("rejects background, minimized, hidden and destroyed windows before reading", async () => {
    for (const [object, method, value] of [["window", "isFocused", false], ["sender", "isFocused", false], ["window", "isVisible", false], ["window", "isMinimized", true], ["window", "isDestroyed", true], ["sender", "isDestroyed", true]]) {
      const context = fixture();
      context[object][method] = () => value;
      await expect(context.read(context.event)).rejects.toThrow("Clipboard read forbidden");
      expect(context.count()).toBe(0);
    }
  });
  test("permits app navigation and rejects untrusted renderer origins", async () => {
    for (const rendererUrl of ["edgeever-app://app/index.html", "http://127.0.0.1:5173/", "file:///app/web/index.html"]) {
      const context = fixture(rendererUrl);
      context.sender.mainFrame.url = `${rendererUrl}#/memo/test`;
      await context.read(context.event);
      expect(context.count()).toBe(1);
      for (const url of ["edgeever-app://evil/index.html", "https://example.org/", "http://127.0.0.1:5173@evil.example/", "file:///etc/passwd", "edgeever-resource://resource/html"]) {
        context.sender.mainFrame.url = url;
        await expect(context.read(context.event)).rejects.toThrow("Clipboard read forbidden");
      }
      expect(context.count()).toBe(1);
    }
  });
  test("accepts no renderer-controlled clipboard payload or requested formats", async () => {
    const context = fixture();
    for (const payload of [undefined, null, "text/plain", { html: "<p>attacker</p>" }, Uint8Array.from([1, 2])])
      await expect(context.read(context.event, payload)).rejects.toThrow("Clipboard read forbidden");
    expect(context.count()).toBe(0);
  });
  test("rechecks focus, frame, origin and lifecycle before returning an async snapshot", async () => {
    for (const invalidate of [
      (context) => { context.window.isFocused = () => false; },
      (context) => { context.sender.isFocused = () => false; },
      (context) => { context.window.isVisible = () => false; },
      (context) => { context.window.isMinimized = () => true; },
      (context) => { context.window.isDestroyed = () => true; },
      (context) => { context.sender.isDestroyed = () => true; },
      (context) => { context.sender.mainFrame = { url: context.sender.mainFrame.url }; },
      (context) => { context.sender.mainFrame.url = "https://attacker.example/"; },
      (context) => { context.setWindow(null); },
    ]) {
      const context = fixture();
      context.setItems(async () => { invalidate(context); return [item({ "text/plain": "Sensitive snapshot" })]; });
      await expect(context.read(context.event)).rejects.toThrow("Clipboard read forbidden");
      expect(context.count()).toBe(1);
    }
  });
  test("preload requires isolated user activation and normalizes PNG bytes", async () => {
    const source = readFileSync(new URL("../preload/index.cjs", import.meta.url), "utf8");
    let bridge;
    const calls = [];
    const userActivation = { isActive: false };
    runInNewContext(source, {
      navigator: { userActivation },
      require: () => ({
        contextBridge: { exposeInMainWorld: (_name, value) => { bridge = value; } },
        ipcRenderer: {
          sendSync: () => undefined,
          invoke: (...args) => { calls.push(args); return Promise.resolve({ html: "", text: "", images: [{ type: "Buffer", data: [1, 2, 3] }] }); },
        },
      }),
    });
    await expect(bridge.readClipboard()).rejects.toThrow("Clipboard read requires user activation");
    expect(calls).toEqual([]);
    userActivation.isActive = true;
    const result = await bridge.readClipboard({ format: "text/html" });
    expect(result.images).toHaveLength(1);
    expect([...result.images[0]]).toEqual([1, 2, 3]);
    expect(calls).toEqual([["desktop:read-clipboard"]]);
    expect(bridge.pasteClipboard).toBeUndefined();
  });
  test("keeps renderer permissions denied and removes the native paste-event command", () => {
    const main = readFileSync(new URL("./index.mjs", import.meta.url), "utf8");
    const preload = readFileSync(new URL("../preload/index.cjs", import.meta.url), "utf8");
    expect(main).toContain("registerClipboardReadIpc(ipcMain");
    expect(main).toContain("setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))");
    expect(preload).toContain('ipcRenderer.invoke("desktop:read-clipboard")');
    expect(main + preload).not.toContain("desktop:paste-clipboard");
  });
});
