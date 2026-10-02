import { execFileSync } from "node:child_process";

const PROXY_ENV_KEYS = ["HTTP_PROXY", "http_proxy", "HTTPS_PROXY", "https_proxy", "ALL_PROXY", "all_proxy"];

const proxyUrl = (settings, prefix) => {
  if (settings[`${prefix}Enable`] !== "1") return null;
  const host = settings[`${prefix}Proxy`];
  const port = Number(settings[`${prefix}Port`]);
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535) return null;
  const bracketed = host.includes(":") ? `[${host}]` : host;
  try {
    const url = new URL(`http://${bracketed}:${port}`);
    return url.username || url.password || url.pathname !== "/" || url.search || url.hash ? null : url.origin;
  } catch {
    return null;
  }
};

export function antigravityMacProxyEnv({ platform = process.platform, env = process.env, readProxy = () => execFileSync("/usr/sbin/scutil", ["--proxy"], { encoding: "utf8", timeout: 2_000, maxBuffer: 64 * 1024 }) } = {}) {
  if (platform !== "darwin" || PROXY_ENV_KEYS.some((key) => env[key])) return null;
  let output;
  try { output = readProxy(); } catch { return null; }
  if (typeof output !== "string") return null;
  const settings = Object.fromEntries([...output.matchAll(/^\s*(\w+)\s*:\s*([^\r\n]+)\s*$/gm)].map((match) => [match[1], match[2].trim()]));
  // The Antigravity ACP binary lacks python-socks. An HTTP proxy supplied in
  // the environment takes precedence over macOS's system SOCKS proxy.
  if (settings.SOCKSEnable !== "1") return null;
  const http = proxyUrl(settings, "HTTP");
  const https = proxyUrl(settings, "HTTPS");
  if (!http && !https) return null;
  return { ...(http ? { HTTP_PROXY: http } : {}), ...(https ? { HTTPS_PROXY: https } : {}) };
}

export function withAntigravityMacProxy(command, options) {
  const proxyEnv = antigravityMacProxyEnv(options);
  if (!proxyEnv) return command;
  const spec = typeof command === "string" ? { command, args: [] } : command;
  return { ...spec, env: { ...spec.env, ...proxyEnv } };
}
