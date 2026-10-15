import { Database } from "bun:sqlite";
import { afterEach, describe, expect, test } from "bun:test";
import { globSync, readFileSync } from "node:fs";
import { Hono } from "hono";
import { AppError } from "./app-error.ts";
import { apiError } from "./http-errors.ts";
import { resolvePrimaryObjectStorageEncryptionKey } from "./object-storage.ts";
import { registerObjectStorageRoutes } from "./object-storage-routes.ts";
import { decryptSecret, encryptSecret } from "./secret-encryption.ts";
import { createSelfHostedStorageAdapter } from "./self-hosted-storage-adapter.ts";

const auth = {
  kind: "user",
  actorType: "user",
  actorId: "usr_owner",
  username: "owner",
  displayName: "Owner",
  scopes: [],
  workspaceId: "ws_owner",
  role: "owner",
};

const environment = {
  storage: {
    db: {
      prepare: () => { throw new Error("Unexpected database access"); },
      batch: async () => [],
    },
    resources: {},
  },
};

const createApp = ({ currentAuth = auth, demoMode = false } = {}) => {
  const app = new Hono();
  app.use("/api/v1/*", async (context, next) => {
    context.set("auth", currentAuth);
    await next();
  });
  registerObjectStorageRoutes(app, { isDemoMode: () => demoMode });
  return app;
};

describe("object storage route contracts", () => {
  test("rejects non-owner settings access before storage reads", async () => {
    const app = createApp({ currentAuth: { ...auth, role: "member" } });
    const response = await app.request(
      "/api/v1/instance/object-storage",
      {},
      environment,
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "forbidden" } });
  });

  test("keeps demo storage immutable", async () => {
    const app = createApp({ demoMode: true });
    const response = await app.request(
      "/api/v1/instance/object-storage",
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: "builtin" }),
      },
      environment,
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "forbidden" } });
  });
});

const FAKE_AUTH_PASSWORD = "fake-instance-auth-password";
const FAKE_SECRET = "FAKE-secret-access-key-do-not-use";
const authEnvironment = { EDGE_EVER_AUTH_PASSWORD: FAKE_AUTH_PASSWORD };
const primaryKey = resolvePrimaryObjectStorageEncryptionKey(authEnvironment);

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

// In-memory S3 double: records every signed request and answers the connection probe.
const stubS3 = ({ failWith } = {}) => {
  const objects = new Map();
  const requests = [];
  globalThis.fetch = async (request) => {
    requests.push({
      method: request.method,
      url: request.url,
      authorization: request.headers.get("authorization"),
    });
    if (failWith) return new Response(failWith.body, { status: failWith.status });
    if (request.method === "PUT") {
      objects.set(request.url, new Uint8Array(await request.arrayBuffer()));
      return new Response(null, { status: 200 });
    }
    if (request.method === "GET") {
      const value = objects.get(request.url);
      return value ? new Response(value, { status: 200 }) : new Response(null, { status: 404 });
    }
    if (request.method === "DELETE") {
      objects.delete(request.url);
      return new Response(null, { status: 204 });
    }
    return new Response(null, { status: 405 });
  };
  return { objects, requests };
};

