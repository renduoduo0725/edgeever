import { describe, expect, test } from "bun:test";
import { planCatalogReconcile } from "./plugin-catalog-sync.ts";

const remote = ({
  extensionId = "com.example.tasks",
  type = "plugin",
  version = "1.0.0",
  enabled = true,
  updatedAt = "2026-09-14T10:00:00.000Z",
  deletedAt = null,
  publisher = null,
} = {}) => ({
  extensionId,
  type,
  version,
  enabled,
  installedAt: "2026-09-13T10:00:00.000Z",
  updatedAt,
  deletedAt,
  manifestUrl: "https://github.com/example/tasks/releases/download/v1.0.0/manifest.json",
  sourceKind: "github",
  verified: false,
  repositoryUrl: "https://github.com/example/tasks",
  releaseTag: "v1.0.0",
  publisher,
});

const local = ({
  extensionId = "com.example.tasks",
  type = "plugin",
  version = "1.0.0",
  enabled = false,
  catalogUpdatedAt = "2026-09-13T10:00:00.000Z",
  publisher,
} = {}) => ({
  extensionId,
  type,
  version,
  enabled,
  catalogUpdatedAt,
  ...(publisher ? { publisher } : {}),
});

describe("planCatalogReconcile", () => {
  test("seeds local-only extensions and installs remote-only extensions", () => {
    expect(planCatalogReconcile({
      local: [local({ extensionId: "com.example.local" })],
      remote: [remote({ extensionId: "com.example.remote", publisher: "edgeever" })],
      hasTrustAcknowledgement: false,
      officialIds: new Set(["com.example.remote"]),
    })).toEqual([
      { type: "install", entry: remote({ extensionId: "com.example.remote", publisher: "edgeever" }) },
      { type: "setEnabled", extensionId: "com.example.remote", enabled: true },
      { type: "push", extensionId: "com.example.local" },
    ]);
  });

  test("does not enable community plugins on a new device before trust is acknowledged", () => {
    expect(planCatalogReconcile({
      local: [],
      remote: [remote()],
      hasTrustAcknowledgement: false,
      officialIds: new Set(),
    })).toEqual([
      { type: "install", entry: remote() },
      { type: "awaitTrust", extensionId: "com.example.tasks" },
    ]);
  });

  test("enables community plugins after trust is acknowledged and skips themes", () => {
    expect(planCatalogReconcile({
      local: [],
      remote: [remote(), remote({ extensionId: "com.example.nord", type: "theme" })],
      hasTrustAcknowledgement: true,
      officialIds: new Set(),
    })).toEqual([
      { type: "install", entry: remote() },
      { type: "setEnabled", extensionId: "com.example.tasks", enabled: true },
      { type: "install", entry: remote({ extensionId: "com.example.nord", type: "theme" }) },
      { type: "setEnabled", extensionId: "com.example.nord", enabled: true },
    ]);
  });

  test("uninstalls tombstones unless the local catalog is newer", () => {
    expect(planCatalogReconcile({
      local: [local()],
      remote: [remote({ deletedAt: "2026-09-14T11:00:00.000Z", updatedAt: "2026-09-14T11:00:00.000Z", enabled: false })],
      hasTrustAcknowledgement: true,
      officialIds: new Set(),
    })).toEqual([{ type: "uninstall", extensionId: "com.example.tasks" }]);

    expect(planCatalogReconcile({
      local: [local({ catalogUpdatedAt: "2026-09-14T12:00:00.000Z" })],
      remote: [remote({ deletedAt: "2026-09-14T11:00:00.000Z", updatedAt: "2026-09-14T11:00:00.000Z", enabled: false })],
      hasTrustAcknowledgement: true,
      officialIds: new Set(),
    })).toEqual([{ type: "push", extensionId: "com.example.tasks" }]);
  });

  test("pushes a newer local change and applies a newer remote version", () => {
    expect(planCatalogReconcile({
      local: [local({ version: "1.1.0", enabled: true, catalogUpdatedAt: "2026-09-14T12:00:00.000Z" })],
      remote: [remote({ version: "1.0.0", enabled: false, updatedAt: "2026-09-14T11:00:00.000Z" })],
      hasTrustAcknowledgement: true,
      officialIds: new Set(),
    })).toEqual([{ type: "push", extensionId: "com.example.tasks" }]);

    expect(planCatalogReconcile({
      local: [local({ version: "1.0.0", enabled: true })],
      remote: [remote({ version: "1.2.0", enabled: false, updatedAt: "2026-09-14T12:00:00.000Z" })],
      hasTrustAcknowledgement: true,
      officialIds: new Set(),
    })).toEqual([
      { type: "install", entry: remote({ version: "1.2.0", enabled: false, updatedAt: "2026-09-14T12:00:00.000Z" }) },
      { type: "setEnabled", extensionId: "com.example.tasks", enabled: false },
    ]);
  });
});
