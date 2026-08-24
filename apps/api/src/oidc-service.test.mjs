import { describe, expect, test } from "bun:test";
import {
  claimsFromIdToken,
  fetchOidcDiscovery,
  isSafeOidcRedirect,
  verifyOidcIdToken,
} from "./oidc-service.ts";
import { resolveOidcRuntimeConfig } from "./oidc-config.ts";

const config = resolveOidcRuntimeConfig({
  EDGE_EVER_OIDC_ISSUER: "https://id.example.com/application/o/edgeever",
  EDGE_EVER_OIDC_CLIENT_ID: "edgeever",
  EDGE_EVER_OIDC_CLIENT_SECRET: "secret",
});
if (!config) throw new Error("expected OIDC config");

const base64Url = (value) => {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const createRs256Token = async (payload, header = { alg: "RS256", kid: "signing-key" }) => {
  const keyPair = await crypto.subtle.generateKey({
    name: "RSASSA-PKCS1-v1_5",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: "SHA-256",
  }, true, ["sign", "verify"]);
  const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  Object.assign(publicJwk, { alg: "RS256", kid: "signing-key", use: "sig" });
  const headerPart = base64Url(JSON.stringify(header));
  const payloadPart = base64Url(JSON.stringify(payload));
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    keyPair.privateKey,
    new TextEncoder().encode(`${headerPart}.${payloadPart}`),
  );
  return { token: `${headerPart}.${payloadPart}.${base64Url(signature)}`, publicJwk };
};

const discovery = {
  issuer: config.issuer,
  authorization_endpoint: `${config.issuer}/authorize`,
  token_endpoint: `${config.issuer}/token`,
  jwks_uri: `${config.issuer}/jwks`,
};

const jwksFetcher = (publicJwk) => async () => new Response(
  JSON.stringify({ keys: [publicJwk] }),
  { headers: { "Content-Type": "application/json" } },
);

describe("OIDC helpers", () => {
  test("extracts claims from an id_token payload", () => {
    const claims = claimsFromIdToken({
      iss: "https://id.example.com/application/o/edgeever/",
      sub: "user-1",
      email: "Owner@example.com",
      preferred_username: "Owner",
      name: "Owner",
    }, config);

    expect(claims).toEqual({
      issuer: "https://id.example.com/application/o/edgeever",
      subject: "user-1",
      email: "owner@example.com",
      username: "owner",
      displayName: "Owner",
    });
  });

  test("accepts same-origin and loopback post-login redirects", () => {
    const requestUrl = "https://notes.example.com/api/v1/auth/oidc/callback";
    expect(isSafeOidcRedirect("/", requestUrl)).toBe(true);
    expect(isSafeOidcRedirect("https://notes.example.com/settings", requestUrl)).toBe(true);
    expect(isSafeOidcRedirect("http://127.0.0.1:5173/", requestUrl)).toBe(true);
    expect(isSafeOidcRedirect("https://evil.example/steal", requestUrl)).toBe(false);
    expect(isSafeOidcRedirect("//evil.example", requestUrl)).toBe(false);
  });

  test("rejects discovery metadata for a different issuer", async () => {
    await expect(fetchOidcDiscovery(
      "https://id.example.com/application/o/discovery-test",
      async () => new Response(JSON.stringify({
        issuer: "https://attacker.example/application/o/discovery-test",
        authorization_endpoint: "https://attacker.example/authorize",
        token_endpoint: "https://attacker.example/token",
        jwks_uri: "https://attacker.example/jwks",
      }), { headers: { "Content-Type": "application/json" } }),
    )).rejects.toThrow("OIDC discovery issuer mismatch.");
  });

  test("verifies a signed RS256 token with issuer, audience, expiry, and nonce", async () => {
    const { token, publicJwk } = await createRs256Token({
      iss: config.issuer,
      sub: "user-1",
      aud: config.clientId,
      exp: Math.floor(Date.now() / 1000) + 300,
      nonce: "nonce-1",
    });
    await expect(verifyOidcIdToken(
      token,
      { ...discovery, jwks_uri: `${discovery.jwks_uri}/valid` },
      config,
      "nonce-1",
      jwksFetcher(publicJwk),
    )).resolves.toMatchObject({ sub: "user-1" });
  });

  test("rejects unsupported algorithms, unknown key ids, and tokens without expiry", async () => {
    const payload = {
      iss: config.issuer,
      sub: "user-1",
      aud: config.clientId,
      exp: Math.floor(Date.now() / 1000) + 300,
      nonce: "nonce-1",
    };
    const unsupported = await createRs256Token(payload, { alg: "HS256", kid: "signing-key" });
    await expect(verifyOidcIdToken(
      unsupported.token,
      { ...discovery, jwks_uri: `${discovery.jwks_uri}/unsupported` },
      config,
      "nonce-1",
      jwksFetcher(unsupported.publicJwk),
    )).rejects.toThrow("unsupported signing algorithm");

    const unknownKey = await createRs256Token(payload, { alg: "RS256", kid: "unknown-key" });
    await expect(verifyOidcIdToken(
      unknownKey.token,
      { ...discovery, jwks_uri: `${discovery.jwks_uri}/unknown` },
      config,
      "nonce-1",
      jwksFetcher(unknownKey.publicJwk),
    )).rejects.toThrow("did not contain a usable signing key");

    const missingExpiry = await createRs256Token({
      iss: config.issuer,
      sub: "user-1",
      aud: config.clientId,
      nonce: "nonce-1",
    });
    await expect(verifyOidcIdToken(
      missingExpiry.token,
      { ...discovery, jwks_uri: `${discovery.jwks_uri}/missing-expiry` },
      config,
      "nonce-1",
      jwksFetcher(missingExpiry.publicJwk),
    )).rejects.toThrow("missing exp");
  });
});
