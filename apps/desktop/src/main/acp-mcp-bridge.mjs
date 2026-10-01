import { randomBytes, timingSafeEqual } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:http";

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

export async function startAcpMcpBridge({ baseUrl, sessionToken, accountId, isCurrent, fetchImpl = fetch } = {}) {
  if (typeof baseUrl !== "string" || !/^https?:\/\//.test(baseUrl) || !sessionToken) {
    throw new Error("note_access_unavailable");
  }
  let instance;
  try { instance = new URL(baseUrl); }
  catch { throw new Error("note_access_unavailable"); }
  if (instance.username || instance.password || instance.search || instance.hash) throw new Error("note_access_unavailable");
  const origin = instance.href.replace(/\/+$/, "");
  let session;
  try {
    session = await fetchImpl(`${origin}/api/v1/auth/session`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
  } catch { throw new Error("note_access_unavailable"); }
  const identity = await session.json().catch(() => null);
  if (!session.ok || identity?.authenticated !== true || (accountId && identity?.user?.id !== accountId)) {
    throw new Error("note_access_unavailable");
  }

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
