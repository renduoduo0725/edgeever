import { Database } from "bun:sqlite";
import { afterEach, describe, expect, test } from "bun:test";
import { globSync, readFileSync } from "node:fs";
import {
  deleteStoredObjects,
  getActiveObjectStorageConfig,
  getObjectStorageConfig,
  resolveObjectStorage,
  resolveObjectStorageEncryptionKeys,
  resolvePrimaryObjectStorageEncryptionKey,
  resolveStoredObjectStorageSecret,
} from "./object-storage.ts";
import { decryptSecret, encryptSecret } from "./secret-encryption.ts";
import { createSelfHostedStorageAdapter } from "./self-hosted-storage-adapter.ts";

const objectStorageRow = (encryptedSecret) => ({
  id: "instance-s3",
  provider: "s3",
  display_name: "S3",
  endpoint: "https://s3.example.com",
  region: "us-east-1",
  bucket: "edgeever",
  access_key_id: "access-key",
  secret_access_key_encrypted: encryptedSecret,
  force_path_style: 1,
  object_prefix: "edgeever",
  is_active: 1,
});

const migrationDatabase = () => {
  const updates = [];
  return {
    updates,
    prepare: () => ({
      bind: (...values) => ({
        run: async () => {
          updates.push(values);
          return { success: true };
        },
      }),
    }),
  };
};

describe("object storage credential encryption", () => {
  test("derives a purpose-specific key from instance authentication", () => {
    const environment = { EDGE_EVER_AUTH_PASSWORD: "instance-auth-secret" };

    expect(resolvePrimaryObjectStorageEncryptionKey(environment))
      .toBe("edgeever:object-storage:v1:instance-auth-secret");
    expect(resolveObjectStorageEncryptionKeys(environment)).not.toContain("instance-auth-secret");
  });

  test("never uses the legacy object-storage key for new credentials", () => {
    const environment = { EDGE_EVER_STORAGE_ENCRYPTION_KEY: "legacy-storage-key" };

    expect(resolvePrimaryObjectStorageEncryptionKey(environment)).toBeUndefined();
    expect(resolveObjectStorageEncryptionKeys(environment)).toEqual(["legacy-storage-key"]);
  });

  test("decrypts rotated object-storage secrets with the persisted auth fallback", () => {
    const environment = {
      EDGE_EVER_AUTH_PASSWORD: "rotated-password",
      EDGE_EVER_AUTH_PASSWORD_FALLBACK: "original-password",
    };

    expect(resolvePrimaryObjectStorageEncryptionKey(environment))
      .toBe("edgeever:object-storage:v1:rotated-password");
    expect(resolveObjectStorageEncryptionKeys(environment)).toContain(
      "edgeever:object-storage:v1:original-password",
    );
  });

  test("migrates a legacy object-storage credential after decrypting it", async () => {
    const plaintext = "legacy-secret-access-key";
    const legacyKey = "legacy-storage-key";
    const environment = {
      EDGE_EVER_AUTH_PASSWORD: "instance-auth-secret",
      EDGE_EVER_STORAGE_ENCRYPTION_KEY: legacyKey,
    };
    const row = objectStorageRow(await encryptSecret(plaintext, legacyKey));
    const database = migrationDatabase();

    expect(await resolveStoredObjectStorageSecret(database, row, environment)).toBe(plaintext);
    expect(database.updates).toHaveLength(1);
    const [migratedSecret, configId] = database.updates[0];
    expect(configId).toBe("instance-s3");
    expect(await decryptSecret(
      migratedSecret,
      resolvePrimaryObjectStorageEncryptionKey(environment),
    )).toBe(plaintext);
  });

  test("does not rewrite a credential already encrypted with the auth-derived key", async () => {
    const environment = { EDGE_EVER_AUTH_PASSWORD_HASH: "stable-auth-hash" };
    const encrypted = await encryptSecret(
      "current-secret-access-key",
      resolvePrimaryObjectStorageEncryptionKey(environment),
    );
    const database = migrationDatabase();

    expect(await resolveStoredObjectStorageSecret(
      database,
      objectStorageRow(encrypted),
      environment,
    )).toBe("current-secret-access-key");
    expect(database.updates).toHaveLength(0);
  });
});

