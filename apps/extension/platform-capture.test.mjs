import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { bundleTestScripts } from "./bundle-test-scripts.mjs";
import { createWindow } from "@mixmark-io/domino";

const [bundle] = bundleTestScripts(["capture-platform"]);
const xUrl = "https://www.xiaoyuzhoufm.com/episode/62ad4ae5f9b62781ea058a02";

const capture = async ({ fixture = "xiaoyuzhou", url = xUrl, expectedUrl = url, selectionFirst = false, prepare } = {}) => {
  const window = createWindow(readFileSync(new URL(`./fixtures/platforms/${fixture}.html`, import.meta.url), "utf8"), url);
  const doc = window.document;
  const location = { href: url };
  let notify = () => {};
  const calls = { messages: [], clicks: 0, disconnected: false };
  prepare?.({ doc, window, location, changed: () => notify() });
  const expand = doc.querySelector(".expand");
  expand?.addEventListener("click", () => { calls.clicks += 1; });
  let done;
  const result = new Promise((resolve) => { done = resolve; });
  runInNewContext(bundle, {
    window, document: doc, location, URL,
    __edgeeverPlatformClipPayload: { requestId: "capture-1", url: expectedUrl, sourceUrl: expectedUrl, selectionFirst },
    setTimeout: (callback) => setTimeout(callback, 30), clearTimeout, setInterval, clearInterval,
    MutationObserver: class {
      constructor(callback) { notify = callback; }
      observe() {}
      disconnect() { calls.disconnected = true; }
    },
    chrome: {
      i18n: { getMessage: (key) => key },
      runtime: { sendMessage: (message) => { calls.messages.push(message); done(message.result); return Promise.resolve(); } },
    },
    fetch: () => { throw new Error("Capture must not download audio or fetch another page"); },
  });
  return { result: await result, calls };
};

test("the real page's fully loaded Show Notes do not need an expansion click", async () => {
  const { result, calls } = await capture();
  expect(result.ok).toBe(true);
  expect(result.clip.markdown).toContain("韦礼安");
  expect(calls.clicks).toBe(0);
  expect(calls.messages).toHaveLength(1);
  expect(calls.messages[0].requestId).toBe("capture-1");
});

test("an incomplete DOM expands only the Show Notes control once and waits for complete text", async () => {
  const { result, calls } = await capture({ prepare: ({ doc, changed }) => {
    const notes = doc.querySelector(".sn-content article"); const full = notes.innerHTML;
    notes.innerHTML = "<p>preview</p>";
    doc.querySelector(".expand").addEventListener("click", () => { notes.innerHTML = full; changed(); });
  } });
  expect(result.ok).toBe(true);
  expect(result.clip.markdown).toContain("韦礼安");
  expect(calls.clicks).toBe(1);
  expect(calls.disconnected).toBe(true);
});

test("failed expansion is bounded and never returns the truncated text", async () => {
  const { result, calls } = await capture({ prepare: ({ doc }) => {
    doc.querySelector(".sn-content article").innerHTML = "<p>preview</p>";
  } });
  expect(result).toEqual({ ok: false, reason: "incomplete" });
  expect(calls.clicks).toBe(1);
  expect(calls.disconnected).toBe(true);
});

test("navigation during expansion rejects the old episode", async () => {
  const { result, calls } = await capture({ prepare: ({ doc, location, changed }) => {
    doc.querySelector(".sn-content article").innerHTML = "<p>preview</p>";
    doc.querySelector(".expand").addEventListener("click", () => { location.href = xUrl.replace(/02$/, "03"); changed(); });
  } });
  expect(result).toEqual({ ok: false, reason: "changed" });
  expect(calls.messages).toHaveLength(1);
});

test("toolbar selection wins over the platform article, while a page menu ignores the selection", async () => {
  const prepare = ({ doc, window }) => {
    window.getSelection = () => ({ rangeCount: 1, toString: () => "Selected passage", getRangeAt: () => ({ cloneContents: () => {
      const fragment = doc.createDocumentFragment();
      const p = doc.createElement("p"); p.textContent = "Selected passage"; fragment.appendChild(p); return fragment;
    } }) });
  };
  const toolbar = await capture({ selectionFirst: true, prepare });
  expect(toolbar.result.selection.markdown).toBe("Selected passage");
  expect(toolbar.result.clip).toBeUndefined();
  const menu = await capture({ selectionFirst: false, prepare });
  expect(menu.result.clip.markdown).toContain("韦礼安");
  expect(menu.result.selection).toBeUndefined();
});

test("an injection for another detail URL reports a page change without expansion", async () => {
  const { result, calls } = await capture({ expectedUrl: xUrl.replace(/02$/, "03") });
  expect(result).toEqual({ ok: false, reason: "changed" });
  expect(calls.clicks).toBe(0);
});

test("a text selection removed by HTML cleanup stays a selection as escaped plain text", async () => {
  const { result } = await capture({ selectionFirst: true, prepare: ({ doc, window }) => {
    window.getSelection = () => ({ rangeCount: 1, toString: () => "Only *this* text", getRangeAt: () => ({ cloneContents: () => {
      const fragment = doc.createDocumentFragment(); const button = doc.createElement("button");
      button.textContent = "Only *this* text"; fragment.appendChild(button); return fragment;
    } }) });
  } });
  expect(result.selection.markdown).toBe("Only \\*this\\* text");
  expect(result.clip).toBeUndefined();
});
