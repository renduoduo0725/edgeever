import { spawnSync } from "node:child_process";
import { createHash, createHmac, createSign, randomUUID } from "node:crypto";
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
export const OFFICIAL_REPOSITORY = "tianma-if/edgeever";
export const CHROME_PUBLISHER_ID = "8c414fb4-4243-4b51-9e6b-fe05e49307e3";
export const CHROME_EXTENSION_ID = "gjadpfmanienmlofajibkfkkpfdkclgo";
export const FIREFOX_ADDON_SLUG = "edgeever-web-clipper";
export const FIREFOX_ADDON_ID = "web-clipper@edgeever.org";
export const FIREFOX_LICENSE_SLUG = "AGPL-3.0-only";
const CHROME_SCOPE = "https://www.googleapis.com/auth/chromewebstore";
const SOURCE_SKIP_DIRECTORIES = new Set([
  "node_modules",
  "dist",
  "dist-firefox",
  "web-ext-artifacts",
  ".git",
]);
const ROOT_SOURCE_FILES = [
  "LICENSE",
  "package.json",
  "bun.lock",
  "bunfig.toml",
  "tsconfig.json",
];
export const SHARED_EXTENSION_SOURCE_FILES = [
  "packages/shared/src/ai-generation.ts",
  "packages/shared/src/provider-event-stream.ts",
  "packages/shared/src/video-outline.ts",
  "apps/web/src/components/ui/button.tsx",
  "apps/web/src/components/ui/input.tsx",
  "apps/web/src/components/ui/button-tooltip.tsx",
  "apps/web/src/components/ui/tooltip.tsx",
  "apps/web/src/lib/utils.ts",
];

const usage = `Usage:
  bun run publish:extension -- [options]

Options:
  --platform <target>   chrome, firefox, or both (default: both)
  --notes <text>        Firefox release notes
  --notes-file <path>   Firefox release notes file
  --dry-run             Build the packages without calling the stores
  --help                Show this help

Chrome and Edge share the Chrome Web Store item ${CHROME_EXTENSION_ID}.
Firefox is submitted separately to ${FIREFOX_ADDON_SLUG}.
`;

export const parsePublishArgs = (argv) => {
  const options = {
    platform: "both",
    notes: "",
    notesFile: "",
    dryRun: false,
    help: false,
  };
  const valueOptions = new Map([
    ["--platform", "platform"],
    ["--notes", "notes"],
    ["--notes-file", "notesFile"],
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (argument === "--help") {
      options.help = true;
      continue;
    }
    const key = valueOptions.get(argument);
    if (!key) {
      throw new Error(`Unknown option: ${argument}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${argument} requires a value.`);
    }
    options[key] = value;
    index += 1;
  }

  if (!options.help && !["chrome", "firefox", "both"].includes(options.platform)) {
    throw new Error("--platform must be chrome, firefox, or both.");
  }
  return options;
};

export const compareVersions = (left, right) => {
  const parse = (value) => {
    if (!/^\d+\.\d+\.\d+$/.test(value)) {
      throw new Error(`Extension version must use X.Y.Z, received ${value}.`);
    }
    return value.split(".").map((part) => Number(part));
  };
  const leftParts = parse(left);
  const rightParts = parse(right);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] - rightParts[index];
    }
  }
  return 0;
};

export const highestCrxVersion = (revision) => {
  const versions = (revision?.distributionChannels ?? [])
    .map((channel) => channel.crxVersion)
    .filter((version) => typeof version === "string" && version.length > 0);
  return versions.sort(compareVersions).at(-1) ?? "";
};

export const chromeSubmissionPlan = ({ packageVersion, status }) => {
  const published = highestCrxVersion(status?.publishedItemRevisionStatus);
  const submitted = highestCrxVersion(status?.submittedItemRevisionStatus);
  const submittedState = status?.submittedItemRevisionStatus?.state ?? "";
  const pending = submittedState === "PENDING_REVIEW" || submittedState === "STAGED";

  if (published && compareVersions(packageVersion, published) <= 0) {
    return { action: "already-published", published };
  }
  if (submitted && compareVersions(packageVersion, submitted) === 0 && pending) {
    return { action: "already-submitted", published, submitted, submittedState };
  }
  if (submitted && pending) {
    return {
      action: "waiting-review",
      reason: `Chrome ${submitted} is ${submittedState}. Wait for that review, or cancel it, before submitting ${packageVersion}.`,
    };
  }
  return { action: "upload", published, submitted, submittedState };
};

