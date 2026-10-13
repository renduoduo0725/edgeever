import { randomBytes, timingSafeEqual } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:http";
import { setTimeout as delay } from "node:timers/promises";

const MAX_REQUEST_BYTES = 32 * 1024 * 1024;
const FORWARDED_HEADERS = ["mcp-protocol-version", "mcp-method", "mcp-name"];

const sameSecret = (received, expected) => {
  if (typeof received !== "string") return false;
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
};

const readBody = async (request) => {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_REQUEST_BYTES) throw new Error("request_too_large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};

const TRANSIENT_SESSION_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const NOTE_ACCESS_ERRORS = {
  missing_session: "note_access_login_required",
  session_unauthenticated: "note_access_login_required",
  account_mismatch: "note_access_changed",
  session_changed: "note_access_changed",
  session_network: "note_access_network",
  session_response: "note_access_network",
  session_transient: "note_access_network",
};

// Only the read-only session check can be retried. Never replay MCP tool calls:
// a failed response can follow a successful write to the user's notes.
export async function verifyAcpNoteAccess({ baseUrl, sessionToken, accountId, isCurrent, fetchImpl = fetch, onDiagnostic = () => {} } = {}) {
  const unavailable = (reason, details = {}) => {
    // Never include URLs, tokens, response bodies, or raw error messages.
    try { onDiagnostic({ reason, ...details }); } catch { /* Diagnostics cannot block requests. */ }
    return new Error(NOTE_ACCESS_ERRORS[reason] ?? "note_access_unavailable");
  };
  const assertCurrent = () => {
    if (isCurrent && !isCurrent()) throw unavailable("session_changed");
  };
  if (typeof baseUrl !== "string" || !/^https?:\/\//.test(baseUrl)) throw unavailable("invalid_instance");
  if (typeof sessionToken !== "string" || !sessionToken.trim()) throw unavailable("missing_session");
  let instance;
  try { instance = new URL(baseUrl); }
  catch { throw unavailable("invalid_instance"); }
  if (instance.username || instance.password || instance.search || instance.hash) throw unavailable("invalid_instance");
  const origin = instance.href.replace(/\/+$/, "");
  const budget = AbortSignal.timeout(10_000);
  for (let attempt = 1; attempt <= 2; attempt++) {
    assertCurrent();
    let session;
    let identity;
    let transientReason;
    try {
      session = await fetchImpl(`${origin}/api/v1/auth/session`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
        redirect: "manual",
        signal: AbortSignal.any([budget, AbortSignal.timeout(5_000)]),
      });
      if (session.ok) {
        try { identity = await session.json(); }
        catch { transientReason = "session_response"; }
      } else {
        // Consume no potentially sensitive error body; release its connection.
        await session.body?.cancel().catch(() => {});
      }
    } catch { transientReason = "session_network"; }
    assertCurrent();
    if (!transientReason && session?.ok) {
      if (!identity || typeof identity.authenticated !== "boolean") transientReason = "session_response";
      else {
        if (!identity.authenticated) throw unavailable("session_unauthenticated");
        if (accountId && identity.user?.id !== accountId) throw unavailable("account_mismatch");
        return origin;
      }
    }
    if (!transientReason && TRANSIENT_SESSION_STATUSES.has(session.status)) transientReason = "session_transient";
    if (!transientReason) {
      if (session.status === 401) throw unavailable("session_unauthenticated");
      throw unavailable("session_http", { status: session.status });
    }
    if (attempt === 2 || budget.aborted) {
      throw unavailable(transientReason, { attempts: attempt, ...(session ? { status: session.status } : {}) });
    }
    try { await delay(250, undefined, { signal: budget }); }
    catch { throw unavailable(transientReason, { attempts: attempt }); }
  }
}

export async function startAcpMcpBridge(access = {}) {
  const origin = await verifyAcpNoteAccess(access);
  const { sessionToken, isCurrent, fetchImpl = fetch } = access;
  const secret = randomBytes(32).toString("hex");
  const server = createServer(async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    if (request.method !== "POST" || request.url !== "/mcp") {
      response.writeHead(404).end();
      return;
    }
    if (!isCurrent?.() || !sameSecret(request.headers.authorization, `Bearer ${secret}`)) {
      response.writeHead(401).end();
      return;
    }
    if (!String(request.headers["content-type"] ?? "").toLowerCase().startsWith("application/json")) {
      response.writeHead(415).end();
      return;
    }
    try {
      const body = await readBody(request);
      const headers = {
        Authorization: `Bearer ${sessionToken}`,
        Accept: "application/json, text/event-stream",
        "Content-Type": "application/json",
      };
      for (const name of FORWARDED_HEADERS) {
        if (typeof request.headers[name] === "string") headers[name] = request.headers[name];
      }
      if (!isCurrent()) throw new Error("note_access_unavailable");
      const upstream = await fetchImpl(`${origin}/mcp`, { method: "POST", headers, body, redirect: "manual" });
      if (upstream.status >= 300 && upstream.status < 400) throw new Error("unexpected_redirect");
      response.writeHead(upstream.status, { "Content-Type": upstream.headers.get("content-type") ?? "application/json" });
      if (upstream.body) {
        for await (const chunk of upstream.body) {
          if (!response.write(chunk)) await once(response, "drain");
        }
      }
      response.end();
    } catch (error) {
      if (response.headersSent) response.destroy();
      else response.writeHead(error?.message === "request_too_large" ? 413 : 502).end();
    }
  });
  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
  } catch (error) {
    server.close();
    throw error;
  }
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}`,
    secret,
    close: () => new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    }),
  };
}
