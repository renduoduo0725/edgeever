import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { writeImageClipboard, writeRichClipboard, writeTextClipboard } from "./clipboard-write.mjs";

const PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41,
  0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
  0x00, 0x00, 0x03, 0x00, 0x01, 0x18, 0xdd, 0x8d,
  0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
  0x44, 0xae, 0x42, 0x60, 0x82,
]);

class TestClipboardItem {
  constructor(data) {
    this.data = data;
  }
}

describe("writeTextClipboard", () => {
  test("awaits and verifies the Electron 44 text clipboard API", async () => {
    const calls = [];
    const clipboard = {
      writeText: async (value) => { calls.push(["writeText", value]); },
      readText: async () => {
        calls.push(["readText"]);
        return "Hello";
      },
    };

    await expect(writeTextClipboard(clipboard, "Hello")).resolves.toBe(true);
    expect(calls).toEqual([
      ["writeText", "Hello"],
      ["readText"],
    ]);
  });

  test("does not report success when the written text cannot be read back", async () => {
    const clipboard = {
      writeText: async () => {},
      readText: async () => "",
    };

    await expect(writeTextClipboard(clipboard, "Hello")).resolves.toBe(false);
  });

  test("rejects malformed text input", async () => {
    const clipboard = { writeText: async () => {}, readText: async () => "" };
    await expect(writeTextClipboard(clipboard, null)).rejects.toThrow(
      "Clipboard value must be a string",
    );
  });
});

describe("writeImageClipboard", () => {
  test("writes PNG bytes and verifies the image is on the clipboard", async () => {
    const writes = [];
    const clipboard = {
      write: async (value) => writes.push(value),
      has: async (type) => type === "image/png",
    };

    await expect(writeImageClipboard(clipboard, TestClipboardItem, PNG)).resolves.toBe(true);
    expect(writes).toHaveLength(1);
    const blob = writes[0][0].data["image/png"];
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("image/png");
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(PNG);
  });

  test("does not report success when the image cannot be read back", async () => {
    const clipboard = {
      write: async () => {},
      has: async () => false,
    };

    await expect(writeImageClipboard(clipboard, TestClipboardItem, PNG)).resolves.toBe(false);
  });

  test("rejects a non-image payload and ignores bytes that are not a PNG", async () => {
    const clipboard = { write: async () => {}, has: async () => true };
    await expect(writeImageClipboard(clipboard, TestClipboardItem, "nope")).rejects.toThrow(
      "Clipboard image must be PNG bytes",
    );
    await expect(writeImageClipboard(clipboard, TestClipboardItem, Uint8Array.from([1, 2, 3]))).resolves.toBe(false);
    await expect(writeImageClipboard(clipboard, TestClipboardItem, new Uint8Array())).resolves.toBe(false);
  });

  test("desktop image copy is wired through the main process", () => {
    const main = readFileSync(new URL("./index.mjs", import.meta.url), "utf8");
    const preload = readFileSync(new URL("../preload/index.cjs", import.meta.url), "utf8");
    expect(main).toContain('ipcMain.handle("desktop:copy-image"');
    expect(preload).toContain('ipcRenderer.invoke("desktop:copy-image"');
  });
});

describe("writeRichClipboard", () => {
  test("writes and verifies both rich HTML and plain text with the Electron 44 API", async () => {
    const writes = [];
    const clipboard = {
      write: async (value) => writes.push(value),
      readText: async () => "Hello",
      has: async (type) => type === "text/html",
    };

    await expect(writeRichClipboard(clipboard, TestClipboardItem, {
      html: "<strong>Hello</strong>",
      plainText: "Hello",
    })).resolves.toBe(true);
    expect(writes).toEqual([[
      new TestClipboardItem({
        "text/html": "<strong>Hello</strong>",
        "text/plain": "Hello",
      }),
    ]]);
  });

  test("does not report success when rich HTML is missing after the write", async () => {
    const clipboard = {
      write: async () => {},
      readText: async () => "Hello",
      has: async () => false,
    };

    await expect(writeRichClipboard(clipboard, TestClipboardItem, {
      html: "<strong>Hello</strong>",
      plainText: "Hello",
    })).resolves.toBe(false);
  });

  test("rejects malformed renderer input", async () => {
    const clipboard = { write: async () => {}, readText: async () => "", has: async () => false };
    await expect(writeRichClipboard(clipboard, TestClipboardItem, { html: "<p>Hello</p>" })).rejects.toThrow(
      "Clipboard HTML and plain text must be strings",
    );
  });
});