export const firefoxSubmissionPlan = ({ packageVersion, versions }) => {
  const listed = versions.filter((version) => version?.version);
  const same = listed.find((version) => version.version === packageVersion);
  if (same) {
    const status = same.file?.status ?? "";
    if (status === "public") {
      return { action: "already-published", version: same.version, status };
    }
    if (status === "unreviewed" && !same.source) {
      return { action: "attach-source", version: same.version, status };
    }
    if (status === "unreviewed") {
      return { action: "already-submitted", version: same.version, status };
    }
    return {
      action: "blocked",
      reason: `Firefox version ${packageVersion} is ${status || "already used"}. Increase apps/extension/package.json before submitting again.`,
    };
  }

  const newerPublic = listed.find((version) => version.file?.status === "public" && compareVersions(version.version, packageVersion) > 0);
  if (newerPublic) {
    return { action: "already-published", version: newerPublic.version, status: "public" };
  }
  const awaiting = listed.find((version) => version.file?.status === "unreviewed");
  if (awaiting) {
    return {
      action: "waiting-review",
      reason: `Firefox ${awaiting.version} is still awaiting review.`,
    };
  }
  const newer = listed.find((version) => compareVersions(version.version, packageVersion) > 0);
  if (newer) {
    return {
      action: "blocked",
      reason: `Firefox already has ${newer.version}. Increase apps/extension/package.json before submitting ${packageVersion}.`,
    };
  }
  return { action: "upload" };
};

export const chromeUploadFinished = (payload) => {
  const state = payload?.uploadState || payload?.lastAsyncUploadState || "";
  if (state.includes("FAIL") || state === "NOT_FOUND") {
    return { done: true, ok: false, state };
  }
  if (state.includes("PROGRESS")) {
    return { done: false, ok: false, state };
  }
  if (state.includes("SUCCEED") || state === "SUCCESS") {
    return { done: true, ok: true, state };
  }
  if (payload?.itemId && !state) {
    return { done: true, ok: true, state: "SUCCEEDED" };
  }
  return { done: false, ok: false, state };
};

export const amoUploadReady = (upload) => {
  if (!upload?.processed) {
    return { done: false, ok: false };
  }
  if (upload.valid === false) {
    return { done: true, ok: false };
  }
  return { done: true, ok: true };
};

export const amoValidationErrors = (upload) => {
  const messages = upload?.validation?.messages
    ?? upload?.validation?.errors
    ?? [];
  return messages
    .filter((message) => !message.type || message.type === "error")
    .map((message) => message.message || JSON.stringify(message));
};

export const credentialPresence = (env) => ({
  chromeServiceAccount: Boolean(env.CHROME_WEB_STORE_SERVICE_ACCOUNT_JSON),
  chromeRefreshToken: Boolean(
    env.CHROME_WEB_STORE_CLIENT_ID
    && env.CHROME_WEB_STORE_CLIENT_SECRET
    && env.CHROME_WEB_STORE_REFRESH_TOKEN,
  ),
  amo: Boolean(env.AMO_JWT_ISSUER && env.AMO_JWT_SECRET),
  reviewInstance: Boolean(
    env.EDGE_EVER_REVIEW_INSTANCE_URL && env.EDGE_EVER_REVIEW_API_TOKEN,
  ),
});

export const assertCredentials = (platform, env) => {
  const present = credentialPresence(env);
  const missing = [];
  if ((platform === "chrome" || platform === "both") && !present.chromeServiceAccount && !present.chromeRefreshToken) {
    missing.push("CHROME_WEB_STORE_SERVICE_ACCOUNT_JSON or CHROME_WEB_STORE_CLIENT_ID, CHROME_WEB_STORE_CLIENT_SECRET, and CHROME_WEB_STORE_REFRESH_TOKEN");
  }
  if ((platform === "firefox" || platform === "both") && !present.amo) {
    missing.push("AMO_JWT_ISSUER and AMO_JWT_SECRET");
  }
  if (missing.length > 0) {
    throw new Error(`Missing Web Clipper store credentials: ${missing.join("; ")}.`);
  }
};

export const assertOfficialRepository = (repository) => {
  if (repository && repository !== OFFICIAL_REPOSITORY) {
    throw new Error(`Web Clipper store submission runs only in ${OFFICIAL_REPOSITORY}.`);
  }
};

export const resolveReleaseNotes = ({ notes, notesFile, version }) => {
  const inline = notes?.trim() ?? "";
  if (inline) {
    return limitNotes(inline);
  }
  if (notesFile) {
    const fromFile = readFileSync(notesFile, "utf8").trim();
    if (fromFile) {
      return limitNotes(fromFile);
    }
  }
  return `EdgeEver Web Clipper ${version}.`;
};

const limitNotes = (notes) => {
  if (notes.length > 4000) {
    throw new Error("Release notes must be 4000 characters or fewer.");
  }
  return notes;
};

