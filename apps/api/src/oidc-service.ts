import { randomToken } from "./auth-crypto";
import { createId, isoNow } from "./entity-utils";
import {
  isEmailAllowed,
  sanitizeOidcUsername,
  type OidcRuntimeConfig,
} from "./oidc-config";
import type { DatabaseAdapter } from "./storage-contract";
import type { UserRow } from "./auth-routes";

export type OidcDiscoveryDocument = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
};

export type OidcLoginState = {
  state: string;
  nonce: string;
  codeVerifier: string;
  redirectTo: string | null;
  deviceId: string | null;
};

export type OidcTokenClaims = {
  issuer: string;
  subject: string;
  email: string | null;
  username: string;
  displayName: string | null;
};

export type OidcJwtPayload = {
  iss?: string;
  sub?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  nonce?: string;
  email?: string;
  name?: string;
  preferred_username?: string;
};

type DiscoveryCacheEntry = {
  document: OidcDiscoveryDocument;
  expiresAt: number;
};

type OidcJwk = JsonWebKey & { kid?: string; alg?: string; use?: string };

type JwksCacheEntry = {
  keys: OidcJwk[];
  expiresAt: number;
};

const discoveryCache = new Map<string, DiscoveryCacheEntry>();
const jwksCache = new Map<string, JwksCacheEntry>();
const DISCOVERY_TTL_MS = 10 * 60 * 1000;
const LOGIN_STATE_TTL_MS = 10 * 60 * 1000;

const base64UrlEncode = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

export const sha256Base64Url = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return base64UrlEncode(new Uint8Array(digest));
};

export const createOidcLoginChallenge = async (): Promise<OidcLoginState & { codeChallenge: string }> => {
  const codeVerifier = randomToken(32);
  return {
    state: randomToken(24),
    nonce: randomToken(24),
    codeVerifier,
    redirectTo: null,
    deviceId: null,
    codeChallenge: await sha256Base64Url(codeVerifier),
  };
};

const discoveryUrl = (issuer: string) => `${issuer}/.well-known/openid-configuration`;

export const fetchOidcDiscovery = async (
  issuer: string,
  fetcher: typeof fetch = fetch,
): Promise<OidcDiscoveryDocument> => {
  const cacheKey = issuer;
  const cached = discoveryCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.document;

  const response = await fetcher(discoveryUrl(issuer), {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`OIDC discovery failed with HTTP ${response.status}.`);
  }

  const body = await response.json() as Partial<OidcDiscoveryDocument>;
  if (!body.authorization_endpoint || !body.token_endpoint || !body.jwks_uri || !body.issuer) {
    throw new Error("OIDC discovery document is missing required endpoints.");
  }

  const normalizedIssuer = issuer.replace(/\/+$/, "");
  const discoveredIssuer = body.issuer.replace(/\/+$/, "");
  if (discoveredIssuer !== normalizedIssuer) {
    throw new Error("OIDC discovery issuer mismatch.");
  }

  const document = {
    issuer: discoveredIssuer,
    authorization_endpoint: body.authorization_endpoint,
    token_endpoint: body.token_endpoint,
    jwks_uri: body.jwks_uri,
  };
  discoveryCache.set(cacheKey, { document, expiresAt: Date.now() + DISCOVERY_TTL_MS });
  return document;
};

