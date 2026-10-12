// Runs inside the installed WorkBuddy Electron, never EdgeEver's Electron.
// Use WorkBuddy's own codec and native storage; key material stays in this process.
const { createConnection, createServer } = require("node:net");
const { randomUUID } = require("node:crypto");
const { mkdtempSync, chmodSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");

async function launch() {
  const cli = process.argv[2];
  const resources = path.resolve(path.dirname(cli), "../../..");
  let codec;
  try {
    codec = require(path.join(resources, "app.asar/main/process-cpu-sampler.js"));
  } catch (error) {
    // Older WorkBuddy builds predate credential protection entirely.
    if (error.code !== "MODULE_NOT_FOUND") throw error;
    process.argv = [process.argv[0], cli, ...process.argv.slice(3)];
    return require(cli);
  }
  if (typeof codec.normalizeAtRestBuildKeyCapabilities !== "function") {
    process.argv = [process.argv[0], cli, ...process.argv.slice(3)];
    return require(cli);
  }
  const native = process._linkedBinding("electron_browser_workbuddy_storage");
  const capabilities = codec.normalizeAtRestBuildKeyCapabilities(native.loggerGet());
  if (capabilities.symmetric.status !== "available") throw new Error("credential_bootstrap_unavailable");
  const bootstrap = { policy: "fields", symmetricKey: capabilities.symmetric.value, asymmetricUnavailable: "unsupported" };
  const directory = mkdtempSync(path.join(tmpdir(), "ee-wb-"));
  chmodSync(directory, 0o700);
  const socketPath = path.join(directory, "credentials.sock");
  const readyPath = path.join(directory, "ready.sock");
  const token = randomUUID();
  const sessionId = randomUUID();
  process.env.WORKBUDDY_AT_REST_ENCRYPTION = "fields";
  process.env.CODEBUDDY_SIDECAR_CREDENTIAL_BOOTSTRAP_SOCKET = socketPath;
  process.env.CODEBUDDY_SIDECAR_READY_SOCKET = readyPath;
  process.env.CODEBUDDY_SIDECAR_READY_TOKEN = token;
  process.env.CODEBUDDY_SIDECAR_READY_SESSION_ID = sessionId;
  const ready = createServer((socket) => {
    let buffer = "";
    socket.on("data", (data) => {
      buffer += data;
      if (buffer.length > 65536) return socket.destroy();
      if (!buffer.includes("\n")) return;
      try {
        const request = JSON.parse(buffer.split("\n")[0]);
        if (request.method !== "session.ready" || request.params?.token !== token || request.params?.sessionId !== sessionId || request.params?.pid !== process.pid) return socket.destroy();
        socket.end(JSON.stringify({ jsonrpc: "2.0", id: request.id, result: { ok: true } }) + "\n");
      } catch { socket.destroy(); }
    });
  });
  await new Promise((resolve, reject) => { ready.once("error", reject); ready.listen(readyPath, resolve); });
  ready.unref();
  let transferred = false;
  const deadline = Date.now() + 5000;
  const send = () => {
    const socket = createConnection(socketPath);
    let response = "";
    socket.setTimeout(5000, () => { socket.destroy(); process.exit(1); });
    socket.once("connect", () => {
      socket.end(JSON.stringify({ version: 1, pid: process.pid, token, sessionId, bootstrap: codec.encodeAtRestEncryptionBootstrap(bootstrap) }) + "\n");
    });
    socket.on("data", (data) => {
      response += data;
      if (response.length > 65536) return socket.destroy();
      if (!response.includes("\n")) return;
      try {
        if (JSON.parse(response.split("\n")[0]).ok === true) {
          transferred = true;
          codec.disposeAtRestEncryptionBootstrap(bootstrap);
        }
      } catch { /* Receiver owns validation; never log payloads. */ }
    });
    socket.once("error", () => {
      if (Date.now() < deadline) setTimeout(send, 25);
      else { process.stderr.write("[EdgeEver] WorkBuddy credential bootstrap failed\n"); process.exit(1); }
    });
  };
  process.once("exit", () => {
    if (!transferred) codec.disposeAtRestEncryptionBootstrap(bootstrap);
    rmSync(directory, { recursive: true, force: true });
  });
  send();
  process.argv = [process.argv[0], cli, ...process.argv.slice(3)];
  require(cli);
}

launch().catch(() => {
  // Native failures can contain sensitive material. Emit only a stable code.
  process.stderr.write("[EdgeEver] WorkBuddy credential bootstrap unavailable\n");
  process.exit(1);
});
