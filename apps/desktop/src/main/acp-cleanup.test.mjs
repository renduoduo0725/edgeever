import { describe, expect, test } from "bun:test";
import { execFile, spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { createAcpHostRuntime, removeAcpWorkspace, stopAcpChild } from "./acp-host.mjs";

describe("ACP process and workspace cleanup", () => {
  test("waits for process closure and shares repeated stop requests", async () => {
    const child = new EventEmitter();
    const signals = [];
    child.kill = (signal) => { signals.push(signal); };
    const stopped = stopAcpChild(child);
    expect(stopAcpChild(child)).toBe(stopped);
    let resolved = false;
    void stopped.then(() => { resolved = true; });
    await Promise.resolve();
    expect(resolved).toBe(false);
    child.signalCode = "SIGTERM";
    child.emit("exit", null, "SIGTERM");
    await Promise.resolve();
    expect(resolved).toBe(false);
    child.emit("close", null, "SIGTERM");
    await stopped;
    expect(signals).toEqual(["SIGTERM"]);
    expect(child.listenerCount("close")).toBe(0);
  });

  // Windows does not retain this inherited Node pipe like POSIX; use the real cwd-lock
  // and official Codex process-chain checks there, plus the lifecycle tests below.
  test.skipIf(process.platform === "win32")("waits when stopped after exit while a real descendant retains stdout", async () => {
    // Use Node, matching Electron, rather than Bun's different child-pipe lifecycle.
    const source = `
      import assert from "node:assert/strict";
      import { spawn } from "node:child_process";
      import { once } from "node:events";
      import { spawnAcpChild, stopAcpChild } from ${JSON.stringify(new URL("./acp-host.mjs", import.meta.url).href)};
      const parent = await spawnAcpChild(spawn, {
        command: process.execPath,
        args: ["-e", \`const { spawn } = require("node:child_process");
          const descendant = spawn(process.execPath, ["-e", "setTimeout(() => {}, 1000)"], {
            stdio: ["ignore", process.stdout, "ignore"], windowsHide: true,
          });
          descendant.once("spawn", () => process.exit(0));\`],
      }, process.cwd());
      let closed = false;
      parent.once("close", () => { closed = true; });
      await once(parent, "exit");
      assert.equal(closed, false);
      const stopped = stopAcpChild(parent);
      assert.equal(stopAcpChild(parent), stopped);
      let resolved = false;
      stopped.then(() => { resolved = true; });
      await new Promise(resolve => setTimeout(resolve, 50));
      assert.equal(resolved, false);
      await stopped;
      assert.equal(closed, true);
      assert.equal(stopAcpChild(parent), stopped);
    `;
    await promisify(execFile)("node", ["--input-type=module", "-e", source], { windowsHide: true, timeout: 10_000 });
  });

  test("returns immediately when a tracked process closed before the first stop request", async () => {
    const source = `
      import { spawn } from "node:child_process";
      import { once } from "node:events";
      import { spawnAcpChild, stopAcpChild } from ${JSON.stringify(new URL("./acp-host.mjs", import.meta.url).href)};
      // Also cover a process that has closed before stop is first requested.
      const finished = await spawnAcpChild(spawn, { command: process.execPath, args: ["-e", ""] }, process.cwd());
      await once(finished, "close");
      await Promise.race([
        stopAcpChild(finished),
        new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error("already closed child was awaited")), 100); timer.unref(); }),
      ]);
    `;
    await promisify(execFile)("node", ["--input-type=module", "-e", source], { windowsHide: true, timeout: 10_000 });
  });

  for (const exited of [{ exitCode: 0 }, { signalCode: "SIGTERM" }]) {
    test(`waits for close after ${Object.keys(exited)[0]} is set without signalling the exited process`, async () => {
      const child = Object.assign(new EventEmitter(), exited);
      let signals = 0;
      child.kill = () => { signals += 1; };
      let resolved = false;
      const stopped = stopAcpChild(child);
      void stopped.then(() => { resolved = true; });
      await Promise.resolve();
      expect(resolved).toBe(false);
      child.emit("close");
      await stopped;
      expect(child.listenerCount("close")).toBe(0);
      expect(signals).toBe(0);
    });
  }

  test("bounds shutdown when a child ignores termination", async () => {
    const child = new EventEmitter();
    const signals = [];
    child.kill = (signal) => { signals.push(signal); };
    await stopAcpChild(child);
    expect(signals).toEqual(["SIGTERM", "SIGKILL"]);
    expect(child.listenerCount("close")).toBe(0);
  });

  test.skipIf(process.platform !== "win32")("retries a real Windows cwd lock until the process releases it", async () => {
    // Electron uses Node's fs.rm implementation. Bun currently ignores its
    // maxRetries option, so exercise the native lock with Node rather than Bun.
    const source = `
      import assert from "node:assert/strict";
      import { spawn } from "node:child_process";
      import { once } from "node:events";
      import { existsSync } from "node:fs";
      import { mkdtemp, rm } from "node:fs/promises";
      import { tmpdir } from "node:os";
      import path from "node:path";
      import { removeAcpWorkspace, stopAcpChild } from ${JSON.stringify(new URL("./acp-host.mjs", import.meta.url).href)};
      const directory = await mkdtemp(path.join(tmpdir(), "edgeever-acp-lock-"));
      const child = spawn(process.execPath, ["-e", 'process.stdout.write("ready"); process.stdin.resume()'], {
        cwd: directory, stdio: ["pipe", "pipe", "ignore"], windowsHide: true, shell: false,
      });
      try {
        await once(child.stdout, "data");
        await assert.rejects(rm(directory, { recursive: true, force: true }), { code: "EBUSY" });
        const release = setTimeout(() => { void stopAcpChild(child); }, 150);
        try { await removeAcpWorkspace(directory); } finally { clearTimeout(release); }
        assert.equal(existsSync(directory), false);
      } finally {
        await stopAcpChild(child);
        await removeAcpWorkspace(directory);
      }
    `;
    await promisify(execFile)("node", ["--input-type=module", "-e", source], { windowsHide: true, timeout: 10_000 });
  });

  for (const { needsLogin, connectionFails = false, cleanupFails = false } of [
    { needsLogin: false }, { needsLogin: false, cleanupFails: true }, { needsLogin: true }, { needsLogin: true, cleanupFails: true },
    { needsLogin: false, connectionFails: true, cleanupFails: true },
  ]) {
    test(`closes a real ACP process before cleanup (${connectionFails ? "connection failure" : needsLogin ? "login required" : "connected"}${cleanupFails ? ", cleanup failure preserves probe status" : ""})`, async () => {
      const directory = await mkdtemp(path.join(tmpdir(), "edgeever-acp-lifecycle-"));
      const script = path.join(directory, "agent.mjs");
      await writeFile(script, `
        import { createInterface } from "node:readline";
        createInterface({ input: process.stdin }).on("line", (line) => {
          const request = JSON.parse(line);
          const result = request.method === "initialize"
            ? { protocolVersion: 1, agentCapabilities: {}, authMethods: [{ id: "login", name: "Log in" }] }
            : { sessionId: "test-session" };
          const response = ${needsLogin || connectionFails} && request.method === "session/new"
            ? { error: { code: ${connectionFails ? -32603 : -32000}, message: ${JSON.stringify(connectionFails ? "transport broken" : "Authentication required")} } }
            : { result };
          process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: request.id, ...response }) + "\\n");
        });
      `);
      let child;
      let cleaned = false;
      let closed = false;
      const runtime = createAcpHostRuntime({
        adapterManager: { get: () => ({ version: "2.2.1", command: { command: process.execPath, args: [script] } }) },
        spawnImpl: (...args) => { child = spawn(...args); child.once("close", () => { closed = true; }); return child; },
        rm: async (cwd, options) => {
          expect(closed).toBe(true);
          await rm(cwd, options);
          cleaned = true;
          if (cleanupFails) throw Object.assign(new Error("workspace still locked"), { code: "EBUSY" });
        },
      });
      try {
        const result = await runtime.probeAdapter({ id: "codex" });
        expect(result.state).toBe(connectionFails ? "failed" : needsLogin ? "needs_login" : "available");
        if (connectionFails) expect(result.detail).toContain("transport broken");
        expect(cleaned).toBe(true);
      } finally {
        await stopAcpChild(child);
        await removeAcpWorkspace(directory);
      }
    }, 15_000);
  }
});