export const buildApprovalNotes = ({ version, reviewInstanceUrl, reviewApiToken }) => {
  const lines = [
    "Source archive root: edgeever-source.",
    `Reproduce version ${version} with Bun 1.3.14 or later and Node.js 20 or later:`,
    "bun install --frozen-lockfile",
    "bun run test:extension",
    "bun run build:extension:firefox",
    "bun run lint:extension:firefox",
    "bun run package:extension:firefox",
    "See SOURCE_BUILD.md.",
    "The extension reads a page only after a clip action and sends it to the EdgeEver instance configured in the extension settings.",
    "Review steps are in apps/extension/FIREFOX_STORE_LISTING.md.",
  ];
  if (reviewInstanceUrl && reviewApiToken) {
    lines.push(`Review instance: ${reviewInstanceUrl}`, `Review API token: ${reviewApiToken}`);
  }
  return lines.join("\n");
};

export const shouldCopyExtensionSource = (relativePath) => {
  const parts = relativePath.split(/[\\/]/u).filter(Boolean);
  if (parts.some((part) => SOURCE_SKIP_DIRECTORIES.has(part) || part === ".DS_Store")) {
    return false;
  }
  return !(parts[0] === "store-assets" && relativePath.endsWith(".zip"));
};

export const workspacePackageManifests = (repoRoot) => {
  const manifests = [];
  for (const group of ["apps", "packages"]) {
    const groupDirectory = join(repoRoot, group);
    if (!existsSync(groupDirectory)) {
      continue;
    }
    for (const entry of readdirSync(groupDirectory, { withFileTypes: true })) {
      if (!entry.isDirectory() || (group === "apps" && entry.name === "extension")) {
        continue;
      }
      const manifest = join(group, entry.name, "package.json");
      if (existsSync(join(repoRoot, manifest))) {
        manifests.push(manifest);
      }
    }
  }
  return manifests.sort();
};

export const encodeJwtPart = (value) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

export const createAmoJwt = ({ issuer, secret, now = Date.now(), jti = randomUUID() }) => {
  const issuedAt = Math.floor(now / 1000);
  const header = encodeJwtPart({ alg: "HS256", typ: "JWT" });
  const payload = encodeJwtPart({
    iss: issuer,
    jti,
    iat: issuedAt,
    exp: issuedAt + 240,
  });
  const body = `${header}.${payload}`;
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
};

export const createGoogleServiceAccountAssertion = ({
  clientEmail,
  privateKey,
  now = Date.now(),
}) => {
  const issuedAt = Math.floor(now / 1000);
  const header = encodeJwtPart({ alg: "RS256", typ: "JWT" });
  const payload = encodeJwtPart({
    iss: clientEmail,
    scope: CHROME_SCOPE,
    aud: "https://oauth2.googleapis.com/token",
    iat: issuedAt,
    exp: issuedAt + 3600,
  });
  const body = `${header}.${payload}`;
  const signature = createSign("RSA-SHA256").update(body).sign(privateKey).toString("base64url");
  return `${body}.${signature}`;
};

const runCommand = (command, args, options = {}) => {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.error) {
    throw new Error(`${command} failed to start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with status ${result.status}.`);
  }
};

// Never log request bodies: Firefox approval notes contain private review credentials.
export const redactDiagnostics = (value, env = process.env) => {
  const sensitiveKey = /token|secret|password|authorization|private[_-]?key|approval[_-]?notes|assertion/i;
  const clean = (item) => {
    if (Array.isArray(item)) return item.map(clean);
    if (item && typeof item === "object") return Object.fromEntries(
      Object.entries(item).map(([key, entry]) => [key, sensitiveKey.test(key) ? "[REDACTED]" : clean(entry)]),
    );
    return item;
  };
  let text = typeof value === "string" ? value : JSON.stringify(clean(value), null, 2);
  const secrets = Object.entries(env)
    .filter(([key, entry]) => sensitiveKey.test(key) && typeof entry === "string" && entry)
    .map(([, entry]) => entry);
  try {
    const account = JSON.parse(env.CHROME_WEB_STORE_SERVICE_ACCOUNT_JSON || "{}");
    if (account.private_key) secrets.push(account.private_key);
  } catch { /* Invalid credentials are reported by the authentication stage. */ }
  for (const secret of secrets.sort((a, b) => b.length - a.length)) text = text.split(secret).join("[REDACTED]");
  return text
    .replace(/(?:Bearer|JWT)\s+[A-Za-z0-9._~+/=-]+/gi, "[REDACTED authorization]")
    .replace(/-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/g, "[REDACTED private key]");
};

