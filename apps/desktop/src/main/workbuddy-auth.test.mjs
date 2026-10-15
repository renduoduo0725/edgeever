import { expect, test } from "bun:test";
import { authenticateWorkBuddy, prepareWorkBuddyAuth } from "./workbuddy-auth.mjs";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

for (const bundled of [false, true]) test(`credential launcher transfers ${bundled ? "Rolldown" : "named"} codec bootstrap before CLI readiness`, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "edgeever-wb-codec-"));
  try {
    const main = path.join(directory, "app.asar", "main");
    const bin = path.join(directory, "app.asar.unpacked", "cli", "bin");
    await mkdir(main, { recursive: true });
    await mkdir(bin, { recursive: true });
    await writeFile(path.join(directory, "preload.cjs"), `process._linkedBinding = () => ({ loggerGet: () => 'fixture' });`);
    await writeFile(path.join(main, "process-cpu-sampler.js"), `
      let initialized = ${!bundled};
      const normalize = (value) => {
        if (!initialized || value !== 'fixture') throw Error('codec not initialized');
        return { symmetric: { status: 'available', value: { key: Buffer.alloc(32, 7) } } };
      };
      const encode = (value) => {
        if (value.policy !== 'fields' || value.symmetricKey.key[0] !== 7) throw Error('invalid bootstrap');
        return { fixture: true };
      };
      const dispose = (value) => value.symmetricKey.key.fill(0);
      module.exports = ${bundled
        ? "{ $: () => { initialized = true; }, _t: normalize, Z: encode, X: dispose }"
        : "{ normalizeAtRestBuildKeyCapabilities: normalize, encodeAtRestEncryptionBootstrap: encode, disposeAtRestEncryptionBootstrap: dispose }"};
    `);
    const cli = path.join(bin, "codebuddy");
    await writeFile(cli, `
      const { createServer, createConnection } = require('node:net');
      const assert = require('node:assert/strict');
      assert.equal(require('node:fs').realpathSync(process.argv[1]), __filename);
      assert.equal(process.argv[2], '--acp');
      assert.equal(process.env.WORKBUDDY_AT_REST_ENCRYPTION, 'fields');
      const server = createServer(socket => {
        let data = '';
        socket.on('data', chunk => { data += chunk; });
        socket.on('end', () => {
          const message = JSON.parse(data);
          assert.equal(message.pid, process.pid);
          assert.equal(message.token, process.env.CODEBUDDY_SIDECAR_READY_TOKEN);
          assert.equal(message.sessionId, process.env.CODEBUDDY_SIDECAR_READY_SESSION_ID);
          assert.deepEqual(message.bootstrap, { fixture: true });
          socket.end(JSON.stringify({ ok: true }) + '\\n');
          const ready = createConnection(process.env.CODEBUDDY_SIDECAR_READY_SOCKET);
          ready.on('connect', () => ready.write(JSON.stringify({ id: 1, method: 'session.ready', params: { pid: process.pid, token: message.token, sessionId: message.sessionId } }) + '\\n'));
          ready.on('data', chunk => {
            assert.equal(JSON.parse(chunk).result.ok, true);
            console.log('credential-bootstrap-ready');
            ready.end();
            server.close();
          });
        });
      });
      server.listen(process.env.CODEBUDDY_SIDECAR_CREDENTIAL_BOOTSTRAP_SOCKET);
    `);
    const result = spawnSync("node", ["--require", path.join(directory, "preload.cjs"), fileURLToPath(new URL("./workbuddy-launch.cjs", import.meta.url)), cli, "--acp"], { encoding: "utf8", timeout: 5_000 });
    expect({ status: result.status, stderr: result.stderr }).toEqual({ status: 0, stderr: "" });
    expect(result.stdout.trim()).toBe("credential-bootstrap-ready");
    expect(result.stderr).toBe("");
  } finally { await rm(directory, { recursive: true, force: true }); }
});

for (const mode of ["legacy", "partial", "native-failure"]) test(`credential launcher handles ${mode} without leaking native errors`, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "edgeever-wb-codec-"));
  try {
    const main = path.join(directory, "app.asar", "main");
    const bin = path.join(directory, "app.asar.unpacked", "cli", "bin");
    await mkdir(main, { recursive: true });
    await mkdir(bin, { recursive: true });
    await writeFile(path.join(main, "process-cpu-sampler.js"), mode === "legacy" ? "module.exports = {};" : mode === "partial"
      ? "module.exports = { _t: () => {} };"
      : "module.exports = { $: () => {}, _t: () => {}, Z: () => {}, X: () => {} };");
    const preload = path.join(directory, "preload.cjs");
    await writeFile(preload, "process._linkedBinding = () => { throw Error('sensitive-native-material'); };");
    const cli = path.join(bin, "codebuddy");
    await writeFile(cli, "console.log('legacy-cli-started');");
    const result = spawnSync("node", ["--require", preload, fileURLToPath(new URL("./workbuddy-launch.cjs", import.meta.url)), cli, "--acp"], { encoding: "utf8", timeout: 5_000 });
    expect(result.status).toBe(mode === "legacy" ? 0 : 1);
    expect(result.stdout.trim()).toBe(mode === "legacy" ? "legacy-cli-started" : "");
    expect(result.stderr).toBe(mode === "legacy" ? "" : "[EdgeEver] WorkBuddy credential bootstrap unavailable\n");
  } finally { await rm(directory, { recursive: true, force: true }); }
});

