import { describe, expect, test } from "bun:test";
import { globSync, readFileSync } from "node:fs";
import { Database } from "bun:sqlite";
import { Hono } from "hono";
import { registerWorkspaceExtensionRoutes } from "./workspace-extension-routes.ts";

const auth = {
  kind: "user",
  actorType: "user",
  actorId: "usr_owner",
  username: "owner",
  displayName: "Owner",
  scopes: [],
  workspaceId: "ws_extensions",
  role: "owner",
};

class SqlitePreparedStatement {
  constructor(db, sql, bindings = []) {
    this.db = db;
    this.sql = sql;
    this.bindings = bindings;
  }
  bind(...bindings) { return new SqlitePreparedStatement(this.db, this.sql, bindings); }
  async all() { return { results: this.db.query(this.sql).all(...this.bindings), success: true, meta: {} }; }
  async first() { return this.db.query(this.sql).get(...this.bindings) ?? null; }
  async run() {
    this.db.query(this.sql).run(...this.bindings);
    return { results: [], success: true, meta: {} };
  }
}

class SqliteDatabase {
  constructor(db) { this.db = db; }
  prepare(sql) { return new SqlitePreparedStatement(this.db, sql); }
  async batch(statements) {
    return this.db.transaction(() => statements.map((statement) =>
      this.db.query(statement.sql).run(...statement.bindings)))();
  }
}

const createFixture = ({ demoMode = false } = {}) => {
  const sqlite = new Database(":memory:");
  for (const migration of globSync("migrations/*.sql").sort()) {
    sqlite.exec(readFileSync(migration, "utf8"));
  }
  sqlite.query("INSERT INTO workspaces (id, name, is_personal) VALUES (?, ?, 1)")
    .run(auth.workspaceId, "Extension workspace");
  const app = new Hono();
  app.use("/api/v1/*", async (context, next) => {
    context.set("auth", auth);
    await next();
  });
  registerWorkspaceExtensionRoutes(app, { isDemoMode: () => demoMode });
  return {
    app,
    environment: { storage: { db: new SqliteDatabase(sqlite), resources: {} } },
  };
};

const pluginBody = {
  type: "plugin",
  version: "1.2.0",
  enabled: true,
  installedAt: "2026-09-13T12:00:00.000Z",
  manifestUrl: "https://github.com/example/recent-notes/releases/download/v1.2.0/manifest.json",
  sourceKind: "github",
  verified: false,
  repositoryUrl: "https://github.com/example/recent-notes",
  releaseTag: "v1.2.0",
};

describe("workspace extension catalog routes", () => {
  test("upserts the install list, tombstones uninstalls, and restores a later install", async () => {
    const { app, environment } = createFixture();
    const created = await app.request("/api/v1/workspace-extensions/com.example.recent-notes", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(pluginBody),
    }, environment);
    expect(created.status).toBe(200);
    const createdExtension = (await created.json()).extension;
    expect(createdExtension).toMatchObject({
      extensionId: "com.example.recent-notes",
      type: "plugin",
      version: "1.2.0",
      enabled: true,
      deletedAt: null,
      sourceKind: "github",
      repositoryUrl: "https://github.com/example/recent-notes",
    });

    const listed = await app.request("/api/v1/workspace-extensions", {}, environment);
    expect((await listed.json()).extensions).toHaveLength(1);

    const removed = await app.request("/api/v1/workspace-extensions/com.example.recent-notes", {
      method: "DELETE",
    }, environment);
    expect(removed.status).toBe(200);
    const tombstone = (await removed.json()).extension;
    expect(tombstone.deletedAt).toBeTruthy();
    expect(tombstone.enabled).toBe(false);

    const listedAfterDelete = await app.request("/api/v1/workspace-extensions", {}, environment);
    expect((await listedAfterDelete.json()).extensions[0].deletedAt).toBeTruthy();

    const restored = await app.request("/api/v1/workspace-extensions/com.example.recent-notes", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...pluginBody, version: "1.3.0", enabled: false }),
    }, environment);
    expect((await restored.json()).extension).toMatchObject({
      version: "1.3.0",
      enabled: false,
      deletedAt: null,
    });
  });

  test("keeps only one enabled theme in the workspace catalog", async () => {
    const { app, environment } = createFixture();
    const theme = (name, enabled) => ({
      type: "theme",
      version: "1.0.0",
      enabled,
      installedAt: "2026-09-13T12:00:00.000Z",
      manifestUrl: `https://example.test/${name}/manifest.json`,
      sourceKind: "manifest",
      verified: false,
    });

    await app.request("/api/v1/workspace-extensions/com.example.theme-one", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(theme("theme-one", true)),
    }, environment);
    await app.request("/api/v1/workspace-extensions/com.example.theme-two", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(theme("theme-two", true)),
    }, environment);

    const listed = await app.request("/api/v1/workspace-extensions", {}, environment);
    const extensions = (await listed.json()).extensions;
    const enabled = extensions.filter((item) => item.enabled).map((item) => item.extensionId);
    expect(enabled).toEqual(["com.example.theme-two"]);
    expect(extensions.find((item) => item.extensionId === "com.example.theme-one").enabled).toBe(false);
  });

  test("rejects demo workspaces and invalid extension ids", async () => {
    const demo = createFixture({ demoMode: true });
    const demoResponse = await demo.app.request("/api/v1/workspace-extensions", {}, demo.environment);
    expect(demoResponse.status).toBe(403);

    const { app, environment } = createFixture();
    const invalid = await app.request("/api/v1/workspace-extensions/invalid", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(pluginBody),
    }, environment);
    expect(invalid.status).toBe(400);
  });
});