const errorDetail = async (response) => {
  const body = await response.text();
  if (!body) return `HTTP ${response.status}`;
  let detail;
  try { detail = redactDiagnostics(JSON.parse(body)); }
  catch { detail = redactDiagnostics(body); }
  const limit = 20000;
  return `HTTP ${response.status}\n${detail.slice(0, limit)}${detail.length > limit ? "\n[API response truncated after 20000 characters]" : ""}`;
};

export const runSubmissionStage = async (stage, operation) => {
  try { return await operation(); }
  catch (error) {
    const failure = new Error(error instanceof Error ? error.message : String(error), { cause: error });
    failure.stage = stage;
    throw failure;
  }
};

const stagedClient = (store, client) => Object.fromEntries(
  Object.entries(client).map(([method, operation]) => [method,
    (...args) => runSubmissionStage(`${store}.${method}`, () => operation(...args)),
  ]),
);

export const formatSubmissionReport = (version, results, env = process.env) => {
  const lines = [`Web Clipper ${version}`, ""];
  for (const [store, result] of results) {
    let status = result.action === "failed"
      ? "Submission incomplete or failed; publication unconfirmed (earlier steps may have succeeded)"
      : "Not submitted; publication unconfirmed";
    if (result.action === "already-published" || (store === "Chrome" && result.state === "PUBLISHED")) {
      status = "Published (confirmed by store API)";
    } else if (["submitted", "already-submitted"].includes(result.action)) {
      status = result.state === "STAGED" || result.submittedState === "STAGED"
        ? "Approved and staged; not yet published"
        : "Submitted for review; publication unconfirmed";
    }
    lines.push(`${store}: ${result.action} — ${status}`);
    if (result.published || result.version) lines.push(`Store version: ${result.published || result.version}`);
    if (result.state || result.submittedState || result.status) lines.push(`API state: ${result.state || result.submittedState || result.status}`);
    if (result.stage) lines.push(`Failure stage: ${result.stage}`);
    if (result.reason) lines.push(`Reason / API response:\n${result.reason}`);
    if (result.warnings) lines.push(`API warnings:\n${redactDiagnostics(result.warnings, env)}`);
    if (result.recoveryError) lines.push(`Status recheck also failed:\n${result.recoveryError}`);
    if (["Chrome", "Firefox"].includes(store) && (result.action === "failed" || result.action === "blocked")) {
      lines.push(store === "Chrome"
        ? `Dashboard: https://chrome.google.com/webstore/devconsole/${CHROME_PUBLISHER_ID}/${CHROME_EXTENSION_ID}/edit`
        : `Dashboard: https://addons.mozilla.org/developers/addon/${FIREFOX_ADDON_SLUG}/versions`);
      lines.push("Only API-returned diagnostics are available here; dashboard-only requirements must be checked in the developer dashboard.");
    }
    lines.push("");
  }
  lines.push("Submission success is not review approval or publication. This run does not wait for later store review.",
    "Chrome and Edge share the Chrome Web Store item. waiting-review means no new package was submitted; retry that store after review completes.");
  // A code block keeps untrusted API text literal in the Actions Summary.
  const report = redactDiagnostics(lines.join("\n"), env);
  const fence = "`".repeat(Math.max(3, ...Array.from(report.matchAll(/`+/g), (match) => match[0].length + 1)));
  return `${fence}text\n${report}\n${fence}`;
};

const requestJson = async (fetchImpl, url, options) => {
  const response = await fetchImpl(url, options);
  if (!response.ok) {
    throw new Error(await errorDetail(response));
  }
  const text = await response.text();
  return text ? JSON.parse(text) : {};
};

const sleep = (delayMs) => new Promise((resolveDelay) => {
  setTimeout(resolveDelay, delayMs);
});

export const createChromeClient = ({
  fetchImpl = fetch,
  accessToken,
  publisherId = CHROME_PUBLISHER_ID,
  extensionId = CHROME_EXTENSION_ID,
}) => {
  const item = `publishers/${publisherId}/items/${extensionId}`;
  const headers = { Authorization: `Bearer ${accessToken}` };
  return {
    fetchStatus: () => requestJson(
      fetchImpl,
      `https://chromewebstore.googleapis.com/v2/${item}:fetchStatus`,
      { headers },
    ),
    upload: async (zipPath) => {
      const response = await fetchImpl(
        `https://chromewebstore.googleapis.com/upload/v2/${item}:upload`,
        {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/zip" },
          body: readFileSync(zipPath),
        },
      );
      if (!response.ok) {
        throw new Error(await errorDetail(response));
      }
      const text = await response.text();
      return text ? JSON.parse(text) : {};
    },
    publish: () => requestJson(
      fetchImpl,
      `https://chromewebstore.googleapis.com/v2/${item}:publish`,
      {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ publishType: "DEFAULT_PUBLISH" }),
      },
    ),
  };
};

