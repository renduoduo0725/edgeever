import { expect, test } from "bun:test";
import { createUpdateNetworkDiagnostics, sanitizeProxyResult, sanitizeUpdateUrl } from "./update-network-diagnostics.mjs";

const flush = () => new Promise((resolve) => setImmediate(resolve));
const makeSession = (resolveProxy = async () => "DIRECT") => {
  const handlers = {};
  return { handlers, resolveProxy, webRequest: Object.fromEntries(
    ["onBeforeRequest", "onCompleted", "onErrorOccurred", "onBeforeRedirect"].map((name) => [name, (_filter, listener) => { handlers[name] = listener; }]),
  ) };
};
const start = (ses, id, url = "https://github.com/tianma-if/edgeever/releases.atom", extra = {}) => {
  let response;
  ses.handlers.onBeforeRequest({ id, url, ...extra }, (value) => { response = value; });
  expect(response).toEqual({});
};

test("records the actual failed URL, elapsed time and proxy of the updater session", async () => {
  let time = 1000;
  const logs = [];
  const ses = makeSession(async () => "PROXY user:secret@127.0.0.1:7890; DIRECT");
  const diagnostics = createUpdateNetworkDiagnostics({ now: () => time, write: (_event, value) => logs.push(value) });
  diagnostics.observeSession(ses, "electron-updater");
  diagnostics.beginCheck();
  start(ses, 7, "https://user:password@github.com/tianma-if/edgeever/releases.atom?token=private", { uploadData: ["private"], requestHeaders: { Cookie: "private" } });
  await flush();
  time = 31000;
  ses.handlers.onErrorOccurred({ id: 7, error: "net::ERR_CONNECTION_TIMED_OUT" });
  const request = diagnostics.snapshot().requests[0];
  expect(request).toMatchObject({ url: "https://github.com/tianma-if/edgeever/releases.atom", elapsedMs: 30000, status: "failed", errorCode: "ERR_CONNECTION_TIMED_OUT", session: "electron-updater", proxy: { state: "resolved", value: "PROXY 127.0.0.1:7890; DIRECT" } });
  expect(JSON.stringify(logs)).not.toMatch(/secret|password|private|Cookie|uploadData/);
});

test("tracks metadata redirects and their HTTP status without recording signed URL queries", async () => {
  const ses = makeSession();
  const diagnostics = createUpdateNetworkDiagnostics();
  diagnostics.observeSession(ses, "default-metadata");
  diagnostics.beginCheck();
  start(ses, 1, "https://github.com/tianma-if/edgeever/releases/download/v1.111.0/latest-windows.json");
  ses.handlers.onBeforeRedirect({ id: 1, statusCode: 302, redirectURL: "https://release-assets.githubusercontent.com/asset/file?jwt=secret" });
  start(ses, 1, "https://release-assets.githubusercontent.com/asset/file?jwt=secret");
  ses.handlers.onCompleted({ id: 1, statusCode: 200, error: "net::OK" });
  await flush();
  const requests = diagnostics.snapshot().requests;
  expect(requests).toHaveLength(2);
  expect(requests[0]).toMatchObject({ status: "redirected", httpStatus: 302, redirectUrl: "https://release-assets.githubusercontent.com/asset/file" });
  expect(requests[1]).toMatchObject({ status: "completed", httpStatus: 200, errorCode: null, proxy: { value: "DIRECT" } });
});

test("excludes browser/plugin traffic and requests outside an active update attempt", () => {
  const ses = makeSession();
  const diagnostics = createUpdateNetworkDiagnostics();
  diagnostics.observeSession(ses, "default-metadata");
  start(ses, 1);
  diagnostics.beginCheck();
  start(ses, 2, undefined, { webContentsId: 10 });
  start(ses, 3, "https://github.com/tianma-if/edgeever-tasks/releases/latest");
  start(ses, 4, "https://release-assets.githubusercontent.com/unrelated/asset");
  diagnostics.stop();
  start(ses, 5);
  expect(diagnostics.snapshot().requests).toEqual([]);
});

test("proxy inspection cannot delay or fail an update request", async () => {
  const ses = makeSession(() => new Promise(() => {}));
  const diagnostics = createUpdateNetworkDiagnostics({ proxyTimeoutMs: 5, write: () => { throw new Error("disk failure"); }, onChange: () => { throw new Error("window closed"); } });
  diagnostics.observeSession(ses, "electron-updater");
  diagnostics.beginCheck();
  start(ses, 1);
  await new Promise((resolve) => setTimeout(resolve, 15));
  expect(diagnostics.snapshot().requests[0].proxy.state).toBe("timeout");
  ses.handlers.onErrorOccurred({ id: 1, error: "net::ERR_NETWORK_CHANGED" });
  expect(diagnostics.snapshot().requests[0].errorCode).toBe("ERR_NETWORK_CHANGED");
});

test("resets attempts, ignores late proxy results and bounds collection", async () => {
  let resolveProxy;
  const ses = makeSession(() => new Promise((resolve) => { resolveProxy = resolve; }));
  const diagnostics = createUpdateNetworkDiagnostics();
  diagnostics.observeSession(ses, "electron-updater");
  diagnostics.beginCheck();
  start(ses, 1);
  await flush();
  diagnostics.beginCheck();
  resolveProxy("DIRECT");
  await flush();
  expect(diagnostics.snapshot().requests).toEqual([]);
  for (let id = 0; id < 26; id++) start(ses, id);
  expect(diagnostics.snapshot().requests).toHaveLength(24);
  expect(diagnostics.snapshot().omittedRequests).toBe(2);
  diagnostics.stop();
});

test("proxy and URL sanitizers never expose credentials or URL parameters", () => {
  expect(sanitizeUpdateUrl("https://user:pass@github.com/path?token=secret#private")).toBe("https://github.com/path");
  expect(sanitizeProxyResult("SOCKS5 user:pass@[::1]:1080; garbage-secret")).toBe("SOCKS5 [::1]:1080; [unrecognized proxy]");
});