const installation = ({ currentAuth = auth, env = authEnvironment } = {}) => {
  const sqlite = new Database(":memory:");
  for (const path of globSync("migrations/*.sql").sort()) sqlite.exec(readFileSync(path, "utf8"));
  const app = new Hono();
  app.onError((error, context) => error instanceof AppError
    ? apiError(context, error.code, error.message, error.status)
    : context.json({ error: { code: "internal_error", message: error.message } }, 500));
  app.use("/api/v1/*", async (context, next) => {
    context.set("auth", currentAuth);
    await next();
  });
  registerObjectStorageRoutes(app, { isDemoMode: () => false });
  const environment = {
    ...env,
    storage: createSelfHostedStorageAdapter(sqlite, "/tmp/edgeever-object-storage-route-test-unused"),
  };
  const request = (path, { method = "GET", body } = {}) => app.request(
    path,
    body === undefined
      ? { method }
      : { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
    environment,
  );
  const configs = () => sqlite.query(
    "SELECT id, provider, endpoint, region, bucket, access_key_id, secret_access_key_encrypted, force_path_style, object_prefix, is_active FROM object_storage_configs ORDER BY id",
  ).all();
  const audits = () => sqlite.query(
    "SELECT actor_id, action, entity_id, metadata_json FROM audit_events WHERE action = 'instance.object_storage.update' ORDER BY rowid",
  ).all();
  return { sqlite, app, request, configs, audits };
};

const s3Settings = (overrides = {}) => ({
  provider: "s3",
  displayName: "Fake S3",
  endpoint: "https://objects.example.test",
  region: "us-east-1",
  bucket: "edgeever-fake",
  accessKeyId: "FAKE-access-key-id",
  secretAccessKey: FAKE_SECRET,
  forcePathStyle: true,
  objectPrefix: "notes",
  ...overrides,
});

const insertS3Config = async (sqlite, { encryptedSecret, isActive = false } = {}) => {
  if (isActive) sqlite.exec("UPDATE object_storage_configs SET is_active = 0");
  sqlite.query(
    `INSERT INTO object_storage_configs (
       id, provider, display_name, endpoint, region, bucket, access_key_id,
       secret_access_key_encrypted, force_path_style, object_prefix, is_active
     ) VALUES ('instance-s3', 's3', 'Fake S3', 'https://objects.example.test', 'us-east-1',
       'edgeever-fake', 'FAKE-access-key-id', ?, 1, 'notes', ?)`,
  ).run(encryptedSecret ?? await encryptSecret(FAKE_SECRET, primaryKey), isActive ? 1 : 0);
};

describe("object storage settings on a migrated database", () => {
  test("returns the built-in storage settings without an external configuration", async () => {
    const { request, sqlite } = installation();
    const response = await request("/api/v1/instance/object-storage");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      settings: {
        provider: "builtin",
        displayName: "Built-in object storage",
        endpoint: null,
        region: null,
        bucket: null,
        accessKeyId: null,
        hasSecretAccessKey: false,
        forcePathStyle: true,
        objectPrefix: "",
        encryptionConfigured: true,
      },
      externalSettings: null,
    });
    sqlite.close();
  });

  test("reports encryption as unconfigured when only the legacy storage key is present", async () => {
    const { request, sqlite } = installation({ env: { EDGE_EVER_STORAGE_ENCRYPTION_KEY: "fake-legacy-key" } });
    const body = await (await request("/api/v1/instance/object-storage")).json();

    expect(body.settings.encryptionConfigured).toBe(false);
    sqlite.close();
  });

  test("returns 404 when no storage configuration is active", async () => {
    const { request, sqlite } = installation();
    sqlite.exec("UPDATE object_storage_configs SET is_active = 0");
    const response = await request("/api/v1/instance/object-storage");

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: "not_found" } });
    sqlite.close();
  });

  for (const [label, currentAuth] of [
    ["workspace members", { ...auth, actorId: "usr_member", role: "member" }],
    ["API tokens", { ...auth, kind: "agent", actorType: "agent", actorId: "tok_owner", scopes: ["write:resources"], role: "owner" }],
  ]) {
    test(`rejects ${label} on every storage route without touching storage`, async () => {
      const { request, configs, audits, sqlite } = installation({ currentAuth });
      const s3 = stubS3();
      const before = configs();

      for (const [method, path, body] of [
        ["GET", "/api/v1/instance/object-storage"],
        ["PUT", "/api/v1/instance/object-storage", s3Settings()],
        ["PUT", "/api/v1/instance/object-storage", { provider: "builtin" }],
        ["POST", "/api/v1/instance/object-storage/test", s3Settings()],
      ]) {
        const response = await request(path, { method, body });
        expect(response.status).toBe(403);
        expect(await response.json()).toMatchObject({ error: { code: "forbidden" } });
      }
      expect(s3.requests).toHaveLength(0);
      expect(configs()).toEqual(before);
      expect(audits()).toHaveLength(0);
      sqlite.close();
    });
  }

  test("saves verified S3 settings with an encrypted secret that is never returned", async () => {
    const { request, configs, audits, sqlite } = installation();
    const s3 = stubS3();
    const response = await request("/api/v1/instance/object-storage", {
      method: "PUT",
      body: s3Settings({
        endpoint: "https://objects.example.test/",
        forcePathStyle: false,
        objectPrefix: "/team/notes/",
      }),
    });

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).not.toContain(FAKE_SECRET);
    expect(JSON.parse(text)).toEqual({
      settings: {
        provider: "s3",
        displayName: "Fake S3",
        endpoint: "https://objects.example.test",
        region: "us-east-1",
        bucket: "edgeever-fake",
        accessKeyId: "FAKE-access-key-id",
        hasSecretAccessKey: true,
        forcePathStyle: false,
        objectPrefix: "team/notes",
        encryptionConfigured: true,
      },
    });

    // The connection probe ran against the virtual-hosted bucket before anything was saved.
    expect(s3.requests.map((entry) => entry.method)).toEqual(["PUT", "GET", "DELETE"]);
    const probeUrl = new URL(s3.requests[0].url);
    expect(probeUrl.hostname).toBe("edgeever-fake.objects.example.test");
    expect(probeUrl.pathname).toStartWith("/team/notes/.edgeever-connection-test/");
    expect(s3.requests[0].authorization).toContain("Credential=FAKE-access-key-id/");
    expect(s3.objects.size).toBe(0);

    const rows = configs();
    expect(rows.map((row) => [row.id, row.is_active])).toEqual([["builtin", 0], ["instance-s3", 1]]);
    const saved = rows[1];
    expect(saved).toMatchObject({
      endpoint: "https://objects.example.test",
      force_path_style: 0,
      object_prefix: "team/notes",
    });
    expect(saved.secret_access_key_encrypted).toStartWith("v1.");
    expect(saved.secret_access_key_encrypted).not.toContain(FAKE_SECRET);
    expect(sqlite.query("SELECT COUNT(*) AS count FROM object_storage_configs WHERE secret_access_key_encrypted LIKE ?")
      .get(`%${FAKE_SECRET}%`).count).toBe(0);
    expect(await decryptSecret(saved.secret_access_key_encrypted, primaryKey)).toBe(FAKE_SECRET);

    const [audit] = audits();
    expect(audit).toMatchObject({ actor_id: "usr_owner", entity_id: "instance-s3" });
    expect(JSON.parse(audit.metadata_json)).toEqual({
      provider: "s3",
      endpoint: "https://objects.example.test",
      bucket: "edgeever-fake",
    });

    const read = await request("/api/v1/instance/object-storage");
    const readText = await read.text();
    expect(readText).not.toContain(FAKE_SECRET);
    expect(readText).not.toContain(saved.secret_access_key_encrypted);
    const readBody = JSON.parse(readText);
    expect(readBody.settings).toEqual(readBody.externalSettings);
    expect(readBody.settings).toMatchObject({ provider: "s3", hasSecretAccessKey: true });
    expect(readBody.settings).not.toHaveProperty("secretAccessKey");
    sqlite.close();
  });

  test("keeps the saved secret when an update omits it", async () => {
    const { request, configs, sqlite } = installation();
    await insertS3Config(sqlite, { isActive: true });
    const s3 = stubS3();

    const response = await request("/api/v1/instance/object-storage", {
      method: "PUT",
      body: s3Settings({ secretAccessKey: undefined, bucket: "edgeever-renamed" }),
    });

    expect(response.status).toBe(200);
    expect((await response.json()).settings).toMatchObject({ bucket: "edgeever-renamed", hasSecretAccessKey: true });
    expect(s3.requests).toHaveLength(3);
    const saved = configs().find((row) => row.id === "instance-s3");
    expect(saved.bucket).toBe("edgeever-renamed");
    expect(await decryptSecret(saved.secret_access_key_encrypted, primaryKey)).toBe(FAKE_SECRET);
    sqlite.close();
  });

  test("requires a secret for the first S3 configuration", async () => {
    const { request, configs, sqlite } = installation();
    const s3 = stubS3();
    const before = configs();

    const response = await request("/api/v1/instance/object-storage", {
      method: "PUT",
      body: s3Settings({ secretAccessKey: undefined }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "object_storage_secret_required" } });
    expect(s3.requests).toHaveLength(0);
    expect(configs()).toEqual(before);
    sqlite.close();
  });

  test("refuses to store external credentials without an instance authentication secret", async () => {
    const { request, configs, sqlite } = installation({
      env: { EDGE_EVER_STORAGE_ENCRYPTION_KEY: "fake-legacy-key" },
    });
    const s3 = stubS3();
    const before = configs();

    const response = await request("/api/v1/instance/object-storage", { method: "PUT", body: s3Settings() });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "object_storage_authentication_required" } });
    expect(s3.requests).toHaveLength(0);
    expect(configs()).toEqual(before);
    sqlite.close();
  });

  test("keeps the current storage active when the connection probe fails", async () => {
    const { request, configs, audits, sqlite } = installation();
    const s3 = stubS3({ failWith: { status: 403, body: "<Error><Code>AccessDenied</Code></Error>" } });
    const before = configs();

    const response = await request("/api/v1/instance/object-storage", { method: "PUT", body: s3Settings() });

    expect(response.status).toBe(400);
    const text = await response.text();
    expect(text).not.toContain(FAKE_SECRET);
    expect(JSON.parse(text)).toMatchObject({
      error: { code: "object_storage_connection_failed", message: expect.stringContaining("Object upload failed (403)") },
    });
    expect(s3.requests).toHaveLength(1);
    expect(configs()).toEqual(before);
    expect(audits()).toHaveLength(0);
    sqlite.close();
  });

  for (const [label, overrides] of [
    ["a non-HTTP endpoint", { endpoint: "ftp://objects.example.test" }],
    ["a malformed endpoint", { endpoint: "not a url" }],
    ["an oversized endpoint", { endpoint: `https://objects.example.test/${"a".repeat(500)}` }],
    ["an empty bucket", { bucket: "   " }],
    ["an oversized bucket", { bucket: "b".repeat(256) }],
    ["an empty region", { region: "" }],
    ["an empty access key ID", { accessKeyId: "" }],
    ["an empty secret", { secretAccessKey: "" }],
    ["an oversized object prefix", { objectPrefix: "p".repeat(501) }],
    ["a non-boolean path-style flag", { forcePathStyle: "yes" }],
    ["a missing display name", { displayName: undefined }],
    ["an unknown provider", { provider: "gcs" }],
  ]) {
    test(`rejects S3 settings with ${label}`, async () => {
      const { request, configs, sqlite } = installation();
      const s3 = stubS3();
      const before = configs();

      const response = await request("/api/v1/instance/object-storage", {
        method: "PUT",
        body: s3Settings(overrides),
      });

      expect(response.status).toBe(400);
      expect(await response.text()).not.toContain(FAKE_SECRET);
      expect(s3.requests).toHaveLength(0);
      expect(configs()).toEqual(before);
      sqlite.close();
    });
  }

  test("switches back to built-in storage and keeps the external configuration for existing files", async () => {
    const { request, configs, audits, sqlite } = installation();
    await insertS3Config(sqlite, { isActive: true });
    const before = configs().find((row) => row.id === "instance-s3");
    const s3 = stubS3();

    const response = await request("/api/v1/instance/object-storage", {
      method: "PUT",
      body: { provider: "builtin" },
    });

    expect(response.status).toBe(200);
    expect((await response.json()).settings).toMatchObject({ provider: "builtin", hasSecretAccessKey: false });
    expect(s3.requests).toHaveLength(0);
    const rows = configs();
    expect(rows.map((row) => [row.id, row.is_active])).toEqual([["builtin", 1], ["instance-s3", 0]]);
    expect(rows[1]).toEqual({ ...before, is_active: 0 });
    expect(audits().map((audit) => [audit.entity_id, JSON.parse(audit.metadata_json)]))
      .toEqual([["builtin", { provider: "builtin" }]]);

    const read = await (await request("/api/v1/instance/object-storage")).json();
    expect(read.settings.provider).toBe("builtin");
    expect(read.externalSettings).toMatchObject({ provider: "s3", bucket: "edgeever-fake", hasSecretAccessKey: true });
    sqlite.close();
  });

  test("migrates a legacy-key secret to the primary key when it is reused", async () => {
    const legacyKey = "fake-legacy-storage-key";
    const { request, configs, sqlite } = installation({
      env: { ...authEnvironment, EDGE_EVER_STORAGE_ENCRYPTION_KEY: legacyKey },
    });
    const legacyCiphertext = await encryptSecret(FAKE_SECRET, legacyKey);
    await insertS3Config(sqlite, { encryptedSecret: legacyCiphertext });
    stubS3();

    const response = await request("/api/v1/instance/object-storage/test", {
      method: "POST",
      body: s3Settings({ secretAccessKey: undefined }),
    });

    expect(response.status).toBe(200);
    const stored = configs().find((row) => row.id === "instance-s3").secret_access_key_encrypted;
    expect(stored).not.toBe(legacyCiphertext);
    expect(await decryptSecret(stored, primaryKey)).toBe(FAKE_SECRET);
    sqlite.close();
  });

  test("returns 503 instead of leaking or crashing when the saved secret cannot be decrypted", async () => {
    const { request, configs, sqlite } = installation();
    const foreignCiphertext = await encryptSecret(FAKE_SECRET, "fake-key-from-another-instance");
    await insertS3Config(sqlite, { encryptedSecret: foreignCiphertext, isActive: true });
    const s3 = stubS3();
    const before = configs();

    for (const [method, path] of [
      ["POST", "/api/v1/instance/object-storage/test"],
      ["PUT", "/api/v1/instance/object-storage"],
    ]) {
      const response = await request(path, { method, body: s3Settings({ secretAccessKey: undefined }) });
      expect(response.status).toBe(503);
      const text = await response.text();
      expect(text).not.toContain(FAKE_SECRET);
      expect(text).not.toContain(foreignCiphertext);
      expect(JSON.parse(text)).toMatchObject({ error: { code: "object_storage_unavailable" } });
    }
    expect(s3.requests).toHaveLength(0);
    expect(configs()).toEqual(before);
    sqlite.close();
  });
});

