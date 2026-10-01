import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

test("ACP bridge protects the session and connects the packaged MCP adapter", () => {
  const harness = fileURLToPath(new URL("../../../../tests/fixtures/acp-mcp-bridge-stdio-harness.mjs", import.meta.url));
  const directory = mkdtempSync(join(tmpdir(), "edgeever-acp-mcp-test-"));
  try {
    const resultPath = join(directory, "result.json");
    const result = spawnSync("node", [harness], {
      encoding: "utf8",
      timeout: 10_000,
      env: { ...process.env, EDGE_EVER_TEST_RESULT_PATH: resultPath },
    });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(readFileSync(resultPath, "utf8"))).toEqual({
      security: true,
      invalidSession: true,
      stdio: true,
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}, 15_000);
