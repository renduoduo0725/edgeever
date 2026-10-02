import { spawnSync } from "node:child_process";
import { createHmac, createSign, randomUUID } from "node:crypto";
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

  if (submitted && compareVersions(packageVersion, submitted) === 0 && pending) {
    return { action: "already-submitted", published, submitted, submittedState };
  }
  if (submitted && pending) {
    return {
      action: "blocked",
      reason: `Chrome ${submitted} is ${submittedState}. Wait for that review, or cancel it, before submitting ${packageVersion}.`,
    };
  }
  if (published && compareVersions(packageVersion, published) <= 0) {
    return {
      action: "blocked",
      reason: `Chrome already published ${published}. Increase apps/extension/package.json before submitting again.`,
    };
  }
  return { action: "upload", published, submitted, submittedState };
};

export const firefoxSubmissionPlan = ({ packageVersion, versions }) => {
  const listed = versions.filter((version) => version?.version);
  const same = listed.find((version) => version.version === packageVersion);
  if (same) {
    const status = same.file?.status ?? "";
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

  const awaiting = listed.find((version) => version.file?.status === "unreviewed");
  if (awaiting) {
    return {
      action: "blocked",
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

const errorDetail = async (response) => {
  const text = await response.text();
  if (!text) {
    return `HTTP ${response.status}`;
  }
  try {
    const payload = JSON.parse(text);
    const message = payload.error?.message || payload.detail || payload.message;
    if (message) {
      return `HTTP ${response.status}: ${message}`;
    }
    return `HTTP ${response.status}: ${JSON.stringify(payload).slice(0, 2000)}`;
  } catch {
    return `HTTP ${response.status}: ${text.slice(0, 2000)}`;
  }
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
      throw new Error(`Chrome rejected the package upload (${state}).`);
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
          compatibility: ["firefox", "android"],
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
          compatibility: ["firefox", "android"],
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
      throw new Error(`Firefox rejected the package. ${errors.join(" ") || "Validation failed."}`);
    }
    if (ready.done) {
      return upload;
    }
    await sleep(5000);
  }
  throw new Error("Timed out waiting for Firefox Add-ons validation.");
};

const copySourceArchive = (repoRoot, destinationRoot) => {
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
  const staging = mkdtempSync(join(tmpdir(), "edgeever-web-clipper-"));
  try {
    copySourceArchive(REPO_ROOT, join(staging, "edgeever-source"));
    rmSync(sourceZip, { force: true });
    runCommand("zip", ["-r", "-X", sourceZip, "edgeever-source", "-x", "*.DS_Store"], {
      cwd: staging,
    });
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
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

const submitChrome = async ({ version, chromiumZip, env, fetchImpl }) => {
  const client = createChromeClient({
    fetchImpl,
    accessToken: await chromeAccessToken(env, fetchImpl),
  });
  const initial = chromeSubmissionPlan({
    packageVersion: version,
    status: await client.fetchStatus(),
  });
  if (initial.action !== "upload") {
    return initial;
  }

  const uploaded = await client.upload(chromiumZip);
  const immediate = chromeUploadFinished(uploaded);
  if (immediate.done && !immediate.ok) {
    throw new Error(`Chrome rejected the package upload (${immediate.state}).`);
  }
  if (!immediate.done) {
    await waitForChromeUpload(client);
  }
  try {
    const published = await client.publish();
    return {
      action: "submitted",
      state: published.state ?? "PENDING_REVIEW",
    };
  } catch (error) {
    const after = chromeSubmissionPlan({
      packageVersion: version,
      status: await client.fetchStatus(),
    });
    if (after.action === "already-submitted") {
      return after;
    }
    throw error;
  }
};

const submitFirefox = async ({ version, firefoxZip, sourceZip, releaseNotes, env, fetchImpl }) => {
  const client = createFirefoxClient({
    fetchImpl,
    issuer: env.AMO_JWT_ISSUER,
    secret: env.AMO_JWT_SECRET,
  });
  const approvalNotes = buildApprovalNotes({
    version,
    reviewInstanceUrl: env.EDGE_EVER_REVIEW_INSTANCE_URL,
    reviewApiToken: env.EDGE_EVER_REVIEW_API_TOKEN,
  });
  const plan = firefoxSubmissionPlan({
    packageVersion: version,
    versions: await client.listVersions(),
  });
  if (plan.action === "blocked" || plan.action === "already-submitted") {
    return plan;
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
    throw new Error("Firefox did not return an upload id.");
  }
  await waitForAmoUpload(client, upload.uuid);
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
    assertCredentials(options.platform, process.env);
  }

  const version = readExtensionVersion();
  const releaseNotes = resolveReleaseNotes({
    notes: options.notes,
    notesFile: options.notesFile,
    version,
  });
  const packages = buildPackages(version);
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
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      results.push([store, { action: "failed", reason }]);
      failures.push(reason);
    }
  }

  writeStepSummary([
    `Web Clipper ${version}`,
    ...results.map(([store, result]) => `${store}: ${result.action}${result.reason ? ` — ${result.reason}` : ""}`),
    "Chrome and Edge use the same Chrome Web Store submission. Review still has to approve it.",
    "Firefox review still has to approve and sign the package.",
  ].join("\n"));
  if (failures.length > 0) {
    throw new Error(failures.join(" "));
  }
};

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