const waitForChromeUpload = async (client) => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const status = await client.fetchStatus();
    const state = status.lastAsyncUploadState || "";
    if (state.includes("FAIL") || state === "NOT_FOUND") {
      throw new Error(`Chrome rejected the package upload (${state}).\n${redactDiagnostics(status)}`);
    }
    if (!state.includes("PROGRESS")) {
      return status;
    }
    await sleep(2000);
  }
  throw new Error("Timed out waiting for the Chrome Web Store upload.");
};

export const createFirefoxClient = ({
  fetchImpl = fetch,
  issuer,
  secret,
  addonSlug = FIREFOX_ADDON_SLUG,
}) => {
  const authorization = () => `JWT ${createAmoJwt({ issuer, secret })}`;
  const addonUrl = `https://addons.mozilla.org/api/v5/addons/addon/${addonSlug}`;
  return {
    listVersions: async () => {
      const versions = [];
      let url = `${addonUrl}/versions/?page_size=50`;
      for (let page = 0; page < 5 && url; page += 1) {
        const payload = await requestJson(fetchImpl, url, {
          headers: { Authorization: authorization() },
        });
        versions.push(...(payload.results ?? []));
        url = payload.next ?? "";
      }
      return versions;
    },
    uploadPackage: async (zipPath) => {
      const form = new FormData();
      form.append("upload", new Blob([readFileSync(zipPath)]), "edgeever-web-clipper.zip");
      form.append("channel", "listed");
      const response = await fetchImpl("https://addons.mozilla.org/api/v5/addons/upload/", {
        method: "POST",
        headers: { Authorization: authorization() },
        body: form,
      });
      if (!response.ok) {
        throw new Error(await errorDetail(response));
      }
      return response.json();
    },
    fetchUpload: (uuid) => requestJson(
      fetchImpl,
      `https://addons.mozilla.org/api/v5/addons/upload/${uuid}/`,
      { headers: { Authorization: authorization() } },
    ),
    createVersion: ({ uploadUuid, releaseNotes, approvalNotes }) => requestJson(
      fetchImpl,
      `${addonUrl}/versions/`,
      {
        method: "POST",
        headers: {
          Authorization: authorization(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          upload: uploadUuid,
          license: FIREFOX_LICENSE_SLUG,
          release_notes: { "en-US": releaseNotes },
          approval_notes: approvalNotes,
        }),
      },
    ),
    attachSource: async ({ version, sourcePath, releaseNotes, approvalNotes }) => {
      const form = new FormData();
      form.append("source", new Blob([readFileSync(sourcePath)]), "edgeever-web-clipper-source.zip");
      const sourceResponse = await fetchImpl(`${addonUrl}/versions/${version}/`, {
        method: "PATCH",
        headers: { Authorization: authorization() },
        body: form,
      });
      if (!sourceResponse.ok) {
        throw new Error(await errorDetail(sourceResponse));
      }
      return requestJson(fetchImpl, `${addonUrl}/versions/${version}/`, {
        method: "PATCH",
        headers: {
          Authorization: authorization(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          release_notes: { "en-US": releaseNotes },
          approval_notes: approvalNotes,
        }),
      });
    },
  };
};

const waitForAmoUpload = async (client, uuid) => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const upload = await client.fetchUpload(uuid);
    const ready = amoUploadReady(upload);
    if (ready.done && !ready.ok) {
      const errors = amoValidationErrors(upload);
      throw new Error(`Firefox rejected the package. ${errors.join(" ") || "Validation failed."}\n${redactDiagnostics(upload)}`);
    }
    if (ready.done) {
      return upload;
    }
    await sleep(5000);
  }
  throw new Error("Timed out waiting for Firefox Add-ons validation.");
};

export const copySourceArchive = (repoRoot, destinationRoot) => {
  mkdirSync(destinationRoot, { recursive: true });
  for (const file of ROOT_SOURCE_FILES) {
    cpSync(join(repoRoot, file), join(destinationRoot, file));
  }
  cpSync(join(repoRoot, "patches"), join(destinationRoot, "patches"), { recursive: true });
  cpSync(
    join(repoRoot, "apps/extension/SOURCE_BUILD.md"),
    join(destinationRoot, "SOURCE_BUILD.md"),
  );
  const extensionRoot = join(repoRoot, "apps/extension");
  cpSync(extensionRoot, join(destinationRoot, "apps/extension"), {
    recursive: true,
    filter: (source) => {
      const extensionRelative = relative(extensionRoot, source);
      return extensionRelative === "" || shouldCopyExtensionSource(extensionRelative);
    },
  });
  for (const manifest of workspacePackageManifests(repoRoot)) {
    const target = join(destinationRoot, manifest);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join(repoRoot, manifest), target);
  }
  for (const file of SHARED_EXTENSION_SOURCE_FILES) {
    const target = join(destinationRoot, file);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join(repoRoot, file), target);
  }
};

