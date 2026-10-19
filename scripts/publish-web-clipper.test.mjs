import { spawnSync } from "node:child_process";
import { createHmac, createVerify, generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import {
  amoUploadReady,
  amoValidationErrors,
  assertCredentials,
  assertOfficialRepository,
  assertIdenticalBuildDirectories,
  buildApprovalNotes,
  chromeSubmissionPlan,
  chromeUploadFinished,
  compareVersions,
  copySourceArchive,
  createAmoJwt,
  createChromeClient,
  createFirefoxClient,
  createGoogleServiceAccountAssertion,
  credentialPresence,
  firefoxSubmissionPlan,
  formatSubmissionReport,
  redactDiagnostics,
  runSubmissionStage,
  FIREFOX_LICENSE_SLUG,
  highestCrxVersion,
  OFFICIAL_REPOSITORY,
  parsePublishArgs,
  resolveReleaseNotes,
  shouldCopyExtensionSource,
  SHARED_EXTENSION_SOURCE_FILES,
  sourceRebuildEnvironment,
  submitChrome,
  submitFirefox,
  workspacePackageManifests,
} from "./publish-web-clipper.mjs";

const workflow = readFileSync(
  new URL("../.github/workflows/extension-store.yml", import.meta.url),
  "utf8",
);

describe("web clipper store command", () => {
  test("reports HTTP field errors, nested details and status without leaking credentials", async () => {
    const client = createChromeClient({ accessToken: "private-access", fetchImpl: async () => ({
      ok: false, status: 400, text: async () => JSON.stringify({ error: {
        code: 400, status: "INVALID_ARGUMENT", message: "Requirements missing",
        details: [{ fieldViolations: [{ field: "privacy", description: "Justify declarativeNetRequestWithHostAccess" }] }],
        access_token: "private-access",
      } }),
    }) });
    let failure;
    try { await runSubmissionStage("chrome.publish", () => client.publish()); } catch (error) { failure = error; }
    const report = formatSubmissionReport("0.2.0", [["Chrome", { action: "failed", stage: failure.stage, reason: failure.message }]]);
    expect(report).toContain("HTTP 400");
    expect(report).toContain("INVALID_ARGUMENT");
    expect(report).toContain("Justify declarativeNetRequestWithHostAccess");
    expect(report).toContain("Failure stage: chrome.publish");
    expect(report).not.toContain("private-access");
    expect(report).toContain("publication unconfirmed");
  });

  test("distinguishes pending, staged, published and blocked results in the shared report", () => {
    for (const [result, expected] of [
      [{ action: "submitted", state: "PENDING_REVIEW" }, "Submitted for review; publication unconfirmed"],
      [{ action: "already-submitted", submittedState: "STAGED" }, "Approved and staged; not yet published"],
      [{ action: "submitted", state: "PUBLISHED" }, "Published (confirmed by store API)"],
      [{ action: "already-published", published: "0.2.1" }, "Store version: 0.2.1"],
      [{ action: "waiting-review", reason: "Another version is pending" }, "Not submitted; publication unconfirmed"],
    ]) expect(formatSubmissionReport("0.2.0", [["Chrome", result]])).toContain(expected);
    expect(formatSubmissionReport("0.2.0", [["Firefox", { action: "submitted", sourceAttached: true }]]))
      .toContain("Submitted for review; publication unconfirmed");
  });

  test("redacts private approval notes and environment secrets and renders API markup literally", () => {
    expect(redactDiagnostics({ approval_notes: "private login", errors: ["bad field"] })).not.toContain("private login");
    const report = formatSubmissionReport("0.2.0", [["Firefox", { action: "failed", reason: "secret-value ``` <script>" }]], { AMO_JWT_SECRET: "secret-value" });
    expect(report).not.toContain("secret-value");
    expect(report).toStartWith("````text\n");
  });

  test("preserves Chrome publish failure when the subsequent status check fails", async () => {
    const directory = mkdtempSync(join(tmpdir(), "edgeever-submit-diagnostics-"));
    const zip = join(directory, "addon.zip");
    writeFileSync(zip, "zip");
    let statusCalls = 0;
    const fetchImpl = async (url) => {
      if (String(url).endsWith("/token")) return jsonResponse({ access_token: "token" });
      if (String(url).endsWith(":fetchStatus")) {
        if (++statusCalls > 1) throw new Error("Status unavailable");
        return jsonResponse({});
      }
      if (String(url).endsWith(":upload")) return jsonResponse({ uploadState: "SUCCEEDED" });
      return { ok: false, status: 400, text: async () => JSON.stringify({ error: { message: "Privacy requirement missing" } }) };
    };
    try {
      let failure;
      try { await submitChrome({ version: "0.2.0", chromiumZip: zip, env: {}, fetchImpl }); } catch (error) { failure = error; }
      expect(failure.stage).toBe("chrome.publish");
      expect(failure.message).toContain("Privacy requirement missing");
      expect(failure.recoveryError).toBe("Status unavailable");
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

  test("preserves Firefox field errors and non-JSON service errors", async () => {
    const client = createFirefoxClient({ issuer: "test", secret: "test", fetchImpl: async () => ({
      ok: false, status: 400, text: async () => JSON.stringify({ upload: ["Invalid package"], license: ["Required"] }),
    }) });
    await expect(client.createVersion({})).rejects.toThrow("Invalid package");
    const chrome = createChromeClient({ accessToken: "test", fetchImpl: async () => ({
      ok: false, status: 503, text: async () => "Service unavailable",
    }) });
    await expect(chrome.publish()).rejects.toThrow("HTTP 503\nService unavailable");
  });

  test("writes preparation failure details to Actions Summary and exits nonzero", () => {
    const directory = mkdtempSync(join(tmpdir(), "edgeever-report-test-"));
    const summary = join(directory, "summary.md");
    try {
      const result = spawnSync(process.execPath, [new URL("./publish-web-clipper.mjs", import.meta.url).pathname, "--invalid-option"], {
        env: { ...process.env, GITHUB_STEP_SUMMARY: summary }, encoding: "utf8", stdio: "pipe",
      });
      expect(result.status).toBe(1);
      const markdown = readFileSync(summary, "utf8");
      expect(markdown).toContain("Failure stage: preparation");
      expect(markdown).toContain("Unknown option: --invalid-option");
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

  test("defaults to both stores", () => {
    expect(parsePublishArgs([])).toMatchObject({
      platform: "both",
      dryRun: false,
    });
  });

  test("rejects an unknown store", () => {
    expect(() => parsePublishArgs(["--platform", "edge"])).toThrow("--platform");
  });

  test("compares numeric versions", () => {
    expect(compareVersions("0.1.9", "0.1.8")).toBeGreaterThan(0);
    expect(compareVersions("0.1.8", "0.1.8")).toBe(0);
    expect(compareVersions("0.2.0", "0.1.9")).toBeGreaterThan(0);
    expect(() => compareVersions("1", "0.1.8")).toThrow("X.Y.Z");
  });

  test("skips a Chrome package that is already public", () => {
    const plan = chromeSubmissionPlan({
      packageVersion: "0.1.8",
      status: {
        publishedItemRevisionStatus: {
          state: "PUBLISHED",
          distributionChannels: [{ crxVersion: "0.1.8", deployPercentage: 100 }],
        },
      },
    });

    expect(plan.action).toBe("already-published");
    expect(plan.published).toBe("0.1.8");
  });

  test("uploads a newer Chrome package when nothing is pending", () => {
    expect(chromeSubmissionPlan({
      packageVersion: "0.1.9",
      status: {
        publishedItemRevisionStatus: {
          distributionChannels: [{ crxVersion: "0.1.8" }],
        },
      },
    }).action).toBe("upload");
  });

  test("treats the same Chrome version awaiting review as already submitted", () => {
    expect(chromeSubmissionPlan({
      packageVersion: "0.1.9",
      status: {
        publishedItemRevisionStatus: {
          distributionChannels: [{ crxVersion: "0.1.8" }],
        },
        submittedItemRevisionStatus: {
          state: "PENDING_REVIEW",
          distributionChannels: [{ crxVersion: "0.1.9" }],
        },
      },
    }).action).toBe("already-submitted");
  });

  test("defers a different Chrome version that is already pending", () => {
    expect(chromeSubmissionPlan({
      packageVersion: "0.2.0",
      status: {
        submittedItemRevisionStatus: {
          state: "STAGED",
          distributionChannels: [{ crxVersion: "0.1.9" }],
        },
      },
    }).action).toBe("waiting-review");
  });

  test("uses the highest Chrome channel version", () => {
    expect(highestCrxVersion({
      distributionChannels: [
        { crxVersion: "0.1.8" },
        { crxVersion: "0.1.10" },
      ],
    })).toBe("0.1.10");
  });

  test("asks Firefox to attach source when the pending version has none", () => {
    expect(firefoxSubmissionPlan({
      packageVersion: "0.1.9",
      versions: [{ version: "0.1.9", file: { status: "unreviewed" }, source: null }],
    }).action).toBe("attach-source");
  });

  test("does not reuse a public Firefox version", () => {
    expect(firefoxSubmissionPlan({
      packageVersion: "0.1.8",
      versions: [{ version: "0.1.8", file: { status: "public" }, source: "https://example.test/source" }],
    }).action).toBe("already-published");
  });

  test("defers a second Firefox upload while another version awaits review", () => {
    expect(firefoxSubmissionPlan({
      packageVersion: "0.1.10",
      versions: [{ version: "0.1.9", file: { status: "unreviewed" }, source: "https://example.test/source" }],
    }).reason).toContain("0.1.9");
  });

  test("skips older release packages after a newer version is public", () => {
    expect(chromeSubmissionPlan({
      packageVersion: "0.1.8",
      status: { publishedItemRevisionStatus: { distributionChannels: [{ crxVersion: "0.1.9" }] } },
    }).action).toBe("already-published");
    expect(firefoxSubmissionPlan({
      packageVersion: "0.1.8",
      versions: [{ version: "0.1.9", file: { status: "public" } }],
    }).action).toBe("already-published");
  });

  test("does not hide rejected Firefox versions as successful skips", () => {
    expect(firefoxSubmissionPlan({
      packageVersion: "0.1.9",
      versions: [{ version: "0.1.9", file: { status: "disabled" } }],
    }).action).toBe("blocked");
  });

  test("Firefox skips public and pending packages without any write request", async () => {
    for (const [status, version, action] of [
      ["public", "0.1.9", "already-published"],
      ["unreviewed", "0.1.9", "already-submitted"],
      ["unreviewed", "0.1.8", "waiting-review"],
    ]) {
      const calls = [];
      const result = await submitFirefox({
        version: "0.1.9",
        env: { AMO_JWT_ISSUER: "test", AMO_JWT_SECRET: "test" },
        fetchImpl: async (url, options) => {
          calls.push({ url, method: options.method ?? "GET" });
          return jsonResponse({ results: [{ version, file: { status }, source: "source.zip" }] });
        },
      });
      expect(result.action).toBe(action);
      expect(calls).toHaveLength(1);
      expect(calls[0].method).toBe("GET");
    }
  });

  test("Chrome skips public and pending packages without upload or publish", async () => {
    for (const [revision, version, action] of [
      ["publishedItemRevisionStatus", "0.1.9", "already-published"],
      ["submittedItemRevisionStatus", "0.1.9", "already-submitted"],
      ["submittedItemRevisionStatus", "0.1.8", "waiting-review"],
    ]) {
      const calls = [];
      const result = await submitChrome({
        version: "0.1.9",
        env: {},
        fetchImpl: async (url) => {
          calls.push(String(url));
          return jsonResponse(String(url).endsWith("/token")
            ? { access_token: "test" }
            : { [revision]: { state: "PENDING_REVIEW", distributionChannels: [{ crxVersion: version }] } });
        },
      });
      expect(result.action).toBe(action);
      expect(calls).toHaveLength(2);
      expect(calls[1]).toEndWith(":fetchStatus");
    }
  });

  test("reads a finished Chrome upload without treating every status item as finished", () => {
    expect(chromeUploadFinished({ itemId: "abc" })).toMatchObject({ done: true, ok: true });
    expect(chromeUploadFinished({ uploadState: "IN_PROGRESS" }).done).toBe(false);
    expect(chromeUploadFinished({ uploadState: "FAILED" })).toMatchObject({ done: true, ok: false });
  });

  test("waits until Firefox validation finishes and keeps warnings", () => {
    expect(amoUploadReady({ processed: false })).toMatchObject({ done: false });
    expect(amoUploadReady({ processed: true, valid: true })).toMatchObject({ done: true, ok: true });
    expect(amoValidationErrors({
      validation: {
        messages: [
          { type: "error", message: "Missing id" },
          { type: "warning", message: "innerHTML" },
        ],
      },
    })).toEqual(["Missing id"]);
  });

  test("names the missing credentials without including secret values", () => {
    expect(() => assertCredentials("both", {
      CHROME_WEB_STORE_CLIENT_SECRET: "super-secret",
    })).toThrow("CHROME_WEB_STORE_SERVICE_ACCOUNT_JSON");
    expect(credentialPresence({
      AMO_JWT_ISSUER: "user:1:1",
      AMO_JWT_SECRET: "secret",
    }).amo).toBe(true);
  });

  test("refuses to submit from a fork", () => {
    expect(() => assertOfficialRepository("someone/edgeever")).toThrow(OFFICIAL_REPOSITORY);
    expect(() => assertOfficialRepository("")).not.toThrow();
  });

  test("uses a one-line Firefox note when none was provided", () => {
    expect(resolveReleaseNotes({ version: "0.1.9" })).toBe("EdgeEver Web Clipper 0.1.9.");
  });

  test("includes the review login only in the private approval note", () => {
    const notes = buildApprovalNotes({
      version: "0.1.9",
      reviewInstanceUrl: "https://review.example.test",
      reviewApiToken: "review-token",
    });

    expect(notes).toContain("https://review.example.test");
    expect(notes).toContain("review-token");
    expect(notes).toContain("bun run package:extension:firefox");
    expect(buildApprovalNotes({ version: "0.1.9" })).not.toContain("Review API token");
  });

  test("keeps built store packages and dependency installs out of the source archive", () => {
    expect(shouldCopyExtensionSource("src/background.ts")).toBe(true);
    expect(shouldCopyExtensionSource("dist/manifest.json")).toBe(false);
    expect(shouldCopyExtensionSource("node_modules/web-ext/package.json")).toBe(false);
    expect(shouldCopyExtensionSource("store-assets/edgeever-web-clipper-v0.1.8.zip")).toBe(false);
    expect(shouldCopyExtensionSource("store-assets/store-icon-128.png")).toBe(true);

    const manifests = workspacePackageManifests(new URL("..", import.meta.url).pathname);
    expect(manifests).toContain("apps/web/package.json");
    expect(manifests).toContain("packages/shared/package.json");
    expect(manifests).not.toContain("apps/extension/package.json");
  });

  test("review source contains shared UI imports without copying the whole Web app", () => {
    const staging = mkdtempSync(join(tmpdir(), "edgeever-source-test-"));
    try {
      copySourceArchive(new URL("..", import.meta.url).pathname, staging);
      for (const file of SHARED_EXTENSION_SOURCE_FILES) {
        expect(readFileSync(join(staging, file), "utf8")).toBe(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"));
      }
      expect(existsSync(join(staging, "apps/web/src/components/EditorPane.tsx"))).toBe(false);
      expect(existsSync(join(staging, ".env.local"))).toBe(false);
      expect(existsSync(join(staging, "apps/extension/dist"))).toBe(false);
      expect(existsSync(join(staging, "apps/extension/node_modules"))).toBe(false);
    } finally { rmSync(staging, { recursive: true, force: true }); }
  });

  test("source rebuild audit rejects missing, extra and changed artifacts", () => {
    const staging = mkdtempSync(join(tmpdir(), "edgeever-rebuild-test-"));
    const expected = join(staging, "expected"), rebuilt = join(staging, "rebuilt");
    mkdirSync(expected); mkdirSync(rebuilt);
    try {
      writeFileSync(join(expected, "manifest.json"), "manifest");
      expect(() => assertIdenticalBuildDirectories(expected, rebuilt)).toThrow("manifest.json");
      writeFileSync(join(rebuilt, "manifest.json"), "changed");
      expect(() => assertIdenticalBuildDirectories(expected, rebuilt)).toThrow("manifest.json");
      writeFileSync(join(rebuilt, "manifest.json"), "manifest");
      expect(assertIdenticalBuildDirectories(expected, rebuilt)).toBe(1);
      writeFileSync(join(rebuilt, "extra.js"), "extra");
      expect(() => assertIdenticalBuildDirectories(expected, rebuilt)).toThrow("extra.js");
    } finally { rmSync(staging, { recursive: true, force: true }); }
  });

  test("extension CI covers shared UI and verifies the review archive on the official repository", () => {
    const build = readFileSync(new URL("../.github/workflows/extension-build.yml", import.meta.url), "utf8");
    expect(build.match(/"apps\/web\/src\/components\/ui\/\*\*"/g)).toHaveLength(2);
    expect(build.match(/"apps\/web\/src\/lib\/utils.ts"/g)).toHaveLength(2);
    expect(build).toContain("if: github.repository == 'tianma-if/edgeever'");
    expect(build).toContain("run: bun scripts/verify-extension-source.mjs");
    expect(build).toContain("bun-version-file: package.json");
  });

  test("independent builds do not inherit store credentials or external module paths", () => {
    const environment = sourceRebuildEnvironment({ PATH: "/usr/bin", HOME: "/tmp/example", CHROME_WEB_STORE_CLIENT_SECRET: "secret", AMO_JWT_SECRET: "secret", EDGE_EVER_REVIEW_API_TOKEN: "secret", GITHUB_TOKEN: "secret", GH_TOKEN: "secret", NODE_PATH: "/original/node_modules", NODE_OPTIONS: "--require external.js" });
    expect(environment).toEqual({ PATH: "/usr/bin", HOME: "/tmp/example", NODE_PATH: "", NODE_OPTIONS: "" });
  });

  test("signs Firefox and Chrome credentials", () => {
    const amo = createAmoJwt({
      issuer: "user:1:1",
      secret: "amo-secret",
      now: 1_700_000_000_000,
      jti: "fixed-jti",
    });
    const [header, payload, signature] = amo.split(".");
    const expected = createHmac("sha256", "amo-secret")
      .update(`${header}.${payload}`)
      .digest("base64url");
    expect(signature).toBe(expected);
    expect(JSON.parse(Buffer.from(payload, "base64url").toString())).toMatchObject({
      iss: "user:1:1",
      jti: "fixed-jti",
      exp: 1_700_000_240,
    });

    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const assertion = createGoogleServiceAccountAssertion({
      clientEmail: "clipper@example.iam.gserviceaccount.com",
      privateKey: privateKey.export({ type: "pkcs8", format: "pem" }),
      now: 1_700_000_000_000,
    });
    const [googleHeader, googlePayload, googleSignature] = assertion.split(".");
    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${googleHeader}.${googlePayload}`);
    expect(verifier.verify(publicKey, googleSignature, "base64url")).toBe(true);
    expect(JSON.parse(Buffer.from(googlePayload, "base64url").toString()).scope).toContain(
      "chromewebstore",
    );
  });

  test("publishes Chrome and leaves Firefox compatibility to the manifest", async () => {
    const calls = [];
    const fetchImpl = async (url, options = {}) => {
      calls.push({ url, body: options.body, method: options.method });
      if (String(url).endsWith(":publish")) {
        return jsonResponse({ state: "PENDING_REVIEW" });
      }
      if (String(url).endsWith("/versions/")) {
        return jsonResponse({ version: "0.1.9" });
      }
      return jsonResponse({});
    };
    const chrome = createChromeClient({ fetchImpl, accessToken: "token" });
    await chrome.publish();

    const directory = mkdtempSync(join(tmpdir(), "edgeever-clipper-api-"));
    const packagePath = join(directory, "addon.zip");
    writeFileSync(packagePath, "zip");
    const firefox = createFirefoxClient({
      fetchImpl,
      issuer: "user:1:1",
      secret: "amo-secret",
    });
    await firefox.uploadPackage(packagePath);
    await firefox.createVersion({
      uploadUuid: "upload-1",
      releaseNotes: "Notes",
      approvalNotes: "Build it",
    });
    await firefox.attachSource({
      version: "0.1.9",
      sourcePath: packagePath,
      releaseNotes: "Notes",
      approvalNotes: "Build it",
    });

    const publish = calls.find((call) => String(call.url).endsWith(":publish"));
    expect(JSON.parse(publish.body).publishType).toBe("DEFAULT_PUBLISH");
    const created = calls.find((call) => String(call.url).endsWith("/versions/"));
    expect(JSON.parse(created.body)).toMatchObject({
      upload: "upload-1",
      license: FIREFOX_LICENSE_SLUG,
      release_notes: { "en-US": "Notes" },
    });
    expect(JSON.parse(created.body)).not.toHaveProperty("compatibility");
    const edited = calls.find((call) => String(call.url).endsWith("/versions/0.1.9/") && typeof call.body === "string");
    expect(JSON.parse(edited.body)).not.toHaveProperty("compatibility");
    const upload = calls.find((call) => String(call.url).endsWith("/upload/"));
    expect(upload.method).toBe("POST");
    expect(upload.body).toBeInstanceOf(FormData);
    expect(upload.body.get("channel")).toBe("listed");
  });

  test("keeps store submission on the official repository workflow", () => {
    expect(workflow).toContain("github.repository == 'tianma-if/edgeever'");
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("- published");
    expect(workflow).toContain("!github.event.release.prerelease");
    expect(workflow).toContain("!github.event.release.draft");
    expect(workflow).toContain("ref: ${{ github.event.release.tag_name || inputs.release_tag || github.sha }}");
    expect(workflow).toContain("inputs.platform || 'both'");
    expect(workflow).toContain("CHROME_WEB_STORE_SERVICE_ACCOUNT_JSON");
    expect(workflow).toContain("AMO_JWT_ISSUER");
    expect(workflow).toContain("AMO_JWT_SECRET");
    expect(workflow).toContain("edgeever-web-clipper-store");
    expect(workflow).not.toContain("bun run release");
    expect(workflow).not.toContain("publish:stores");
    expect(workflow).not.toContain("echo ${{ secrets");
  });
});

const jsonResponse = (payload) => ({
  ok: true,
  json: async () => payload,
  text: async () => JSON.stringify(payload),
});
