import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { globSync, readFileSync } from "node:fs";
import { Hono } from "hono";
import { hashPassword, verifyPassword } from "./auth-crypto.ts";
import { registerAuthRoutes } from "./auth-routes.ts";
import { authenticateRequest } from "./auth-service.ts";
import { sha256 } from "./hash-utils.ts";
import { createSelfHostedStorageAdapter } from "./self-hosted-storage-adapter.ts";

const interactiveAuth = {
  kind: "user",
  actorType: "user",
  actorId: "usr_owner",
  username: "owner",
  displayName: "Owner",
  scopes: [],
  workspaceId: "ws_owner",
  role: "owner",
  sessionId: "session_current",
};

const environment = {
  storage: {
    db: {
      prepare: () => {
        throw new Error("Database access was not expected");
      },
      batch: async () => [],
    },
    resources: {},
  },
};

const createApp = (overrides = {}) => {
  const app = new Hono();
  registerAuthRoutes(app, {
    authenticateRequest: async () => null,
    authenticateSession: async () => null,
    createSession: async () => ({ id: "session", token: "token", maxAge: 60 }),
    ensureUserWorkspace: async () => ({ workspaceId: "workspace", role: "owner" }),
    getBearerToken: () => null,
    getInstanceAuthMode: async () => "required",
    getLoginAttemptKeys: async () => [],
    isDemoEnvironment: () => false,
    isDemoMode: () => false,
    revokeSession: async () => undefined,
    setSessionCookie: () => undefined,
    tooManyLoginAttempts: () => new Response(null, { status: 429 }),
    verifyLogin: async () => null,
    ...overrides,
  });
  return app;
};

describe("auth route contracts", () => {
  test("reports the local owner when authentication is disabled", async () => {
    const app = createApp({
      getInstanceAuthMode: async () => "disabled",
      isDemoEnvironment: () => true,
    });
    const response = await app.request("/api/v1/auth/session", {}, environment);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      authRequired: false,
      authenticated: true,
      demoMode: true,
      user: {
        id: "local",
        username: "owner",
        displayName: "Owner",
        role: "owner",
      },
    });
  });

  test("reports an anonymous required-auth session without touching storage", async () => {
    const app = createApp();
    const response = await app.request("/api/v1/auth/session", {}, environment);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      authRequired: true,
      authenticated: false,
      user: null,
    });
  });

  test("does not allow the current session to revoke itself", async () => {
    const app = createApp({ authenticateRequest: async () => interactiveAuth });
    const response = await app.request(
      "/api/v1/auth/sessions/session_current",
      { method: "DELETE" },
      environment,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "current_session_cannot_be_revoked" },
    });
  });

  test("accepts a bearer backed interactive session for password changes", async () => {
    const app = createApp({
      authenticateRequest: async (context) =>
        context.req.header("Authorization") === "Bearer desktop-session" ? interactiveAuth : null,
      isDemoMode: () => true,
    });
    const response = await app.request(
      "/api/v1/auth/change-password",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer desktop-session",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword: "old-password",
          newPassword: "new-password",
          confirmPassword: "new-password",
        }),
      },
      environment,
    );

    expect(response.status).toBe(403);
  });

  test("does not allow an API token to change a password", async () => {
    const app = createApp({
      authenticateRequest: async () => ({ ...interactiveAuth, kind: "agent" }),
    });
    const response = await app.request(
      "/api/v1/auth/change-password",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: "old-password",
          newPassword: "new-password",
          confirmPassword: "new-password",
        }),
      },
      environment,
    );

    expect(response.status).toBe(401);
  });

  test("changes a password with an existing desktop bearer session and revokes other sessions", async () => {
    const sqlite = new Database(":memory:");
    try {
      for (const path of globSync("migrations/*.sql").sort()) {
        sqlite.exec(readFileSync(path, "utf8"));
      }
      const oldPasswordHash = await hashPassword("old-password");
      sqlite.query("INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)")
        .run("usr_owner", "owner", oldPasswordHash);
      sqlite.query("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)")
        .run("ws_default", "usr_owner", "owner");
      const expiry = new Date(Date.now() + 86_400_000).toISOString();
      sqlite.query("INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)")
        .run("session_current", "usr_owner", await sha256("existing-desktop-token"), expiry);
      sqlite.query("INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)")
        .run("session_other", "usr_owner", await sha256("other-device-token"), expiry);

      const app = createApp({ authenticateRequest });
      const existingSessionEnvironment = {
        storage: createSelfHostedStorageAdapter(sqlite, "/tmp/edgeever-auth-route-test-resources"),
      };
      const response = await app.request(
        "/api/v1/auth/change-password",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer existing-desktop-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            currentPassword: "old-password",
            newPassword: "new-password",
            confirmPassword: "new-password",
          }),
        },
        existingSessionEnvironment,
      );

      expect(response.status).toBe(200);
      const passwordHash = sqlite.query("SELECT password_hash FROM users WHERE id = ?")
        .get("usr_owner").password_hash;
      expect(await verifyPassword("new-password", passwordHash)).toBe(true);
      expect(await verifyPassword("old-password", passwordHash)).toBe(false);
      expect(sqlite.query("SELECT revoked_at FROM sessions WHERE id = ?").get("session_current").revoked_at).toBeNull();
      expect(sqlite.query("SELECT revoked_at FROM sessions WHERE id = ?").get("session_other").revoked_at).not.toBeNull();
    } finally {
      sqlite.close();
    }
  });
});
