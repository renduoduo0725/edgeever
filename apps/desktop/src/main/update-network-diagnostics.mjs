const MAX_REQUESTS = 24;
const ASSET_HOSTS = new Set(["release-assets.githubusercontent.com", "objects.githubusercontent.com", "github-releases.githubusercontent.com"]);
export const sanitizeUpdateUrl = (value) => {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`.slice(0, 1500);
  } catch { return null; }
};

export const sanitizeProxyResult = (value) => String(value).split(";").slice(0, 8).map((entry) => {
  const text = entry.trim();
  if (text === "DIRECT") return text;
  const match = /^(PROXY|HTTPS|SOCKS|SOCKS4|SOCKS5|QUIC)\s+(.+)$/i.exec(text);
  if (!match) return "[unrecognized proxy]";
  try {
    const endpoint = new URL(`http://${match[2]}`);
    return `${match[1].toUpperCase()} ${endpoint.host}`;
  } catch { return "[unrecognized proxy]"; }
}).join("; ").slice(0, 500);

const isReleaseUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (
      (url.hostname === "github.com" && /^\/tianma-if\/edgeever\/releases(?:[/.]|$)/.test(url.pathname))
      || (url.hostname === "api.github.com" && /^\/repos\/tianma-if\/edgeever\/releases(?:\/|$)/.test(url.pathname))
    );
  } catch { return false; }
};
const isAssetUrl = (value) => {
  try { const url = new URL(value); return url.protocol === "https:" && ASSET_HOSTS.has(url.hostname); }
  catch { return false; }
};
const errorCode = (value) => String(value || "").match(/\b(?:ERR_[A-Z0-9_]+|E[A-Z]{3,})\b/)?.[0] || "UNKNOWN";

export const createUpdateNetworkDiagnostics = ({ now = Date.now, write = () => {}, onChange = () => {}, proxyTimeoutMs = 2000 } = {}) => {
  let checkId = 0;
  let startedAt = null;
  let endedAt = null;
  let accepting = false;
  let stage = "check";
  let requests = [];
  let omittedRequests = 0;
  const active = new Map();
  const redirects = new Set();
  const attached = new WeakSet();
  const observedSessions = [];
  const notify = (request) => {
    try { Promise.resolve(write("update.network-request", { checkId: request.checkId, ...request })).catch(() => {}); } catch {}
    try { onChange(); } catch {}
  };
  const snapshot = () => ({
    checkId, startedAt, elapsedMs: startedAt === null ? 0 : Math.max(0, (endedAt ?? now()) - startedAt),
    observedSessions: [...observedSessions],
    proxyScope: "Electron session proxy resolution; DIRECT does not rule out TUN routing.",
    omittedRequests,
    requests: requests.map((request) => ({ ...request, elapsedMs: request.status === "pending" ? Math.max(0, now() - request.startedAt) : request.elapsedMs, proxy: { ...request.proxy } })),
  });
  const observeSession = (ses, name) => {
    if (attached.has(ses)) return;
    attached.add(ses);
    observedSessions.push(name);
    const filter = { urls: ["https://github.com/tianma-if/edgeever/releases*", "https://api.github.com/repos/tianma-if/edgeever/releases*", ...[...ASSET_HOSTS].map((host) => `https://${host}/*`)] };
    const key = (id) => `${name}:${id}`;
    ses.webRequest.onBeforeRequest(filter, (details, callback) => {
      // Always release the request immediately; proxy inspection runs separately.
      callback({});
      try {
        if (!accepting || details.webContentsId > 0) return;
        const url = sanitizeUpdateUrl(details.url);
        if (!isReleaseUrl(details.url) && !(isAssetUrl(details.url) && (name === "electron-updater" || redirects.has(url)))) return;
        if (requests.length >= MAX_REQUESTS) { omittedRequests++; return; }
        const request = {
          checkId, requestId: key(details.id), session: name, stage, url,
          startedAt: now(), elapsedMs: 0, status: "pending", httpStatus: null, errorCode: null,
          proxy: { state: "pending", value: null },
        };
        requests.push(request);
        active.set(request.requestId, request);
        let timer;
        Promise.race([
          Promise.resolve().then(() => ses.resolveProxy(details.url)).then((result) => ({ state: "resolved", value: sanitizeProxyResult(result) })),
          new Promise((resolve) => { timer = setTimeout(() => resolve({ state: "timeout", value: null }), proxyTimeoutMs); timer.unref?.(); }),
        ]).catch((error) => ({ state: "failed", value: null, errorCode: errorCode(error?.code || error?.message) }))
          .then((proxy) => {
            clearTimeout(timer);
            if (request.checkId !== checkId) return;
            request.proxy = proxy;
            notify(request);
          });
      } catch {}
    });
    const finish = (details, status) => {
      const request = active.get(key(details.id));
      if (!request) return;
      active.delete(request.requestId);
      request.elapsedMs = Math.max(0, now() - request.startedAt);
      request.status = status;
      request.httpStatus = Number.isInteger(details.statusCode) ? details.statusCode : null;
      request.errorCode = status === "failed" ? errorCode(details.error) : null;
      if (status === "redirected") {
        request.redirectUrl = sanitizeUpdateUrl(details.redirectURL);
        if (request.redirectUrl && isAssetUrl(details.redirectURL)) redirects.add(request.redirectUrl);
      }
      notify(request);
    };
    ses.webRequest.onCompleted(filter, (details) => { try { finish(details, "completed"); } catch {} });
    ses.webRequest.onErrorOccurred(filter, (details) => { try { finish(details, "failed"); } catch {} });
    ses.webRequest.onBeforeRedirect(filter, (details) => { try { finish(details, "redirected"); } catch {} });
  };
  return {
    observeSession, snapshot,
    beginCheck: () => { checkId++; startedAt = now(); endedAt = null; accepting = true; stage = "check"; requests = []; omittedRequests = 0; active.clear(); redirects.clear(); },
    stop: () => { accepting = false; endedAt ??= now(); try { onChange(); } catch {} },
    setStage: (value) => { stage = value; },
  };
};