export const createSourceArchive = (repoRoot, sourceZip) => {
  const staging = mkdtempSync(join(tmpdir(), "edgeever-web-clipper-source-"));
  try {
    copySourceArchive(repoRoot, join(staging, "edgeever-source"));
    rmSync(sourceZip, { force: true });
    runCommand("zip", ["-q", "-r", "-X", sourceZip, "edgeever-source", "-x", "*.DS_Store"], { cwd: staging });
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
};

const buildFileHashes = (directory, prefix = "") => {
  const files = new Map();
  for (const entry of readdirSync(join(directory, prefix), { withFileTypes: true })) {
    const path = join(prefix, entry.name);
    if (entry.isDirectory()) {
      for (const [file, hash] of buildFileHashes(directory, path)) files.set(file, hash);
    } else {
      files.set(path, createHash("sha256").update(readFileSync(join(directory, path))).digest("hex"));
    }
  }
  return files;
};

export const assertIdenticalBuildDirectories = (referenceDirectory, rebuiltDirectory) => {
  const expected = buildFileHashes(referenceDirectory);
  const rebuilt = buildFileHashes(rebuiltDirectory);
  const different = [...new Set([...expected.keys(), ...rebuilt.keys()])]
    .filter((file) => expected.get(file) !== rebuilt.get(file)).sort();
  if (different.length) throw new Error(`Source archive rebuild differs: ${different.join(", ")}`);
  if (!expected.size) throw new Error("Cannot verify an empty extension build");
  return expected.size;
};

export const sourceRebuildEnvironment = (environment = process.env) => ({
  ...Object.fromEntries(Object.entries(environment).filter(([key]) =>
    !/^(CHROME_WEB_STORE_|AMO_|EDGE_EVER_REVIEW_)/.test(key) && !["GITHUB_TOKEN", "GH_TOKEN"].includes(key))),
  NODE_PATH: "",
  NODE_OPTIONS: "",
});

export const verifySourceArchive = ({ sourceZip, referenceDirectory }) => {
  const staging = mkdtempSync(join(tmpdir(), "edgeever-web-clipper-rebuild-"));
  try {
    runCommand("unzip", ["-q", sourceZip, "-d", staging]);
    const sourceRoot = join(staging, "edgeever-source");
    if (!existsSync(join(sourceRoot, "package.json"))) throw new Error("Source archive is missing its root package.json");
    if (existsSync(join(sourceRoot, "node_modules")) || existsSync(join(sourceRoot, "apps/extension/dist-firefox"))) {
      throw new Error("Source rebuild must start without dependencies or built assets");
    }
    const options = { cwd: sourceRoot, env: sourceRebuildEnvironment() };
    runCommand("bun", ["install", "--frozen-lockfile"], options);
    runCommand("bun", ["run", "build:extension:firefox"], options);
    const count = assertIdenticalBuildDirectories(referenceDirectory, join(sourceRoot, "apps/extension/dist-firefox"));
    console.log(`Firefox source archive independently rebuilt: ${count} files match SHA-256.`);
    return count;
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
};

const zipDirectoryContents = (directory, archivePath) => {
  rmSync(archivePath, { force: true });
  runCommand("zip", ["-r", "-X", archivePath, ".", "-x", "*.DS_Store", "-x", "*__MACOSX*"], {
    cwd: directory,
  });
};

const readExtensionVersion = () => {
  const version = JSON.parse(readFileSync(join(REPO_ROOT, "apps/extension/package.json"), "utf8")).version;
  compareVersions(version, version);
  return version;
};

const assertBuiltManifests = (version) => {
  const chromium = JSON.parse(readFileSync(join(REPO_ROOT, "apps/extension/dist/manifest.json"), "utf8"));
  const firefox = JSON.parse(readFileSync(join(REPO_ROOT, "apps/extension/dist-firefox/manifest.json"), "utf8"));
  if (chromium.version !== version || firefox.version !== version) {
    throw new Error(`Built manifests are ${chromium.version} and ${firefox.version}; expected ${version}.`);
  }
  if (chromium.browser_specific_settings) {
    throw new Error("The Chromium package must not include Firefox manifest settings.");
  }
  if (firefox.browser_specific_settings?.gecko?.id !== FIREFOX_ADDON_ID) {
    throw new Error(`The Firefox package id must be ${FIREFOX_ADDON_ID}.`);
  }
};

const findFirefoxPackage = (version) => {
  const directory = join(REPO_ROOT, "apps/extension/web-ext-artifacts");
  const names = readdirSync(directory).filter((name) =>
    name.endsWith(`-${version}.zip`) && !name.includes("source"));
  if (names.length !== 1) {
    throw new Error(`Expected one Firefox package for ${version}, found ${names.join(", ") || "none"}.`);
  }
  return join(directory, names[0]);
};

const buildPackages = (version) => {
  runCommand("zip", ["-v"], { stdio: "ignore" });
  runCommand("bun", ["run", "test:extension"], { cwd: REPO_ROOT });
  runCommand("bun", ["run", "build:extension"], { cwd: REPO_ROOT });
  runCommand("bun", ["run", "package:extension:firefox"], { cwd: REPO_ROOT });
  assertBuiltManifests(version);

  const chromiumZip = join(
    REPO_ROOT,
    "apps/extension/store-assets",
    `edgeever-web-clipper-v${version}.zip`,
  );
  mkdirSync(dirname(chromiumZip), { recursive: true });
  zipDirectoryContents(join(REPO_ROOT, "apps/extension/dist"), chromiumZip);

  const firefoxZip = findFirefoxPackage(version);
  const sourceZip = join(
    REPO_ROOT,
    "apps/extension/web-ext-artifacts",
    `edgeever_web_clipper-${version}-source.zip`,
  );
  createSourceArchive(REPO_ROOT, sourceZip);
  // This runs before either store is contacted, including in --dry-run mode.
  verifySourceArchive({ sourceZip, referenceDirectory: join(REPO_ROOT, "apps/extension/dist-firefox") });
  return { version, chromiumZip, firefoxZip, sourceZip };
};

const writeGithubOutput = (packages) => {
  if (!process.env.GITHUB_OUTPUT) {
    return;
  }
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `version=${packages.version}\nchromium_zip=${packages.chromiumZip}\nfirefox_zip=${packages.firefoxZip}\nsource_zip=${packages.sourceZip}\n`,
  );
};

const writeStepSummary = (markdown) => {
  console.log(markdown);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
  }
};

