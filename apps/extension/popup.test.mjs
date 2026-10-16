import { expect, test } from "bun:test";
import { captureCurrentPage } from "./src/popup";

const settings = { instanceUrl: "https://example.com", token: "token", notebookId: "" };
async function withChrome(overrides, run) {
  const previous = globalThis.chrome;
  globalThis.chrome = { i18n: { getMessage: key => key }, ...overrides };
  try { await run(); } finally { globalThis.chrome = previous; }
}

test("popup requests instance permission synchronously within the click before capturing", async () => {
  let insideClick = false;
  let resolvePermission;
  let captures = 0;
  await withChrome({
    permissions: { request: ({ origins }) => {
      expect(insideClick).toBe(true);
      expect(origins).toEqual(["https://example.com/*"]);
      return new Promise(resolve => { resolvePermission = resolve; });
    } },
    runtime: { sendMessage: async message => {
      expect(message).toEqual({ type: "captureCurrentPage" }); captures++;
      return { ok: true, message: "saved" };
    } },
  }, async () => {
    insideClick = true;
    const saving = captureCurrentPage(settings);
    insideClick = false;
    expect(captures).toBe(0);
    resolvePermission(true);
    expect(await saving).toBe("saved");
    expect(captures).toBe(1);
  });
});

test("denied permission prevents popup capture", async () => {
  let captures = 0;
  await withChrome({ permissions: { request: async () => false }, runtime: { sendMessage: async () => { captures++; } } }, async () => {
    await expect(captureCurrentPage(settings)).rejects.toThrow("instancePermissionRequired");
    expect(captures).toBe(0);
  });
});

test("missing configuration never requests permissions or capture", async () => {
  await withChrome({}, async () => {
    await expect(captureCurrentPage({ ...settings, token: "" })).rejects.toThrow("completePluginConfiguration");
  });
});

test("popup retains background failures and localized success fallback", async () => {
  await withChrome({ permissions: { request: async () => true }, runtime: { sendMessage: async () => ({ ok: false, message: "Unreadable page" }) } }, async () => {
    await expect(captureCurrentPage(settings)).rejects.toThrow("Unreadable page");
    chrome.runtime.sendMessage = async () => ({ ok: true });
    expect(await captureCurrentPage(settings)).toBe("savedToEdgeEver");
  });
});

const withPopup = async (mode, run) => {
  const { parseHTML } = await import("linkedom");
  const { window } = parseHTML('<html><body><div id="root"></div></body></html>');
  const globals = { window, document: window.document, Node: window.Node, Element: window.Element, HTMLElement: window.HTMLElement, MutationObserver: window.MutationObserver, IS_REACT_ACT_ENVIRONMENT: true };
  const originals = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  const { act, createElement } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { Popup } = await import("./src/ui/popup.tsx");
  let root;
  try {
    await withChrome({
      storage: { local: { get: async () => settings } },
      permissions: { request: async () => true },
      runtime: { sendMessage: async message => message.type === "getCurrentPageCaptureMode" ? mode : { ok: true, message: "Saved selected content" } },
    }, async () => {
      await act(async () => { root = createRoot(window.document.getElementById("root")); root.render(createElement(Popup)); });
      await run({ document: window.document, click: async () => { await act(async () => window.document.getElementById("save").dispatchEvent(new window.Event("click", { bubbles: true }))); } });
    });
  } finally {
    if (root) await act(async () => root.unmount());
    for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  }
};

for (const [access, label, hint] of [["login-required", "pageCaptureLoginRequired", "pageCaptureLoginHint"], ["content-restricted", "pageCaptureRestricted", "pageCaptureRestrictedHint"]]) {
  test(`React popup shows ${access} while retaining explicit selected-text capture`, async () => {
    await withPopup({ kind: "platform", platform: "BOSS", access }, async ({ document, click }) => {
      expect(document.getElementById("capture-context").dataset.kind).toBe(access);
      expect(document.getElementById("capture-context").getAttribute("aria-label")).toBe(`BOSS · ${label}`);
      expect(document.getElementById("capture-mode").textContent).toBe(label);
      expect(document.getElementById("status").textContent).toBe(hint);
      expect(document.getElementById("save").disabled).toBe(false);
      await click();
      expect(document.getElementById("status").textContent).toBe("Saved selected content");
      expect(document.getElementById("save").disabled).toBe(false);
    });
  });
}

test("React popup does not label an unknown page adapted from a platform name alone", async () => {
  await withPopup({ kind: "unknown", platform: "BOSS", access: "login-required" }, async ({ document }) => {
    expect(document.getElementById("capture-context").dataset.kind).toBe("generic");
    expect(document.getElementById("capture-mode").textContent).toBe("pageCaptureUnknown");
    expect(document.getElementById("status").textContent).toBe("");
  });
});
