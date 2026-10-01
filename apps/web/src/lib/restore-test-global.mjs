const restoreUnconditionally = Symbol("restore-unconditionally");
const noop = () => {};

// Linux Bun can be left with a plain window object, or with a linkedom
// document whose view is not installed as `window`. TipTap reads
// `window.addEventListener` and appends CSS to `document.head`.
export const ensureTestDocumentHead = () => {
  const doc = globalThis.document;
  if (!doc || typeof doc.createElement !== "function" || typeof doc.getElementsByTagName !== "function") return;
  if (doc.getElementsByTagName("head")[0]) return;
  const head = doc.createElement("head");
  const html = doc.documentElement;
  if (html && typeof html.insertBefore === "function") {
    html.insertBefore(head, html.firstChild ?? null);
    return;
  }
  if (typeof doc.appendChild === "function") doc.appendChild(head);
};

export const ensureTestWindowDom = () => {
  const view = globalThis.document?.defaultView;
  if (view && typeof globalThis.window?.addEventListener !== "function") {
    globalThis.window = view;
  }
  ensureTestDocumentHead();
  const current = globalThis.window;
  if (!current || typeof current !== "object") return;
  if (typeof current.addEventListener !== "function") current.addEventListener = noop;
  if (typeof current.removeEventListener !== "function") current.removeEventListener = noop;
  if (typeof current.getComputedStyle !== "function") current.getComputedStyle = () => ({ listStyle: "" });
  if (typeof current.setTimeout !== "function") current.setTimeout = globalThis.setTimeout.bind(globalThis);
  if (typeof current.clearTimeout !== "function") current.clearTimeout = globalThis.clearTimeout.bind(globalThis);
};

export const restoreTestGlobal = (key, original, installed = restoreUnconditionally) => {
  if (installed !== restoreUnconditionally && globalThis[key] !== installed) return;
  if (original !== undefined) {
    globalThis[key] = original;
    return;
  }
  // Assigning undefined shadows the host binding, and deleting window makes
  // ProseMirror throw `window is not defined`. Keep the stub and make it
  // safe for a later editor test.
  if (key === "window") {
    ensureTestWindowDom();
    return;
  }
  delete globalThis[key];
};