const fixture = (responses, credentials = [null, "new-token"]) => {
  const calls = [];
  return {
    calls,
    readCredential: async () => credentials.shift(),
    fetchImpl: async (url, options) => {
      calls.push({ url, ...options });
      const response = responses.shift();
      if (!response) throw new Error("unexpected request");
      return Response.json({ data: response });
    },
  };
};
const auth = { endpoint: "http://127.0.0.1:12345", password: "private-password" };

test("starts login without logout and waits for an authenticated account", async () => {
  const f = fixture([{ success: true }, { authenticated: false }, { authenticated: true, account: { userId: "user" } }]);
  await authenticateWorkBuddy(auth, "external", new AbortController().signal, { ...f, pollIntervalMs: 1 });
  expect(f.calls.map((call) => new URL(call.url).pathname)).toEqual([
    "/api/v1/auth/account/login", "/api/v1/auth/account/status", "/api/v1/auth/account/status",
  ]);
  expect(JSON.parse(f.calls[0].body)).toEqual({ method: "external" });
  expect(f.calls.every((call) => call.headers.Authorization === "Bearer private-password" && call.headers["x-codebuddy-request"] === "1" && call.redirect === "error")).toBe(true);
});

test("explicit login replaces a stale saved credential without logout", async () => {
  const f = fixture([{ success: true }, { authenticated: true, account: { userId: "saved-user" } }, { authenticated: true, account: { userId: "saved-user" } }], ["old-token", "old-token", "new-token"]);
  await authenticateWorkBuddy(auth, "external", new AbortController().signal, { ...f, pollIntervalMs: 1 });
  expect(f.calls.map((call) => new URL(call.url).pathname)).toEqual([
    "/api/v1/auth/account/login", "/api/v1/auth/account/status", "/api/v1/auth/account/status",
  ]);
});

test("a failed re-login is not masked by a saved authenticated account", async () => {
  const f = fixture([{ success: true }, { authenticated: true, account: { userId: "saved-user" }, loginError: "failed" }], ["old-token"]);
  await expect(authenticateWorkBuddy(auth, "external", new AbortController().signal, { ...f, pollIntervalMs: 1 })).rejects.toThrow("authentication_failed");
});

test("returns a swallowed or cancelled login failure before the overall timeout", async () => {
  const f = fixture([{ success: true }, { authenticated: false, loginError: "account.login.failed" }]);
  await expect(authenticateWorkBuddy(auth, "external", new AbortController().signal, { ...f, pollIntervalMs: 1 })).rejects.toThrow("authentication_failed");
});

test("does not treat an opened browser or an accountless status as login success", async () => {
  const f = fixture([{ success: true, authUrl: "https://example.com" }, { authenticated: true }, { loginError: "failed" }]);
  await expect(authenticateWorkBuddy(auth, "external", new AbortController().signal, { ...f, pollIntervalMs: 1 })).rejects.toThrow("authentication_failed");
});

test("stops pending polling when authentication times out", async () => {
  const f = fixture([{ success: true }]);
  const signal = AbortSignal.timeout(20);
  await expect(authenticateWorkBuddy(auth, "external", signal, { ...f, pollIntervalMs: 100 })).rejects.toThrow();
  expect(f.calls).toHaveLength(1);
});

test("fails closed when the installed CLI lacks the account API", async () => {
  await expect(authenticateWorkBuddy(auth, "external", new AbortController().signal, { readCredential: async () => null, fetchImpl: async () => new Response("unsupported", { status: 404 }) })).rejects.toThrow("workbuddy_auth_unavailable");
});

test("binds the login server to loopback with a fresh password and keeps the edition", async () => {
  const command = { command: "electron", args: ["codebuddy", "--acp"], env: { ELECTRON_RUN_AS_NODE: "1", CODEBUDDY_INTERNET_ENVIRONMENT: "internal" } };
  const first = await prepareWorkBuddyAuth(command);
  const second = await prepareWorkBuddyAuth(command);
  expect(first.password).not.toBe(second.password);
  expect(first.endpoint).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
  expect(first.command.env.CODEBUDDY_GATEWAY_PASSWORD).toBe(first.password);
  expect(first.command.env.CODEBUDDY_GATEWAY_AUTH).toBe("password");
  expect(first.command.env.CODEBUDDY_INTERNET_ENVIRONMENT).toBe("internal");
  expect(first.command.args).toContain("stdio");
});
