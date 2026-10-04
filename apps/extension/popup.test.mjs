import { expect, test } from "bun:test";

test("requests instance permission during the popup click user action", async () => {
  const previousChrome = globalThis.chrome;
  const previousDocument = globalThis.document;
  const listeners = new Map();
  const saveButton = {
    disabled: false,
    addEventListener: (event, listener) => listeners.set(`save:${event}`, listener),
  };
  const settingsButton = { addEventListener: () => {} };
  const status = { textContent: "", dataset: {} };
  let finishLoadingSettings;
  let insideClick = false;
  let permissionRequests = 0;
  let captures = 0;

  globalThis.document = {
    documentElement: { lang: "", dir: "" },
    querySelectorAll: () => [],
    querySelector: (selector) => ({ "#save": saveButton, "#settings": settingsButton, "#status": status })[selector],
  };
  globalThis.chrome = {
    i18n: { getMessage: (key) => key, getUILanguage: () => "en" },
    storage: { local: { get: () => new Promise((resolve) => { finishLoadingSettings = resolve; }) } },
    permissions: {
      request: ({ origins }) => {
        expect(insideClick).toBe(true);
        expect(origins).toEqual(["https://example.com/*"]);
        permissionRequests += 1;
        return Promise.resolve(true);
      },
    },
    runtime: {
      sendMessage: async (message) => {
        expect(message).toEqual({ type: "captureCurrentPage" });
        captures += 1;
        return { ok: true };
      },
    },
  };

  try {
    await import("./src/popup.ts");
    expect(saveButton.disabled).toBe(true);

    finishLoadingSettings({ instanceUrl: "https://example.com", token: "token", notebookId: "" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(saveButton.disabled).toBe(false);

    insideClick = true;
    const click = listeners.get("save:click")();
    insideClick = false;
    await click;

    expect(permissionRequests).toBe(1);
    expect(captures).toBe(1);
    expect(status.textContent).toBe("savedToEdgeEver");
    expect(saveButton.disabled).toBe(false);
  } finally {
    globalThis.chrome = previousChrome;
    globalThis.document = previousDocument;
  }
});