export const buildAuthorizationUrl = (
  discovery: OidcDiscoveryDocument,
  config: OidcRuntimeConfig,
  challenge: { state: string; nonce: string; codeChallenge: string },
  redirectUri: string,
) => {
  const url = new URL(discovery.authorization_endpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", config.scopes);
  url.searchParams.set("state", challenge.state);
  url.searchParams.set("nonce", challenge.nonce);
  url.searchParams.set("code_challenge", challenge.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
};

const base64UrlDecode = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const decodeJwtPart = (value: string) => JSON.parse(new TextDecoder().decode(base64UrlDecode(value)));

const fetchJwks = async (jwksUri: string, fetcher: typeof fetch = fetch) => {
  const cached = jwksCache.get(jwksUri);
  if (cached && cached.expiresAt > Date.now()) return cached.keys;
  const response = await fetcher(jwksUri, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`OIDC JWKS fetch failed with HTTP ${response.status}.`);
  const body = await response.json() as { keys?: JwksCacheEntry["keys"] };
  if (!Array.isArray(body.keys) || body.keys.length === 0) {
    throw new Error("OIDC JWKS document did not include keys.");
  }
  jwksCache.set(jwksUri, { keys: body.keys, expiresAt: Date.now() + DISCOVERY_TTL_MS });
  return body.keys;
};

const importSigningKey = async (jwk: OidcJwk) => {
  const algorithm = jwk.alg === "ES256" || jwk.kty === "EC"
    ? { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" }
    : { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" };
  return crypto.subtle.importKey("jwk", jwk, algorithm, false, ["verify"]);
};

const audienceIncludes = (audience: unknown, clientId: string) =>
  audience === clientId || (Array.isArray(audience) && audience.includes(clientId));

const issuerMatches = (issuer: unknown, expected: string) =>
  issuer === expected || issuer === `${expected}/`;

export const verifyOidcIdToken = async (
  idToken: string,
  discovery: OidcDiscoveryDocument,
  config: OidcRuntimeConfig,
  nonce: string,
  fetcher: typeof fetch = fetch,
): Promise<OidcJwtPayload> => {
  const [headerPart, payloadPart, signaturePart] = idToken.split(".");
  if (!headerPart || !payloadPart || !signaturePart) {
    throw new Error("OIDC id_token is malformed.");
  }

  const header = decodeJwtPart(headerPart) as { kid?: string; alg?: string };
  const payload = decodeJwtPart(payloadPart) as OidcJwtPayload;
  if (header.alg !== "RS256" && header.alg !== "ES256") {
    throw new Error("OIDC id_token uses an unsupported signing algorithm.");
  }
  const keys = await fetchJwks(discovery.jwks_uri, fetcher);
  const jwk = header.kid
    ? keys.find((key) => key.kid === header.kid)
    : keys.length === 1
      ? keys[0]
      : undefined;
  if (!jwk) throw new Error("OIDC JWKS did not contain a usable signing key.");
  if (jwk.use && jwk.use !== "sig") {
    throw new Error("OIDC JWKS key is not intended for signing.");
  }
  if (jwk.alg && jwk.alg !== header.alg) {
    throw new Error("OIDC id_token algorithm does not match its signing key.");
  }

  const key = await importSigningKey(jwk);
  const algorithm = jwk.alg === "ES256" || jwk.kty === "EC"
    ? { name: "ECDSA", hash: "SHA-256" }
    : { name: "RSASSA-PKCS1-v1_5" };
  const signed = new TextEncoder().encode(`${headerPart}.${payloadPart}`);
  const signature = base64UrlDecode(signaturePart);
  const valid = await crypto.subtle.verify(algorithm, key, signature, signed);
  if (!valid) throw new Error("OIDC id_token signature is invalid.");
  if (!issuerMatches(payload.iss, discovery.issuer) && !issuerMatches(payload.iss, config.issuer)) {
    throw new Error("OIDC id_token issuer mismatch.");
  }
  if (!audienceIncludes(payload.aud, config.clientId)) {
    throw new Error("OIDC id_token audience mismatch.");
  }
  if (typeof payload.exp !== "number") {
    throw new Error("OIDC id_token is missing exp.");
  }
  if (payload.exp * 1000 <= Date.now() - 30_000) {
    throw new Error("OIDC id_token has expired.");
  }
  if (typeof payload.nbf === "number" && payload.nbf * 1000 > Date.now() + 30_000) {
    throw new Error("OIDC id_token is not active yet.");
  }
  if (payload.nonce !== nonce) {
    throw new Error("OIDC id_token nonce mismatch.");
  }
  if (!payload.sub || typeof payload.sub !== "string") {
    throw new Error("OIDC id_token is missing sub.");
  }
  return payload;
};

export const exchangeOidcAuthorizationCode = async (
  discovery: OidcDiscoveryDocument,
  config: OidcRuntimeConfig,
  input: { code: string; codeVerifier: string; redirectUri: string; nonce: string },
  fetcher: typeof fetch = fetch,
) => {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code_verifier: input.codeVerifier,
  });
  const response = await fetcher(discovery.token_endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!response.ok) {
    throw new Error(`OIDC token exchange failed with HTTP ${response.status}.`);
  }
  const tokenSet = await response.json() as { id_token?: string };
  if (!tokenSet.id_token) {
    throw new Error("OIDC token response did not include an id_token.");
  }
  return verifyOidcIdToken(tokenSet.id_token, discovery, config, input.nonce, fetcher);
};

export const claimsFromIdToken = (payload: OidcJwtPayload, config: OidcRuntimeConfig): OidcTokenClaims => {
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : null;
  const claim = (payload as Record<string, unknown>)[config.usernameClaim];
  const usernameSource = typeof claim === "string" && claim.trim()
    ? claim
    : email?.split("@")[0] || String(payload.sub);
  const displayName = typeof payload.name === "string" && payload.name.trim()
    ? payload.name.trim()
    : null;
  return {
    issuer: String(payload.iss ?? "").replace(/\/+$/, ""),
    subject: String(payload.sub),
    email,
    username: sanitizeOidcUsername(usernameSource),
    displayName,
  };
};

export const persistOidcLoginState = async (
  database: DatabaseAdapter,
  state: OidcLoginState,
) => {
  const now = Date.now();
  await database.batch([
    database.prepare(`DELETE FROM oidc_login_states WHERE expires_at <= ?`).bind(new Date(now).toISOString()),
    database.prepare(
      `INSERT INTO oidc_login_states (state, nonce, code_verifier, redirect_to, device_id, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      state.state,
      state.nonce,
      state.codeVerifier,
      state.redirectTo,
      state.deviceId,
      new Date(now + LOGIN_STATE_TTL_MS).toISOString(),
      isoNow(),
    ),
  ]);
};

export const consumeOidcLoginState = async (database: DatabaseAdapter, state: string) => {
  const now = isoNow();
  const row = await database.prepare(
    `SELECT state, nonce, code_verifier, redirect_to, device_id
     FROM oidc_login_states
     WHERE state = ? AND expires_at > ?`,
  ).bind(state, now).first<{
    state: string;
    nonce: string;
    code_verifier: string;
    redirect_to: string | null;
    device_id: string | null;
  }>();
  if (!row) return null;
  await database.prepare(`DELETE FROM oidc_login_states WHERE state = ?`).bind(state).run();
  return {
    state: row.state,
    nonce: row.nonce,
    codeVerifier: row.code_verifier,
    redirectTo: row.redirect_to,
    deviceId: row.device_id,
  } satisfies OidcLoginState;
};

const getEnabledUser = (database: DatabaseAdapter, userId: string) =>
  database.prepare(
    `SELECT id, username, password_hash, display_name, is_disabled
     FROM users
     WHERE id = ? AND is_disabled = 0`,
  ).bind(userId).first<UserRow>();

export const resolveOidcUser = async (
  database: DatabaseAdapter,
  config: OidcRuntimeConfig,
  claims: OidcTokenClaims,
  options: {
    hashPassword: (password: string) => Promise<string>;
    ensureUserWorkspace: (userId: string, username: string) => Promise<unknown>;
  },
): Promise<UserRow> => {
  const now = isoNow();
  const existingIdentity = await database.prepare(
    `SELECT user_id FROM oidc_identities WHERE issuer = ? AND subject = ?`,
  ).bind(claims.issuer, claims.subject).first<{ user_id: string }>();
  if (existingIdentity) {
    const user = await getEnabledUser(database, existingIdentity.user_id);
    if (!user) throw new Error("oidc_account_disabled");
    await database.prepare(
      `UPDATE oidc_identities SET email = ?, username = ?, last_login_at = ? WHERE issuer = ? AND subject = ?`,
    ).bind(claims.email, claims.username, now, claims.issuer, claims.subject).run();
    return user;
  }

  if (!isEmailAllowed(config, claims.email)) {
    throw new Error("oidc_email_not_allowed");
  }

  let user: UserRow | null = null;
  if (claims.email) {
    user = await database.prepare(
      `SELECT id, username, password_hash, display_name, is_disabled
       FROM users
       WHERE email = ? AND is_disabled = 0`,
    ).bind(claims.email).first<UserRow>();
  }

  const explicitlyAllowedEmail = claims.email !== null && config.allowedEmails.includes(claims.email);

  if (!user && explicitlyAllowedEmail) {
    user = await database.prepare(
      `SELECT id, username, password_hash, display_name, is_disabled
       FROM users
       WHERE username = ? AND is_disabled = 0`,
    ).bind(claims.username).first<UserRow>();
  }

  if (!user && explicitlyAllowedEmail) {
    const enabledUsers = await database.prepare(
      `SELECT id, username, password_hash, display_name, is_disabled
       FROM users
       WHERE is_disabled = 0
       LIMIT 2`,
    ).all<UserRow>();
    if (enabledUsers.results.length === 1) {
      user = enabledUsers.results[0];
    }
  }

  if (user) {
    await linkOidcIdentity(database, user.id, claims, now);
    if (claims.email) {
      await database.prepare(
        `UPDATE users SET email = COALESCE(email, ?), display_name = COALESCE(NULLIF(display_name, ''), ?), updated_at = ?
         WHERE id = ?`,
      ).bind(claims.email, claims.displayName ?? claims.username, now, user.id).run();
    }
    return user;
  }

  if (!config.autoProvision) {
    throw new Error("oidc_provisioning_disabled");
  }
  if (!isEmailAllowed(config, claims.email)) {
    throw new Error("oidc_email_not_allowed");
  }

  const userId = createId("usr");
  const username = await uniqueUsername(database, claims.username);
  const passwordHash = await options.hashPassword(randomToken(32));
  await database.prepare(
    `INSERT INTO users (id, username, password_hash, display_name, email, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(userId, username, passwordHash, claims.displayName ?? username, claims.email, now, now).run();
  await options.ensureUserWorkspace(userId, username);
  await linkOidcIdentity(database, userId, claims, now);
  const created = await getEnabledUser(database, userId);
  if (!created) throw new Error("oidc_user_create_failed");
  return created;
};

const uniqueUsername = async (database: DatabaseAdapter, base: string) => {
  const existing = await database.prepare(`SELECT id FROM users WHERE username = ?`).bind(base).first();
  if (!existing) return base;
  return sanitizeOidcUsername(`${base}-${randomToken(4)}`);
};

const linkOidcIdentity = (
  database: DatabaseAdapter,
  userId: string,
  claims: OidcTokenClaims,
  now: string,
) =>
  database.prepare(
    `INSERT INTO oidc_identities (id, user_id, issuer, subject, email, username, created_at, last_login_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(createId("oidc"), userId, claims.issuer, claims.subject, claims.email, claims.username, now, now).run();

export const isSafeOidcRedirect = (candidate: string | null | undefined, requestUrl: string) => {
  if (!candidate) return false;
  if (candidate.startsWith("/") && !candidate.startsWith("//")) return true;
  try {
    const target = new URL(candidate);
    const current = new URL(requestUrl);
    if (!["http:", "https:"].includes(target.protocol)) return false;
    if (target.origin === current.origin) return true;
    return target.hostname === "127.0.0.1" || target.hostname === "localhost";
  } catch {
    return false;
  }
};

export const resolveOidcRedirectUri = (config: OidcRuntimeConfig, requestUrl: string) =>
  config.redirectUri || new URL("/api/v1/auth/oidc/callback", requestUrl).toString();
