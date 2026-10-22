import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { parseHTML } from "linkedom";
import {
  activateHeadingAnchorClick,
  collectHeadingAnchors,
  findHeadingAnchor,
  parseHeadingAnchorHref,
} from "./editor-heading-anchor.ts";

// Bun runs later editor tests in the same worker. Install linkedom as `window`
// for `instanceof` checks, then put the previous globals back. Leaving only
// `document` replaced makes TipTap call a `window` with no addEventListener.
const domKeys = ["window", "document", "HTMLElement", "Element", "Node", "HTMLDetailsElement"];
const originalDom = new Map(
  domKeys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
);

beforeAll(() => {
  const window = parseHTML("<!DOCTYPE html><html><body></body></html>");
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.Element = window.Element;
  globalThis.Node = window.Node;
  globalThis.HTMLDetailsElement = window.HTMLDetailsElement;
});

afterAll(() => {
  for (const [key, descriptor] of originalDom) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  }
});

const docWith = (entries) => ({
  descendants(callback) {
    for (const entry of entries) callback(entry.node, entry.pos);
  },
});

const heading = (text, pos) => ({
  pos,
  node: { type: { name: "heading" }, textContent: text },
});

const paragraph = (text, pos) => ({
  pos,
  node: { type: { name: "paragraph" }, textContent: text },
});

describe("parseHeadingAnchorHref", () => {
  test("reads a bare heading fragment and decodes it", () => {
    expect(parseHeadingAnchorHref("#简介")).toBe("简介");
    expect(parseHeadingAnchorHref("#%E7%AE%80%E4%BB%8B")).toBe("简介");
    expect(parseHeadingAnchorHref("#Hello%20World")).toBe("Hello World");
    expect(parseHeadingAnchorHref("  #hello-world  ")).toBe("hello-world");
  });

  test("leaves note links, web links, and empty hashes alone", () => {
    expect(parseHeadingAnchorHref("#memo=memo_abc")).toBeNull();
    expect(parseHeadingAnchorHref("#memo=")).toBeNull();
    expect(parseHeadingAnchorHref("https://example.com/docs#简介")).toBeNull();
    expect(parseHeadingAnchorHref("/docs#简介")).toBeNull();
    expect(parseHeadingAnchorHref("#")).toBeNull();
    expect(parseHeadingAnchorHref("")).toBeNull();
    expect(parseHeadingAnchorHref(null)).toBeNull();
  });
});

describe("findHeadingAnchor", () => {
  const headings = collectHeadingAnchors(docWith([
    heading("简介", 1),
    paragraph("正文", 8),
    heading("Hello World", 12),
    heading("1. 安装", 30),
    heading("简介", 48),
    heading("  简介： ", 60),
  ]));

  test("matches Chinese text, encoded slugs, and punctuation", () => {
    expect(findHeadingAnchor(headings, "简介")?.pos).toBe(1);
    expect(findHeadingAnchor(headings, "hello-world")?.pos).toBe(12);
    expect(findHeadingAnchor(headings, "Hello World")?.pos).toBe(12);
    expect(findHeadingAnchor(headings, "1-安装")?.pos).toBe(30);
    expect(findHeadingAnchor(headings, "简介：")?.pos).toBe(1);
  });

  test("uses the first heading when the title is repeated", () => {
    expect(findHeadingAnchor(headings, "简介")?.pos).toBe(1);
    expect(findHeadingAnchor(headings, "没有这一节")).toBeNull();
  });
});

describe("activateHeadingAnchorClick", () => {
  const anchor = (href) => {
    const link = document.createElement("a");
    link.setAttribute("href", href);
    link.textContent = "跳转";
    return link;
  };

  const click = (target, button = 0) => {
    const event = {
      button,
      target,
      prevented: false,
      stopped: false,
      preventDefault() { this.prevented = true; },
      stopPropagation() { this.stopped = true; },
    };
    return event;
  };

  test("scrolls to the heading and does not follow the link", () => {
    const element = document.createElement("h2");
    const scrolled = [];
    element.scrollIntoView = (options) => scrolled.push(options);
    const details = document.createElement("details");
    details.append(element);
    const view = {
      state: {
        doc: docWith([heading("安装", 4)]),
      },
      nodeDOM: () => element,
      domAtPos: () => ({ node: element }),
      dispatch() {},
      focus() {},
    };
    const event = click(anchor("#安装"));
    expect(activateHeadingAnchorClick(event, view)).toBe(true);
    expect(event.prevented).toBe(true);
    expect(event.stopped).toBe(true);
    expect(details.open).toBe(true);
    expect(scrolled).toEqual([{ behavior: "smooth", block: "start" }]);
  });

  test("stays put when the heading is missing", () => {
    const event = click(anchor("#没有"));
    const view = { state: { doc: docWith([heading("简介", 1)]) } };
    expect(activateHeadingAnchorClick(event, view)).toBe(true);
    expect(event.prevented).toBe(true);
  });

  test("does not consume note links, web links, or non-primary clicks", () => {
    const view = { state: { doc: docWith([heading("简介", 1)]) } };
    for (const event of [
      click(anchor("#memo=memo_abc")),
      click(anchor("https://example.com/docs#简介")),
      click(anchor("#简介"), 2),
    ]) {
      expect(activateHeadingAnchorClick(event, view)).toBe(false);
      expect(event.prevented).toBe(false);
    }
  });
});
