import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { registerOidcRoutes } from "./oidc-routes.ts";

const environment = {
  EDGE_EVER_OIDC_ISSUER: "https://id.example.com/application/o/edgeever",
  EDGE_EVER_OIDC_CLIENT_ID: "edgeever",
  EDGE_EVER_OIDC_CLIENT_SECRET: "secret",
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

const createApp = () => {
  const app = new Hono();
  registerOidcRoutes(app, {
    createSession: async () => ({ id: "session", token: "token", maxAge: 60 }),
    ensureUserWorkspace: async () => ({ workspaceId: "workspace", role: "owner" }),
    setSessionCookie: () => undefined,
  });
  return app;
};

describe("OIDC route contracts", () => {
  test("reports OIDC as disabled when the instance has no client", async () => {
    const app = createApp();
    const response = await app.request("/api/v1/auth/oidc/config", {}, { storage: environment.storage });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      oidcEnabled: false,
      passwordLoginEnabled: true,
    });
  });

  test("reports OIDC as enabled when issuer and client secrets are present", async () => {
    const app = createApp();
    const response = await app.request("/api/v1/auth/oidc/config", {}, environment);
    expect(await response.json()).toEqual({
      oidcEnabled: true,
      passwordLoginEnabled: true,
    });
  });

  test("rejects login when OIDC is not configured", async () => {
    const app = createApp();
    const response = await app.request("/api/v1/auth/oidc/login", {}, { storage: environment.storage });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: { code: "oidc_not_configured" },
    });
  });
});
