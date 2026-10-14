import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { registerUserRoutes } from "./user-routes.ts";

const ownerAuth = {
  kind: "user",
  actorType: "user",
  actorId: "usr_owner",
  username: "owner",
  displayName: "Owner",
  scopes: [],
  workspaceId: "ws_owner",
  role: "owner",
};

const createEnvironment = (rows = []) => ({
  storage: {
    db: {
      prepare: () => ({
        all: async () => ({ results: rows }),
      }),
      batch: async () => [],
    },
    resources: {},
  },
});

const createApp = (authenticateRequest) => {
  const app = new Hono();
  registerUserRoutes(app, {
    authenticateRequest,
    getInstanceUser: async () => null,
  });
  return app;
};

describe("user route contracts", () => {
  test("rejects unauthenticated user listing", async () => {
    const app = createApp(async () => null);
    const response = await app.request("/api/v1/users", {}, createEnvironment());

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: "unauthorized" } });
  });

  test("rejects non-owner user listing", async () => {
    const app = createApp(async () => ({ ...ownerAuth, role: "member" }));
    const response = await app.request("/api/v1/users", {}, createEnvironment());

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "forbidden" } });
  });

  test("maps owner-visible users at the HTTP boundary", async () => {
    const app = createApp(async () => ownerAuth);
    const response = await app.request("/api/v1/users", {}, createEnvironment([{
      id: "usr_member",
      username: "writer",
      password_hash: "hidden",
      display_name: "Writer",
      is_disabled: 0,
      last_login_at: null,
      created_at: "2026-08-08T00:00:00.000Z",
      role: "member",
    }]));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      users: [{
        id: "usr_member",
        username: "writer",
        displayName: "Writer",
        role: "member",
        isDisabled: false,
        lastLoginAt: null,
        createdAt: "2026-08-08T00:00:00.000Z",
      }],
    });
  });
});


describe("instance attachment storage usage", () => {
  for (const [name, auth, status] of [
    ["anonymous requests", null, 401],
    ["members", { ...ownerAuth, role: "member" }, 403],
    ["API tokens even with owner role", { ...ownerAuth, kind: "token", actorType: "agent", scopes: ["read:resources"] }, 403],
  ]) {
    test(`rejects ${name} before querying storage`, async () => {
      const app = createApp(async () => auth);
      const response = await app.request("/api/v1/instance/storage-usage", {}, {
        storage: { db: { prepare() { throw new Error("Unauthorized query"); } } },
      });
      expect(response.status).toBe(status);
    });
  }

  test("aggregates every workspace without a list limit, excluding deleted resources", async () => {
    const sqlite = new Database(":memory:");
    try {
      sqlite.exec(`
        CREATE TABLE users (id TEXT PRIMARY KEY, is_disabled INTEGER);
        CREATE TABLE workspace_members (workspace_id TEXT, user_id TEXT);
        CREATE TABLE memos (id TEXT PRIMARY KEY, workspace_id TEXT, is_deleted INTEGER);
        CREATE TABLE resources (memo_id TEXT, kind TEXT, byte_size INTEGER, is_deleted INTEGER);
        INSERT INTO users VALUES ('owner', 0), ('disabled_member', 1), ('empty_member', 0);
        INSERT INTO workspace_members VALUES ('ws_owner', 'owner'), ('ws_member', 'disabled_member'), ('ws_empty', 'empty_member');
        INSERT INTO memos VALUES ('owner_note', 'ws_owner', 0), ('member_note', 'ws_member', 0), ('trash_note', 'ws_member', 1);
        INSERT INTO resources VALUES ('member_note', 'attachment', 2048, 0), ('trash_note', 'image', 8192, 1), ('owner_note', 'attachment', 4096, 1);
      `);
      const insert = sqlite.query("INSERT INTO resources VALUES ('owner_note', 'image', 1024, 0)");
      for (let index = 0; index < 501; index++) insert.run();
      const env = { storage: { db: { prepare: (sql) => ({ first: async () => sqlite.query(sql).get(), all: async () => ({ results: sqlite.query(sql).all() }) }) } } };
      const app = createApp(async () => ownerAuth);
      const response = await app.request("/api/v1/instance/storage-usage", {}, env);
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.summary).toEqual({
        totalCount: 502, totalBytes: 501 * 1024 + 2048, imageCount: 501, attachmentCount: 1,
      });
      expect(result.users.sort((a, b) => a.userId.localeCompare(b.userId))).toEqual([
        { userId: "disabled_member", summary: { totalCount: 1, totalBytes: 2048, imageCount: 0, attachmentCount: 1 } },
        { userId: "empty_member", summary: { totalCount: 0, totalBytes: 0, imageCount: 0, attachmentCount: 0 } },
        { userId: "owner", summary: { totalCount: 501, totalBytes: 501 * 1024, imageCount: 501, attachmentCount: 0 } },
      ]);
      expect(result.users.reduce((sum, user) => sum + user.summary.totalBytes, 0)).toBe(result.summary.totalBytes);
      sqlite.exec("DELETE FROM resources");
      const empty = await app.request("/api/v1/instance/storage-usage", {}, env);
      const emptyResult = await empty.json();
      expect(emptyResult.summary).toEqual({
        totalCount: 0, totalBytes: 0, imageCount: 0, attachmentCount: 0,
      });
      expect(emptyResult.users).toHaveLength(3);
      for (const user of emptyResult.users) expect(user.summary).toEqual(emptyResult.summary);
    } finally {
      sqlite.close();
    }
  });
});
