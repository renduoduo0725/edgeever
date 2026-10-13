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
      retryRecovery: true,
      noWriteReplay: true,
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}, 15_000);

import { verifyAcpNoteAccess } from "./acp-mcp-bridge.mjs";

const access = { baseUrl: "https://private-instance.example", sessionToken: "secret-token", accountId: "current-account", isCurrent: () => true };
const authenticatedSession = () => Response.json({ authenticated: true, user: { id: "current-account" } });

test("session preflight recovers from a dropped connection without exposing credentials", async () => {
  const requests = [];
  const diagnostics = [];
  const origin = await verifyAcpNoteAccess({ ...access,
    onDiagnostic: details => diagnostics.push(details),
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      if (requests.length === 1) throw new Error("secret-token private response");
      return authenticatedSession();
    },
  });
  expect(origin).toBe(access.baseUrl);
  expect(requests).toHaveLength(2);
  expect(requests.every(({ url, init }) => url.endsWith("/api/v1/auth/session") && init.headers.Authorization === "Bearer secret-token" && init.redirect === "manual")).toBe(true);
  expect(diagnostics).toEqual([]);
});

for (const status of [408, 429, 500, 502, 503, 504]) {
  test(`session preflight recovers from HTTP ${status}`, async () => {
    let attempts = 0;
    await expect(verifyAcpNoteAccess({ ...access, fetchImpl: async () => ++attempts === 1 ? new Response("unavailable", { status }) : authenticatedSession() })).resolves.toBe(access.baseUrl);
    expect(attempts).toBe(2);
  });
}

for (const brokenResponse of [() => new Response("truncated json"), () => Response.json({})]) {
  test("session preflight retries an unreadable response instead of misreporting a lost login", async () => {
    let attempts = 0;
    await expect(verifyAcpNoteAccess({ ...access, fetchImpl: async () => ++attempts === 1 ? brokenResponse() : authenticatedSession() })).resolves.toBe(access.baseUrl);
    expect(attempts).toBe(2);
  });
}

test("persistent connection failure is bounded and reports a safe network error", async () => {
  let attempts = 0;
  const diagnostics = [];
  await expect(verifyAcpNoteAccess({ ...access,
    onDiagnostic: details => diagnostics.push(details),
    fetchImpl: async () => { attempts++; throw new Error("secret-token private response"); },
  })).rejects.toThrow("note_access_network");
  expect(attempts).toBe(2);
  expect(diagnostics).toEqual([{ reason: "session_network", attempts: 2 }]);
});

test("a stalled session request times out and retries within the overall budget", async () => {
  let attempts = 0;
  await expect(verifyAcpNoteAccess({ ...access, fetchImpl: async (_url, { signal }) => {
    attempts++;
    if (attempts === 2) return authenticatedSession();
    return new Promise((resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
  } })).resolves.toBe(access.baseUrl);
  expect(attempts).toBe(2);
}, 8_000);

test("session rejection and account mismatch fail closed without retrying or launching an agent", async () => {
  const cases = [
    { sessionToken: "", reason: "missing_session", error: "note_access_login_required", calls: 0 },
    { fetchImpl: async () => Response.json({ authenticated: false }), reason: "session_unauthenticated", error: "note_access_login_required", calls: 1 },
    { fetchImpl: async () => new Response("rejected", { status: 401 }), reason: "session_unauthenticated", error: "note_access_login_required", calls: 1 },
    { fetchImpl: async () => Response.json({ authenticated: true, user: { id: "another-account" } }), reason: "account_mismatch", error: "note_access_changed", calls: 1 },
    { fetchImpl: async () => new Response("redirect", { status: 302 }), reason: "session_http", error: "note_access_unavailable", status: 302, calls: 1 },
    { fetchImpl: async () => new Response("forbidden", { status: 403 }), reason: "session_http", error: "note_access_unavailable", status: 403, calls: 1 },
  ];
  for (const { reason, error, status, calls, fetchImpl = authenticatedSession, ...overrides } of cases) {
    let attempts = 0;
    const diagnostics = [];
    await expect(verifyAcpNoteAccess({ ...access, ...overrides,
      onDiagnostic: details => diagnostics.push(details),
      fetchImpl: async () => { attempts++; return fetchImpl(); },
    })).rejects.toThrow(error);
    expect(attempts).toBe(calls);
    expect(diagnostics).toEqual([{ reason, ...(status ? { status } : {}) }]);
  }
});

test("switching account during preflight stops the request before a retry", async () => {
  let current = true;
  let attempts = 0;
  await expect(verifyAcpNoteAccess({ ...access, isCurrent: () => current, fetchImpl: async () => {
    attempts++;
    current = false;
    throw new Error("disconnected");
  } })).rejects.toThrow("note_access_changed");
  expect(attempts).toBe(1);
});

test("switching account during retry backoff prevents another request", async () => {
  let attempts = 0;
  // Checked before each fetch, after each fetch, and again after backoff.
  let checks = 0;
  await expect(verifyAcpNoteAccess({ ...access, isCurrent: () => ++checks <= 2, fetchImpl: async () => {
    attempts++;
    throw new Error("disconnected");
  } })).rejects.toThrow("note_access_changed");
  expect(attempts).toBe(1);
});

test("diagnostic failures cannot replace the note access error", async () => {
  await expect(verifyAcpNoteAccess({ ...access, sessionToken: "", onDiagnostic: () => { throw new Error("log failed"); } })).rejects.toThrow("note_access_login_required");
});

test("persistent timeouts stop within the overall ten-second budget", async () => {
  let attempts = 0;
  const started = Date.now();
  await expect(verifyAcpNoteAccess({ ...access, fetchImpl: async (_url, { signal }) => {
    attempts++;
    return new Promise((resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
  } })).rejects.toThrow("note_access_network");
  expect(attempts).toBe(2);
  expect(Date.now() - started).toBeLessThan(11_000);
}, 12_000);
