const GITHUB_NEW_ISSUE_URL = "https://github.com/tianma-if/edgeever/issues/new";
const DESKTOP_CLIENT_BY_PLATFORM = {
  darwin: "macOS",
  win32: "Windows",
  linux: "Linux",
};
// Keep the prefilled GitHub URL below common browser/server URL limits while
// retaining the first useful frames from renderer stacks.
const MAX_DIAGNOSTIC_TEXT_LENGTH = 1_200;

export const sanitizeDesktopDiagnosticText = (value) => {
  if (typeof value !== "string") return "";
  return value
    .slice(0, MAX_DIAGNOSTIC_TEXT_LENGTH)
    .replace(/file:\/\/\/[^\s)\]}]+/gi, (match) => {
      const asset = match.match(/\/assets\/[^/:\s)\]}]+(?:\.js|\.css)(?::\d+){0,2}$/i);
      return asset ? `file:///[app]${asset[0]}` : "file:///[redacted-path]";
    })
    .replace(/https?:\/\/[^\s)\]}]+/gi, "[redacted-url]")
    .replace(/\/Users\/[^/\s]+/g, "/Users/[redacted]")
    .replace(/([A-Za-z]:\\Users\\)[^\\\s]+/gi, "$1[redacted]")
    .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [redacted]")
    .replace(/((?:["']?(?:token|password|secret|api[_-]?key)["']?)\s*[=:]\s*["']?)[^"',;\s}]+/gi, "$1[redacted]");
};

export const normalizeDesktopDiagnostic = (input = {}) => {
  const source = input && typeof input === "object" ? input : {};
  return {
    kind: sanitizeDesktopDiagnosticText(source.kind) || "unknown",
    message: sanitizeDesktopDiagnosticText(source.message),
    stack: sanitizeDesktopDiagnosticText(source.stack),
    componentStack: sanitizeDesktopDiagnosticText(source.componentStack),
    reason: sanitizeDesktopDiagnosticText(source.reason),
    exitCode: Number.isFinite(source.exitCode) ? source.exitCode : null,
  };
};

export const buildDesktopDiagnosticIssueUrl = ({ diagnostic, systemInfo }) => {
  const normalized = normalizeDesktopDiagnostic(diagnostic);
  const safeSystemInfo = {
    appVersion: sanitizeDesktopDiagnosticText(systemInfo.appVersion),
    platform: sanitizeDesktopDiagnosticText(systemInfo.platform),
    architecture: sanitizeDesktopDiagnosticText(systemInfo.architecture),
    deviceModel: sanitizeDesktopDiagnosticText(systemInfo.deviceModel),
    osVersion: sanitizeDesktopDiagnosticText(systemInfo.osVersion),
    osRelease: sanitizeDesktopDiagnosticText(systemInfo.osRelease),
    electron: sanitizeDesktopDiagnosticText(systemInfo.electron),
    chrome: sanitizeDesktopDiagnosticText(systemInfo.chrome),
    gpu: sanitizeDesktopDiagnosticText(systemInfo.gpu),
    gpuFeatures: sanitizeDesktopDiagnosticText(systemInfo.gpuFeatures),
  };
  const title = `[Crash] Desktop renderer failure (${safeSystemInfo.platform} ${safeSystemInfo.architecture})`;
  const systemInfoText = Object.entries(safeSystemInfo)
    .filter(([, value]) => value)
    .map(([key, value]) => `- ${key}: ${value}`)
    .join("\n");
  const client = DESKTOP_CLIENT_BY_PLATFORM[safeSystemInfo.platform] ?? "";
  const makeUrl = (reportDiagnostic) => {
    const params = new URLSearchParams({
      template: "bug.yml",
      title,
      "system-info": systemInfoText,
      diagnostics: JSON.stringify({ diagnostic: reportDiagnostic, systemInfo: safeSystemInfo }, null, 2),
    });
    if (client) params.set("client", client);
    return `${GITHUB_NEW_ISSUE_URL}?${params.toString()}`;
  };

  const fullUrl = makeUrl(normalized);
  if (fullUrl.length < 8_000) return fullUrl;
  return makeUrl({
    ...normalized,
    message: normalized.message.slice(0, 200),
    stack: normalized.stack.slice(0, 300),
    componentStack: normalized.componentStack.slice(0, 200),
    reason: normalized.reason.slice(0, 100),
  });
};