const chromeAccessToken = async (env, fetchImpl) => {
  if (env.CHROME_WEB_STORE_SERVICE_ACCOUNT_JSON) {
    const account = JSON.parse(env.CHROME_WEB_STORE_SERVICE_ACCOUNT_JSON);
    if (!account.client_email || !account.private_key) {
      throw new Error("CHROME_WEB_STORE_SERVICE_ACCOUNT_JSON must include client_email and private_key.");
    }
    const assertion = createGoogleServiceAccountAssertion({
      clientEmail: account.client_email,
      privateKey: account.private_key,
    });
    const payload = await requestJson(fetchImpl, "https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });
    return payload.access_token;
  }

  const payload = await requestJson(fetchImpl, "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.CHROME_WEB_STORE_CLIENT_ID,
      client_secret: env.CHROME_WEB_STORE_CLIENT_SECRET,
      refresh_token: env.CHROME_WEB_STORE_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  return payload.access_token;
};

export const submitChrome = async ({ version, chromiumZip, env, fetchImpl }) => {
  const client = stagedClient("chrome", createChromeClient({
    fetchImpl,
    accessToken: await runSubmissionStage("chrome.authenticate", () => chromeAccessToken(env, fetchImpl)),
  }));
  const initial = chromeSubmissionPlan({
    packageVersion: version,
    status: await client.fetchStatus(),
  });
  if (initial.action !== "upload") {
    return initial.action === "blocked" ? { ...initial, stage: "chrome.submissionPlan" } : initial;
  }

  const uploaded = await client.upload(chromiumZip);
  const immediate = chromeUploadFinished(uploaded);
  if (immediate.done && !immediate.ok) {
    await runSubmissionStage("chrome.validateUpload", () => { throw new Error(`Chrome rejected the package upload (${immediate.state}).\n${redactDiagnostics(uploaded)}`); });
  }
  if (!immediate.done) {
    await runSubmissionStage("chrome.validateUpload", () => waitForChromeUpload(client));
  }
  try {
    const published = await client.publish();
    return {
      action: "submitted",
      state: published.state ?? "UNKNOWN",
      warnings: published.warningInfo,
    };
  } catch (error) {
    try {
      const after = chromeSubmissionPlan({ packageVersion: version, status: await client.fetchStatus() });
      if (after.action === "already-submitted" || after.action === "already-published") return after;
    } catch (recoveryError) {
      error.recoveryError = recoveryError.message;
    }
    throw error;
  }
};

export const submitFirefox = async ({ version, firefoxZip, sourceZip, releaseNotes, env, fetchImpl }) => {
  const client = stagedClient("firefox", createFirefoxClient({
    fetchImpl,
    issuer: env.AMO_JWT_ISSUER,
    secret: env.AMO_JWT_SECRET,
  }));
  const approvalNotes = buildApprovalNotes({
    version,
    reviewInstanceUrl: env.EDGE_EVER_REVIEW_INSTANCE_URL,
    reviewApiToken: env.EDGE_EVER_REVIEW_API_TOKEN,
  });
  const plan = firefoxSubmissionPlan({
    packageVersion: version,
    versions: await client.listVersions(),
  });
  if (plan.action !== "upload" && plan.action !== "attach-source") {
    return plan.action === "blocked" ? { ...plan, stage: "firefox.submissionPlan" } : plan;
  }
  if (plan.action === "attach-source") {
    await client.attachSource({
      version,
      sourcePath: sourceZip,
      releaseNotes,
      approvalNotes,
    });
    return { action: "submitted", version, sourceAttached: true };
  }

  const upload = await client.uploadPackage(firefoxZip);
  if (!upload.uuid) {
    await runSubmissionStage("firefox.uploadPackage", () => { throw new Error("Firefox did not return an upload id."); });
  }
  await runSubmissionStage("firefox.validateUpload", () => waitForAmoUpload(client, upload.uuid));
  const created = await client.createVersion({
    uploadUuid: upload.uuid,
    releaseNotes,
    approvalNotes,
  });
  const createdVersion = created.version?.version ?? version;
  await client.attachSource({
    version: createdVersion,
    sourcePath: sourceZip,
    releaseNotes,
    approvalNotes,
  });
  return { action: "submitted", version: createdVersion, sourceAttached: true };
};

const selectedPlatforms = (platform) =>
  platform === "both" ? ["chrome", "firefox"] : [platform];

const main = async () => {
  const options = parsePublishArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage);
    return;
  }
  if (!options.dryRun) {
    assertOfficialRepository(process.env.GITHUB_REPOSITORY);
  }

  const version = readExtensionVersion();
  const releaseNotes = resolveReleaseNotes({
    notes: options.notes,
    notesFile: options.notesFile,
    version,
  });
  const packages = await runSubmissionStage("build-packages-and-verify-source", () => buildPackages(version));
  writeGithubOutput(packages);

  if (options.dryRun) {
    const present = credentialPresence(process.env);
    writeStepSummary([
      `Web Clipper ${version} packages are ready.`,
      `Chromium: ${packages.chromiumZip}`,
      `Firefox: ${packages.firefoxZip}`,
      `Source: ${packages.sourceZip}`,
      "Dry run: stores were not called.",
      `Chrome credentials: ${present.chromeServiceAccount || present.chromeRefreshToken ? "present" : "missing"}`,
      `Firefox credentials: ${present.amo ? "present" : "missing"}`,
    ].join("\n"));
    return;
  }

  if (!process.env.EDGE_EVER_REVIEW_INSTANCE_URL || !process.env.EDGE_EVER_REVIEW_API_TOKEN) {
    console.warn("Review instance credentials are unset. Firefox approval notes omit the review login.");
  }

  const results = [];
  const failures = [];
  for (const platform of selectedPlatforms(options.platform)) {
    const store = platform === "chrome" ? "Chrome" : "Firefox";
    try {
      await runSubmissionStage(`${platform}.credentials`, () => assertCredentials(platform, process.env));
      const result = platform === "chrome"
        ? await submitChrome({ ...packages, env: process.env, fetchImpl: fetch })
        : await submitFirefox({
          ...packages,
          releaseNotes,
          env: process.env,
          fetchImpl: fetch,
        });
      results.push([store, result]);
      if (result.action === "blocked") {
        failures.push(result.reason);
      }
      if (result.action === "waiting-review") {
        console.warn(`${store}: ${result.reason} Retry Submit Web Clipper with the same release_tag after review completes.`);
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      results.push([store, { action: "failed", stage: error.stage ?? "unknown", reason, recoveryError: error.recoveryError }]);
      failures.push(reason);
    }
  }

  writeStepSummary(formatSubmissionReport(version, results));
  if (failures.length > 0) {
    const error = new Error("One or more store submissions failed; see the report above.");
    error.reported = true;
    throw error;
  }
};

if (import.meta.main) {
  main().catch((error) => {
    if (!error.reported) {
      writeStepSummary(formatSubmissionReport("(preparation)", [["Preparation", {
        action: "failed", stage: error.stage ?? "preparation", reason: error.message ?? String(error),
      }]]));
    }
    console.error(redactDiagnostics(error instanceof Error ? error.message : String(error)));
    process.exitCode = 1;
  });
}
