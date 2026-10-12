import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { createAcpAdapterManager } from "../apps/desktop/src/main/acp-adapter-manager.mjs";
import { executeRealAcpHandshake } from "./verify-acp-adapter-real-e2e.mjs";

// Opt-in network verification: real published packages, real npm extraction,
// and ACP initialize only. Never authenticate or send a model prompt.
export const verifyAcpNpmUpgrade = async ({ oldNpmPath, executablePath = process.execPath }) => {
  assert.ok(oldNpmPath && existsSync(oldNpmPath), "Provide the previous npm CLI path");
  const root = await mkdtemp(path.join(tmpdir(), "edgeever-acp-npm-upgrade-"));
  let version = "2.2.1";
  const fetchImpl = async () => new Response(JSON.stringify({ agents: [{
    id: "codex-acp",
    version,
    distribution: { npx: { package: `@agentclientprotocol/codex-acp@${version}` } },
  }] }));
  const common = { root, fetchImpl, executablePath };
  const validate = async (command) => {
    const result = await executeRealAcpHandshake(command);
    assert.equal(result.state, "available");
    assert.equal(result.protocolVersion, 1);
    return result;
  };
  try {
    const previous = createAcpAdapterManager({ ...common, npmPath: oldNpmPath });
    assert.equal((await previous.install("codex", validate)).version, version);
    console.log("Previous npm installed official codex-acp 2.2.1; ACP initialize passed");

    const current = createAcpAdapterManager(common);
    assert.equal(current.get("codex")?.version, version);
    version = "2.2.2";
    await assert.rejects(current.install("codex", async (command) => {
      await validate(command);
      throw new Error("intentional_validation_failure");
    }, { updateOnly: true }), /intentional_validation_failure/);
    assert.equal(current.get("codex")?.version, "2.2.1");
    await validate(current.get("codex").command);
    console.log("Failed upgrade preserved the working previous adapter");

    assert.equal((await current.install("codex", validate, { updateOnly: true })).version, version);
    const restarted = createAcpAdapterManager(common);
    assert.equal(restarted.get("codex")?.version, version);
    await validate(restarted.get("codex").command);
    await restarted.prune();
    const names = await readdir(path.join(root, "codex"));
    assert.ok(names.includes("2.2.1") && names.includes("2.2.2"));
    assert.ok(!names.some((name) => name.startsWith(".stage-")));
    console.log("Current npm upgraded to official codex-acp 2.2.2; restart, ACP initialize, and fallback retention passed");
    return { ok: true, oldAdapter: "2.2.1", newAdapter: "2.2.2" };
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

if (import.meta.main) {
  const desktopRequire = createRequire(new URL("../apps/desktop/package.json", import.meta.url));
  const electronRoot = path.dirname(desktopRequire.resolve("electron/package.json"));
  const defaultExecutablePath = process.platform === "darwin"
    ? path.join(electronRoot, "dist/Electron.app/Contents/MacOS/Electron")
    : path.join(electronRoot, "dist", process.platform === "win32" ? "electron.exe" : "electron");
  const executablePath = process.argv[3] ? path.resolve(process.argv[3]) : defaultExecutablePath;
  assert.ok(process.argv[2], "Provide the previous npm CLI path");
  const oldNpmPath = path.resolve(process.argv[2]);
  assert.ok(existsSync(executablePath), "Provide an installed Electron or Node runtime path");
  console.log(JSON.stringify(await verifyAcpNpmUpgrade({ oldNpmPath, executablePath })));
}