describe("object storage connection test route", () => {
  test("verifies a submitted configuration without saving it", async () => {
    const { request, configs, audits, sqlite } = installation();
    const s3 = stubS3();
    const before = configs();

    const response = await request("/api/v1/instance/object-storage/test", {
      method: "POST",
      body: s3Settings({ endpoint: "https://objects.example.test//", provider: undefined, displayName: undefined }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(s3.requests.map((entry) => entry.method)).toEqual(["PUT", "GET", "DELETE"]);
    expect(new URL(s3.requests[0].url).pathname).toStartWith("/edgeever-fake/notes/.edgeever-connection-test/");
    expect(configs()).toEqual(before);
    expect(audits()).toHaveLength(0);
    sqlite.close();
  });

  test("reports provider failures as a connection error", async () => {
    const { request, sqlite } = installation();
    // 4xx on purpose: aws4fetch retries 5xx responses with backoff.
    stubS3({ failWith: { status: 404, body: "<Error>\n  NoSuchBucket\n</Error>" } });

    const response = await request("/api/v1/instance/object-storage/test", { method: "POST", body: s3Settings() });

    expect(response.status).toBe(400);
    const text = await response.text();
    expect(text).not.toContain(FAKE_SECRET);
    expect(JSON.parse(text)).toEqual({
      error: { code: "object_storage_connection_failed", message: "Object upload failed (404): <Error> NoSuchBucket </Error>" },
    });
    sqlite.close();
  });

  test("reports a probe whose read-back content does not match", async () => {
    const { request, sqlite } = installation();
    const methods = [];
    globalThis.fetch = async (probe) => {
      methods.push(probe.method);
      return probe.method === "GET" ? new Response("different", { status: 200 }) : new Response(null, { status: 200 });
    };

    const response = await request("/api/v1/instance/object-storage/test", { method: "POST", body: s3Settings() });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "object_storage_connection_failed", message: "The test object content did not match after upload." },
    });
    expect(methods).toEqual(["PUT", "GET", "DELETE"]);
    sqlite.close();
  });

  test("requires a secret when none has been saved", async () => {
    const { request, sqlite } = installation();
    const s3 = stubS3();

    const response = await request("/api/v1/instance/object-storage/test", {
      method: "POST",
      body: s3Settings({ secretAccessKey: undefined }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "object_storage_secret_required" } });
    expect(s3.requests).toHaveLength(0);
    sqlite.close();
  });

  test("rejects an invalid endpoint before contacting storage", async () => {
    const { request, sqlite } = installation();
    const s3 = stubS3();

    const response = await request("/api/v1/instance/object-storage/test", {
      method: "POST",
      body: s3Settings({ endpoint: "javascript:alert(1)" }),
    });

    expect(response.status).toBe(400);
    expect(s3.requests).toHaveLength(0);
    sqlite.close();
  });
});
