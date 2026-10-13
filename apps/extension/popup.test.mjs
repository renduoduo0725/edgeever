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
