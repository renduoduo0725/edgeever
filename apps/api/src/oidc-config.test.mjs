import { describe, expect, test } from "bun:test";
import {
  hasOidcAllowlist,
  isEmailAllowed,
  isOidcEnabled,
  isPasswordLoginEnabled,
  resolveOidcRuntimeConfig,
  sanitizeOidcUsername,
} from "./oidc-config.ts";

const baseEnv = {
  EDGE_EVER_OIDC_ISSUER: "https://id.example.com/application/o/edgeever/",
  EDGE_EVER_OIDC_CLIENT_ID: "edgeever",
  EDGE_EVER_OIDC_CLIENT_SECRET: "secret",
};

describe("OIDC runtime config", () => {
  test("is disabled until issuer, client id, and secret are all set", () => {
    expect(isOidcEnabled({})).toBe(false);
    expect(isOidcEnabled({ EDGE_EVER_OIDC_ISSUER: "https://id.example.com" })).toBe(false);
    expect(isOidcEnabled(baseEnv)).toBe(true);
  });

  test("strips a trailing slash from the issuer", () => {
    expect(resolveOidcRuntimeConfig(baseEnv)?.issuer).toBe("https://id.example.com/application/o/edgeever");
  });

  test("keeps password login enabled unless explicitly disabled", () => {
    expect(isPasswordLoginEnabled({})).toBe(true);
    expect(isPasswordLoginEnabled({ EDGE_EVER_PASSWORD_LOGIN_ENABLED: "false" })).toBe(false);
  });

  test("allowlists emails and domains", () => {
    const config = resolveOidcRuntimeConfig({
      ...baseEnv,
      EDGE_EVER_OIDC_ALLOWED_EMAILS: "owner@example.com",
      EDGE_EVER_OIDC_ALLOWED_DOMAINS: "family.example",
    });
    expect(hasOidcAllowlist(config)).toBe(true);
    expect(isEmailAllowed(config, "owner@example.com")).toBe(true);
    expect(isEmailAllowed(config, "kid@family.example")).toBe(true);
    expect(isEmailAllowed(config, "stranger@gmail.com")).toBe(false);
  });

  test("sanitizes usernames from arbitrary claims", () => {
    expect(sanitizeOidcUsername("Ada Lovelace")).toBe("ada-lovelace");
    expect(sanitizeOidcUsername("***")).toBe("user");
  });
});
