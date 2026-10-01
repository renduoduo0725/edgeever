import { expect, test } from "bun:test";
import { ensureTestDocumentHead, ensureTestWindowDom, restoreTestGlobal } from "./restore-test-global.mjs";

test("restoreTestGlobal keeps a window object when nothing was there before", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const stub = { localStorage: {} };
  globalThis.window = stub;
  restoreTestGlobal("window", undefined, stub);
  expect(globalThis.window).toBe(stub);
  expect(typeof globalThis.window.addEventListener).toBe("function");
  expect(typeof globalThis.window.removeEventListener).toBe("function");
  if (descriptor) Object.defineProperty(globalThis, "window", descriptor);
  else delete globalThis.window;
});

test("restoreTestGlobal leaves a global that another file replaced", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
  const installed = { owned: true };
  const replacement = { owned: false };
  globalThis.document = installed;
  globalThis.document = replacement;
  restoreTestGlobal("document", undefined, installed);
  expect(globalThis.document).toBe(replacement);
  if (descriptor) Object.defineProperty(globalThis, "document", descriptor);
  else delete globalThis.document;
});

test("ensureTestDocumentHead inserts a head when the document has none", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
  const heads = [];
  const html = {
    firstChild: null,
    insertBefore(node) {
      heads.push(node);
    },
  };
  globalThis.document = {
    documentElement: html,
    createElement: (name) => ({ nodeName: name, appendChild() {} }),
    getElementsByTagName: (name) => (name === "head" ? heads : []),
  };
  ensureTestDocumentHead();
  expect(heads).toHaveLength(1);
  ensureTestDocumentHead();
  expect(heads).toHaveLength(1);
  if (descriptor) Object.defineProperty(globalThis, "document", descriptor);
  else delete globalThis.document;
});

test("ensureTestWindowDom uses the document view when the leftover window cannot listen", () => {
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
  const view = {
    addEventListener() {},
    removeEventListener() {},
  };
  globalThis.document = {
    defaultView: view,
    documentElement: { insertBefore() {} },
    createElement: (name) => ({ nodeName: name }),
    getElementsByTagName: () => [{}],
  };
  globalThis.window = { edgeeverDesktop: { isAvailable: true } };
  ensureTestWindowDom();
  expect(globalThis.window).toBe(view);
  if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor);
  else delete globalThis.window;
  if (documentDescriptor) Object.defineProperty(globalThis, "document", documentDescriptor);
  else delete globalThis.document;
});

test("ensureTestWindowDom fills event methods on a leftover window", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const stub = { edgeeverDesktop: { isAvailable: true } };
  globalThis.window = stub;
  ensureTestWindowDom();
  expect(typeof stub.addEventListener).toBe("function");
  expect(typeof stub.getComputedStyle).toBe("function");
  expect(stub.edgeeverDesktop.isAvailable).toBe(true);
  ensureTestWindowDom();
  if (descriptor) Object.defineProperty(globalThis, "window", descriptor);
  else delete globalThis.window;
});
