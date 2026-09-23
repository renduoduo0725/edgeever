import { describe, expect, test } from "bun:test";
import { writeRichClipboard, writeTextClipboard } from "./clipboard-write.mjs";

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
