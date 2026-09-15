import { afterAll, expect, test } from "bun:test";

const originalWindow = globalThis.window;
const originalDocument = globalThis.document;
const originalMutationObserver = globalThis.MutationObserver;
const values = new Map();
globalThis.window = {
  location: { href: "https://example.test" },
  localStorage: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    get length() { return values.size; },
    key: (index) => [...values.keys()][index] ?? null,
  },
  addEventListener() {},
  removeEventListener() {},
};
globalThis.document = {
  documentElement: {
    classList: { contains: () => false },
    dataset: {},
    style: { setProperty() {}, removeProperty() {} },
    removeAttribute() {},
  },
};
globalThis.MutationObserver = class { observe() {} disconnect() {} };

const { EdgeEverPluginHost } = await import("./plugin-host.ts");

afterAll(() => {
  globalThis.window = originalWindow;
  globalThis.document = originalDocument;
  globalThis.MutationObserver = originalMutationObserver;
});

const secretStorage = { get: async () => null, set: async () => {}, remove: async () => {}, clearNamespace: async () => {} };

const pluginManifest = (id) => ({
  type: "plugin",
  id,
  name: "Catalog sync",
  version: "1.0.0",
  apiVersion: "2",
  settingsUi: "host",
  entry: new URL("./plugin-lifecycle.fixture.mjs", import.meta.url).href,
  permissions: ["notes:read", "ui:commands", "ui:panels"],
});

test("enable and uninstall update the workspace catalog", async () => {
  values.clear();
  const upserts = [];
  const removals = [];
  const host = new EdgeEverPluginHost({
    scope: "catalog-host",
    packageStorage: { get: async () => null, put: async () => {}, remove: async () => {} },
    secretStorage,
    repository: { listMemos: async () => ({ memos: [], totalCount: 0, nextCursor: null }) },
    catalogAdapter: {
      list: async () => [],
      upsert: async (extensionId, input) => {
        upserts.push({ extensionId, input });
        return {
          extensionId,
          ...input,
          repositoryUrl: input.repositoryUrl ?? null,
          releaseTag: input.releaseTag ?? null,
          publisher: input.publisher ?? null,
          updatedAt: "2026-09-14T10:00:00.000Z",
          deletedAt: null,
        };
      },
      remove: async (extensionId) => {
        removals.push(extensionId);
        return {
          extensionId,
          type: "plugin",
          version: "1.0.0",
          enabled: false,
          installedAt: "2026-09-14T09:00:00.000Z",
          updatedAt: "2026-09-14T10:00:00.000Z",
          deletedAt: "2026-09-14T10:00:00.000Z",
          manifestUrl: "https://example.test/manifest.json",
          sourceKind: "manifest",
          verified: false,
          repositoryUrl: null,
          releaseTag: null,
          publisher: null,
        };
      },
    },
  });
  const id = "org.edgeever.catalog-sync";
  host.installManifest(pluginManifest(id), "https://example.test/manifest.json");
  await host.setEnabled(id, true);
  expect(upserts.at(-1)).toMatchObject({ extensionId: id, input: { enabled: true, version: "1.0.0" } });
  await host.uninstall(id);
  expect(removals).toEqual([id]);
  await host.dispose();
});

test("a remote tombstone uninstalls the local extension without writing the catalog again", async () => {
  values.clear();
  const upserts = [];
  const removals = [];
  const id = "org.edgeever.catalog-tombstone";
  // installManifest stamps catalogUpdatedAt with now; the tombstone must be newer
  // so reconcile uninstalls instead of treating the local install as a later write.
  const tombstoneAt = new Date(Date.now() + 60_000).toISOString();
  const host = new EdgeEverPluginHost({
    scope: "catalog-tombstone",
    packageStorage: { get: async () => null, put: async () => {}, remove: async () => {} },
    secretStorage,
    repository: { listMemos: async () => ({ memos: [], totalCount: 0, nextCursor: null }) },
    catalogAdapter: {
      list: async () => [{
        extensionId: id,
        type: "plugin",
        version: "1.0.0",
        enabled: false,
        installedAt: "2026-09-13T10:00:00.000Z",
        updatedAt: tombstoneAt,
        deletedAt: tombstoneAt,
        manifestUrl: "https://example.test/manifest.json",
        sourceKind: "manifest",
        verified: false,
        repositoryUrl: null,
        releaseTag: null,
        publisher: null,
      }],
      upsert: async (extensionId, input) => {
        upserts.push({ extensionId, input });
        throw new Error("tombstone reconcile must not upsert");
      },
      remove: async (extensionId) => {
        removals.push(extensionId);
        throw new Error("tombstone reconcile must not delete again");
      },
    },
  });
  host.installManifest(pluginManifest(id), "https://example.test/manifest.json");
  await host.syncFromCatalog();
  expect(host.getSnapshot().extensions.find((item) => item.manifest.id === id)).toBeUndefined();
  expect(upserts).toEqual([]);
  expect(removals).toEqual([]);
  await host.dispose();
});