const FAKE_SECRET = "FAKE-secret-access-key-do-not-use";
const authEnvironment = { EDGE_EVER_AUTH_PASSWORD: "fake-instance-auth-password" };
const primaryKey = resolvePrimaryObjectStorageEncryptionKey(authEnvironment);

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

const recordS3Requests = () => {
  const requests = [];
  globalThis.fetch = async (request) => {
    requests.push({ method: request.method, url: request.url });
    return new Response(null, { status: request.method === "DELETE" ? 204 : 200 });
  };
  return requests;
};

const builtinStore = () => {
  const deleted = [];
  return {
    deleted,
    get: async () => null,
    put: async () => undefined,
    createMultipartUpload: async () => { throw new Error("unused"); },
    resumeMultipartUpload: () => { throw new Error("unused"); },
    delete: async (keys) => { deleted.push(keys); },
  };
};

const installation = ({ env = authEnvironment } = {}) => {
  const sqlite = new Database(":memory:");
  for (const path of globSync("migrations/*.sql").sort()) sqlite.exec(readFileSync(path, "utf8"));
  const resources = builtinStore();
  const environment = {
    ...env,
    storage: {
      db: createSelfHostedStorageAdapter(sqlite, "/tmp/edgeever-object-storage-test-unused").db,
      resources,
    },
  };
  return { sqlite, resources, environment };
};

const insertS3Config = async (sqlite, {
  id = "instance-s3",
  encryptedSecret,
  isActive = false,
  bucket = "edgeever-fake",
  endpoint = "https://objects.example.test",
} = {}) => {
  if (isActive) sqlite.exec("UPDATE object_storage_configs SET is_active = 0");
  sqlite.query(
    `INSERT INTO object_storage_configs (
       id, provider, display_name, endpoint, region, bucket, access_key_id,
       secret_access_key_encrypted, force_path_style, object_prefix, is_active
     ) VALUES (?, 's3', 'Fake S3', ?, 'us-east-1', ?, 'FAKE-access-key-id', ?, 1, 'notes', ?)`,
  ).run(
    id,
    endpoint,
    bucket,
    encryptedSecret === undefined ? await encryptSecret(FAKE_SECRET, primaryKey) : encryptedSecret,
    isActive ? 1 : 0,
  );
};

const storedSecret = (sqlite, id = "instance-s3") => sqlite
  .query("SELECT secret_access_key_encrypted FROM object_storage_configs WHERE id = ?")
  .get(id).secret_access_key_encrypted;

