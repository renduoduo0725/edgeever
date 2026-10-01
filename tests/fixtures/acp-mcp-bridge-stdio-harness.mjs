import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { startAcpMcpBridge } from "../../apps/desktop/src/main/acp-mcp-bridge.mjs";

const sessionToken = "long-lived-session";
const authorizations = [];
const upstream = createServer((request, response) => {
  authorizations.push(request.headers.authorization);
  response.setHeader("Content-Type", "application/json");
  if (request.url === "/api/v1/auth/session") {
    response.end(JSON.stringify({
      authenticated: request.headers.authorization === `Bearer ${sessionToken}`,
      user: { id: "account-one" },
    }));
    return;
  }
  response.end(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { tools: [] } }));
});

let bridge;
let child;
let current = true;
try {
  await new Promise((resolve, reject) => {
    upstream.once("error", reject);
    upstream.listen(0, "127.0.0.1", resolve);
  });
  bridge = await startAcpMcpBridge({
    baseUrl: `http://127.0.0.1:${upstream.address().port}`,
    sessionToken,
    isCurrent: () => current,
  });
  assert.equal(bridge.url.includes(sessionToken), false);
  assert.notEqual(bridge.secret, sessionToken);
  const requestBridge = (secret) => fetch(`${bridge.url}/mcp`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
  });
  assert.equal((await requestBridge("wrong")).status, 401);
  assert.equal(authorizations.length, 1);
  assert.equal((await requestBridge(bridge.secret)).status, 200);
  assert.equal(authorizations.at(-1), `Bearer ${sessionToken}`);
  current = false;
  assert.equal((await requestBridge(bridge.secret)).status, 401);
  assert.equal(authorizations.length, 2);
  current = true;

  const upstreamUrl = `http://127.0.0.1:${upstream.address().port}`;
  await assert.rejects(startAcpMcpBridge({
    baseUrl: upstreamUrl,
    sessionToken: "invalid-session",
    isCurrent: () => true,
  }), /note_access_unavailable/);
  await assert.rejects(startAcpMcpBridge({
    baseUrl: upstreamUrl,
    sessionToken,
    accountId: "account-two",
    isCurrent: () => true,
  }), /note_access_unavailable/);

  const script = fileURLToPath(new URL("../../scripts/edgeever-mcp-stdio.mjs", import.meta.url));
  child = spawn(process.execPath, [script], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, EDGEEVER_URL: bridge.url, EDGEEVER_TOKEN: bridge.secret },
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
  const responsePromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`MCP stdio adapter timed out: ${stderr}`)), 5_000);
    child.stdout.once("data", (chunk) => {
      clearTimeout(timeout);
      try { resolve(JSON.parse(chunk.toString("utf8").trim())); }
      catch (error) { reject(error); }
    });
    child.once("error", reject);
    child.once("close", (code) => reject(new Error(`MCP stdio adapter exited ${code}: ${stderr}`)));
  });
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" })}\n`);
  const response = await responsePromise;
  assert.deepEqual(response.result, { tools: [] });
  assert.equal(authorizations.at(-1), `Bearer ${sessionToken}`);
  writeFileSync(process.env.EDGE_EVER_TEST_RESULT_PATH, JSON.stringify({ security: true, invalidSession: true, stdio: true }));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  child?.kill();
  if (bridge) await bridge.close();
  await new Promise((resolve) => upstream.close(resolve));
}
