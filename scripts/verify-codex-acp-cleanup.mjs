// Run with Node (Electron's runtime) and an installed official codex-acp entry point.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createAcpHostRuntime, stopAcpChild } from "../apps/desktop/src/main/acp-host.mjs";

const entry = path.resolve(process.argv[2] ?? "");
assert.ok(process.argv[2] && existsSync(entry), "Pass the installed codex-acp dist/index.js");
const root = await mkdtemp(path.join(tmpdir(), "edgeever-acp-codex-smoke-"));
const home = path.join(root, "home");
await mkdir(home);
let child;
let closed = false;
let workspace;
let cleaned = false;

// Capture process IDs only, never command lines (which may contain credentials).
const processTree = (parentPid) => {
  const rows = process.platform === "win32"
    ? JSON.parse(execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
      "ConvertTo-Json -Compress -InputObject @(Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId)",
    ], { encoding: "utf8", windowsHide: true, timeout: 10_000 })).map((row) => [row.ProcessId, row.ParentProcessId])
    : execFileSync("ps", ["-axo", "pid=,ppid="], { encoding: "utf8", timeout: 10_000 })
      .trim().split("\n").map((line) => line.trim().split(/\s+/).map(Number));
  const descendants = new Set([parentPid]);
  let count;
  do {
    count = descendants.size;
    for (const [pid, ppid] of rows) if (descendants.has(ppid)) descendants.add(pid);
  } while (count !== descendants.size);
  descendants.delete(parentPid);
  return [...descendants];
};
let descendants;
let snapshotError;
const runtime = createAcpHostRuntime({
  tmpRoot: root,
  handshakeTimeoutMs: 30_000,
  adapterManager: { get: () => ({ command: {
    command: process.execPath,
    args: [entry],
    env: { HOME: home, USERPROFILE: home, CODEX_HOME: home },
    unsetEnv: Object.keys(process.env).filter((key) => /API_KEY|TOKEN|SECRET|PASSWORD|AUTHORIZATION/i.test(key)),
  } }) },
  spawnImpl: (...args) => {
    child = spawn(...args);
    child.once("close", () => { closed = true; });
    let output = "";
    child.stdout.on("data", (chunk) => {
      if (descendants || snapshotError) return;
      output += chunk;
      const lines = output.split("\n");
      output = lines.pop();
      for (const line of lines) {
        let message;
        try { message = JSON.parse(line); } catch { continue; }
        if (message.result?.protocolVersion == null) continue;
        try { descendants = processTree(child.pid); } catch (error) { snapshotError = error; }
      }
    });
    return child;
  },
  rm: async (directory, options) => {
    workspace = directory;
    assert.equal(closed, true, "Codex ACP must close before workspace cleanup");
    await rm(directory, options);
    cleaned = true;
  },
});
try {
  const result = await runtime.probeAdapter({ id: "codex" });
  assert.ok(["available", "needs_login"].includes(result.state), JSON.stringify(result));
  assert.ok(child?.pid, "The official adapter must actually start");
  assert.ifError(snapshotError);
  assert.ok(descendants?.length > 0, "Initialization must start the real Codex descendant process chain");
  assert.equal(closed, true);
  assert.equal(cleaned, true);
  assert.equal(existsSync(workspace), false);
  const alive = (pid) => {
    try { process.kill(pid, 0); return true; } catch (error) {
      if (error.code === "ESRCH") return false;
      throw error;
    }
  };
  const deadline = Date.now() + 5_000;
  while (descendants.some(alive) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.deepEqual(descendants.filter(alive), [], "Codex descendants must exit too");
  console.log(`Official Codex ACP probe: ${result.state}; process chain closed and workspace removed.`);
} finally {
  await stopAcpChild(child);
  for (const pid of descendants ?? []) {
    try { process.kill(pid, "SIGKILL"); } catch { /* already gone */ }
  }
  await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