describe("object storage resolution on a migrated database", () => {
  test("seeds built-in storage as the single active configuration", async () => {
    const { sqlite, environment } = installation();

    expect(await getActiveObjectStorageConfig(environment.storage.db)).toMatchObject({
      id: "builtin",
      provider: "builtin",
      secret_access_key_encrypted: null,
      is_active: 1,
    });
    expect(await getObjectStorageConfig(environment.storage.db, "instance-s3")).toBeNull();
    // The partial unique index prevents two active configurations at once.
    await insertS3Config(sqlite);
    expect(() => sqlite.exec("UPDATE object_storage_configs SET is_active = 1 WHERE id = 'instance-s3'"))
      .toThrow(/UNIQUE/);
    sqlite.close();
  });

  test("resolves the built-in store and bucket name", async () => {
    const { sqlite, resources, environment } = installation();

    expect(await resolveObjectStorage(environment)).toEqual({
      configId: "builtin",
      bucketName: "edgeever-resources",
      store: resources,
    });
    expect(await resolveObjectStorage({ ...environment, EDGE_EVER_R2_BUCKET_NAME: "  custom-bucket  " }, "builtin"))
      .toMatchObject({ configId: "builtin", bucketName: "custom-bucket" });
    sqlite.close();
  });

  test("routes new files to the active storage and existing files to the storage they were saved with", async () => {
    const { sqlite, resources, environment } = installation();
    await insertS3Config(sqlite, { isActive: true });
    const requests = recordS3Requests();

    const active = await resolveObjectStorage(environment);
    expect(active.configId).toBe("instance-s3");
    expect(active.bucketName).toBe("edgeever-fake");
    expect(active.store).not.toBe(resources);
    await active.store.put("new-file.txt", new TextEncoder().encode("new"));
    expect(requests).toEqual([{ method: "PUT", url: "https://objects.example.test/edgeever-fake/notes/new-file.txt" }]);

    const legacy = await resolveObjectStorage(environment, "builtin");
    expect(legacy).toMatchObject({ configId: "builtin", store: resources });

    // Switching back to built-in storage must not orphan files stored in S3.
    sqlite.exec("UPDATE object_storage_configs SET is_active = 0");
    sqlite.exec("UPDATE object_storage_configs SET is_active = 1 WHERE id = 'builtin'");
    expect((await resolveObjectStorage(environment)).store).toBe(resources);
    const external = await resolveObjectStorage(environment, "instance-s3");
    expect(external.configId).toBe("instance-s3");
    await external.store.delete("old-file.txt");
    expect(requests.at(-1)).toEqual({
      method: "DELETE",
      url: "https://objects.example.test/edgeever-fake/notes/old-file.txt",
    });
    sqlite.close();
  });

  test("defaults the resource storage column to built-in storage for existing files", () => {
    const { sqlite } = installation();
    const column = sqlite.query("PRAGMA table_info(resources)").all()
      .find((entry) => entry.name === "storage_config_id");

    expect(column).toMatchObject({ notnull: 1, dflt_value: "'builtin'" });
    sqlite.close();
  });

  test("fails with 503 when a resource points to a configuration that no longer exists", async () => {
    const { sqlite, environment } = installation();

    await expect(resolveObjectStorage(environment, "deleted-config")).rejects.toMatchObject({
      code: "object_storage_unavailable",
      status: 503,
    });
    sqlite.close();
  });

  test("fails with 503 for an incomplete external configuration", async () => {
    const { sqlite, environment } = installation();
    await insertS3Config(sqlite, { bucket: null });

    await expect(resolveObjectStorage(environment, "instance-s3")).rejects.toMatchObject({
      code: "object_storage_unavailable",
      status: 503,
      message: expect.stringContaining("incomplete"),
    });
    sqlite.close();
  });

  test("fails with 503 when the external credential is missing", async () => {
    const { sqlite, environment } = installation();
    await insertS3Config(sqlite, { encryptedSecret: null });

    await expect(resolveObjectStorage(environment, "instance-s3")).rejects.toMatchObject({
      code: "object_storage_unavailable",
      status: 503,
      message: expect.stringContaining("missing"),
    });
    sqlite.close();
  });

  for (const [label, encryptedSecret] of [
    ["encrypted with an unknown key", null],
    ["malformed", "v1.not-base64!.garbage"],
    ["in an unsupported format", "v2.aaaa.bbbb"],
  ]) {
    test(`fails with 503 without leaking when the credential is ${label}`, async () => {
      const { sqlite, environment } = installation({
        env: { ...authEnvironment, EDGE_EVER_AUTH_PASSWORD_FALLBACK: "fake-old-password" },
      });
      const ciphertext = encryptedSecret ?? await encryptSecret(FAKE_SECRET, "fake-key-from-another-instance");
      await insertS3Config(sqlite, { encryptedSecret: ciphertext, isActive: true });

      const error = await resolveObjectStorage(environment).catch((caught) => caught);
      expect(error).toMatchObject({ name: "AppError", code: "object_storage_unavailable", status: 503 });
      expect(error.message).not.toContain(FAKE_SECRET);
      expect(error.message).not.toContain(ciphertext);
      expect(storedSecret(sqlite)).toBe(ciphertext);
      sqlite.close();
    });
  }

  test("re-encrypts a credential saved under the rotated-password fallback with the primary key once", async () => {
    const environmentKeys = {
      EDGE_EVER_AUTH_PASSWORD: "fake-new-password",
      EDGE_EVER_AUTH_PASSWORD_FALLBACK: "fake-old-password",
    };
    const { sqlite, environment } = installation({ env: environmentKeys });
    const fallbackCiphertext = await encryptSecret(FAKE_SECRET, "edgeever:object-storage:v1:fake-old-password");
    await insertS3Config(sqlite, { encryptedSecret: fallbackCiphertext, isActive: true });
    recordS3Requests();

    expect((await resolveObjectStorage(environment)).configId).toBe("instance-s3");
    const migrated = storedSecret(sqlite);
    expect(migrated).not.toBe(fallbackCiphertext);
    expect(migrated).not.toContain(FAKE_SECRET);
    expect(await decryptSecret(migrated, resolvePrimaryObjectStorageEncryptionKey(environmentKeys)))
      .toBe(FAKE_SECRET);

    await resolveObjectStorage(environment);
    expect(storedSecret(sqlite)).toBe(migrated);

    // Once migrated, the credential no longer depends on the fallback secret.
    const { EDGE_EVER_AUTH_PASSWORD_FALLBACK: _removed, ...withoutFallback } = environment;
    expect((await resolveObjectStorage(withoutFallback)).configId).toBe("instance-s3");
    sqlite.close();
  });

  test("keeps a legacy-key credential readable but unmigrated when no primary key exists", async () => {
    const legacyEnvironment = { EDGE_EVER_STORAGE_ENCRYPTION_KEY: "fake-legacy-storage-key" };
    const { sqlite, environment } = installation({ env: legacyEnvironment });
    const legacyCiphertext = await encryptSecret(FAKE_SECRET, "fake-legacy-storage-key");
    await insertS3Config(sqlite, { encryptedSecret: legacyCiphertext, isActive: true });

    expect((await resolveObjectStorage(environment)).configId).toBe("instance-s3");
    expect(storedSecret(sqlite)).toBe(legacyCiphertext);
    sqlite.close();
  });

  test("deletes objects from the storage each resource was saved with", async () => {
    const { sqlite, resources, environment } = installation();
    await insertS3Config(sqlite, { isActive: true });
    const requests = recordS3Requests();

    await deleteStoredObjects(environment, [
      { storage_config_id: "builtin", object_key: "builtin-a" },
      { storage_config_id: "instance-s3", object_key: "s3-a" },
      { storage_config_id: null, object_key: "builtin-b" },
      { object_key: "builtin-c" },
      { storage_config_id: "instance-s3", object_key: "s3-b" },
    ]);

    expect(resources.deleted).toEqual([["builtin-a", "builtin-b", "builtin-c"]]);
    expect(requests).toEqual([
      { method: "DELETE", url: "https://objects.example.test/edgeever-fake/notes/s3-a" },
      { method: "DELETE", url: "https://objects.example.test/edgeever-fake/notes/s3-b" },
    ]);
    sqlite.close();
  });

  test("does nothing for an empty deletion and stops on an unavailable configuration", async () => {
    const { sqlite, resources, environment } = installation();
    const requests = recordS3Requests();

    await deleteStoredObjects(environment, []);
    expect(resources.deleted).toEqual([]);

    await expect(deleteStoredObjects(environment, [
      { storage_config_id: "deleted-config", object_key: "orphan" },
    ])).rejects.toMatchObject({ code: "object_storage_unavailable", status: 503 });
    expect(requests).toHaveLength(0);
    sqlite.close();
  });
});
