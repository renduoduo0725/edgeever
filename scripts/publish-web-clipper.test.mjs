import { createHmac, createVerify, generateKeyPairSync } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import {
  amoUploadReady,
  amoValidationErrors,
  assertCredentials,
  assertOfficialRepository,
  buildApprovalNotes,
  chromeSubmissionPlan,
  chromeUploadFinished,
  compareVersions,
  createAmoJwt,
  createChromeClient,
  createFirefoxClient,
  createGoogleServiceAccountAssertion,
  credentialPresence,
  firefoxSubmissionPlan,
  FIREFOX_LICENSE_SLUG,
  highestCrxVersion,
  OFFICIAL_REPOSITORY,
  parsePublishArgs,
  resolveReleaseNotes,
  shouldCopyExtensionSource,
  workspacePackageManifests,
} from "./publish-web-clipper.mjs";

const workflow = readFileSync(
  new URL("../.github/workflows/extension-store.yml", import.meta.url),
  "utf8",
);

describe("web clipper store command", () => {
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

  test("blocks a Chrome package that is not newer than the public version", () => {
    const plan = chromeSubmissionPlan({
      packageVersion: "0.1.8",
      status: {
        publishedItemRevisionStatus: {
          state: "PUBLISHED",
          distributionChannels: [{ crxVersion: "0.1.8", deployPercentage: 100 }],
        },
      },
    });

    expect(plan.action).toBe("blocked");
    expect(plan.reason).toContain("0.1.8");
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

  test("blocks a different Chrome version that is already pending", () => {
    expect(chromeSubmissionPlan({
      packageVersion: "0.2.0",
      status: {
        submittedItemRevisionStatus: {
          state: "STAGED",
          distributionChannels: [{ crxVersion: "0.1.9" }],
        },
      },
    }).action).toBe("blocked");
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
    }).action).toBe("blocked");
  });

  test("blocks a second Firefox upload while another version awaits review", () => {
    expect(firefoxSubmissionPlan({
      packageVersion: "0.1.10",
      versions: [{ version: "0.1.9", file: { status: "unreviewed" }, source: "https://example.test/source" }],
    }).reason).toContain("0.1.9");
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

  test("asks Chrome to publish after review and Firefox for both apps", async () => {
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

    const publish = calls.find((call) => String(call.url).endsWith(":publish"));
    expect(JSON.parse(publish.body).publishType).toBe("DEFAULT_PUBLISH");
    const created = calls.find((call) => String(call.url).endsWith("/versions/"));
    expect(JSON.parse(created.body)).toMatchObject({
      upload: "upload-1",
      compatibility: ["firefox", "android"],
      license: FIREFOX_LICENSE_SLUG,
      release_notes: { "en-US": "Notes" },
    });
    const upload = calls.find((call) => String(call.url).endsWith("/upload/"));
    expect(upload.method).toBe("POST");
    expect(upload.body).toBeInstanceOf(FormData);
    expect(upload.body.get("channel")).toBe("listed");
  });

  test("keeps store submission on the official repository workflow", () => {
    expect(workflow).toContain("github.repository == 'tianma-if/edgeever'");
    expect(workflow).toContain("workflow_dispatch:");
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
