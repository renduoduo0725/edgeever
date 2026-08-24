import type { Hono } from "hono";
import { hashPassword } from "./auth-crypto";
import type { AppContext, AppEnv } from "./api-context";
import type { UserRow } from "./auth-routes";
import { apiError } from "./http-errors";
import {
  oidcSessionHints,
  resolveOidcRuntimeConfig,
} from "./oidc-config";
import {
  buildAuthorizationUrl,
  claimsFromIdToken,
  consumeOidcLoginState,
  createOidcLoginChallenge,
  exchangeOidcAuthorizationCode,
  fetchOidcDiscovery,
  isSafeOidcRedirect,
  persistOidcLoginState,
  resolveOidcRedirectUri,
  resolveOidcUser,
} from "./oidc-service";
import { audit } from "./audit";
import type { DatabaseAdapter } from "./storage-contract";

type OidcRouteDependencies = {
  createSession: (context: AppContext, user: UserRow, requestedDeviceId?: string) => Promise<{
    id: string;
    token: string;
    maxAge: number;
  }>;
  ensureUserWorkspace: (
    database: DatabaseAdapter,
    userId: string,
    username: string,
    locale?: string | null,
  ) => Promise<unknown>;
  setSessionCookie: (context: AppContext, token: string, maxAge: number) => void;
};

const oidcErrorRedirect = (context: AppContext, redirectTo: string, code: string) => {
  const target = new URL(redirectTo, context.req.url);
  target.searchParams.set("oidc_error", code);
  return context.redirect(target.toString(), 302);
};

export const registerOidcRoutes = (app: Hono<AppEnv>, dependencies: OidcRouteDependencies) => {
  app.get("/api/v1/auth/oidc/config", (context) => context.json(oidcSessionHints(context.env)));

  app.get("/api/v1/auth/oidc/login", async (context) => {
    const config = resolveOidcRuntimeConfig(context.env);
    if (!config) {
      return apiError(context, "oidc_not_configured", "OIDC is not configured for this instance.", 503);
    }

    const redirectUri = resolveOidcRedirectUri(config, context.req.url);
    const requestedRedirect = context.req.query("redirect_to") ?? context.req.header("referer") ?? "/";
    const redirectTo = isSafeOidcRedirect(requestedRedirect, context.req.url) ? requestedRedirect : "/";
    const challenge = await createOidcLoginChallenge();
    await persistOidcLoginState(context.env.storage.db, {
      ...challenge,
      redirectTo,
      deviceId: context.req.query("deviceId") ?? null,
    });

    const discovery = await fetchOidcDiscovery(config.issuer);
    const authorizationUrl = buildAuthorizationUrl(discovery, config, challenge, redirectUri);
    return context.redirect(authorizationUrl, 302);
  });

  app.get("/api/v1/auth/oidc/callback", async (context) => {
    const config = resolveOidcRuntimeConfig(context.env);
    const fallbackRedirect = "/";
    if (!config) {
      return oidcErrorRedirect(context, fallbackRedirect, "oidc_not_configured");
    }

    const error = context.req.query("error");
    const state = context.req.query("state");
    const code = context.req.query("code");
    if (!state) {
      return oidcErrorRedirect(context, fallbackRedirect, "oidc_invalid_state");
    }

    const stored = await consumeOidcLoginState(context.env.storage.db, state);
    const redirectTo = stored?.redirectTo && isSafeOidcRedirect(stored.redirectTo, context.req.url)
      ? stored.redirectTo
      : fallbackRedirect;
    if (error) {
      return oidcErrorRedirect(context, redirectTo, error);
    }
    if (!stored || !code) {
      return oidcErrorRedirect(context, redirectTo, "oidc_invalid_state");
    }

    try {
      const redirectUri = resolveOidcRedirectUri(config, context.req.url);
      const discovery = await fetchOidcDiscovery(config.issuer);
      const payload = await exchangeOidcAuthorizationCode(discovery, config, {
        code,
        codeVerifier: stored.codeVerifier,
        redirectUri,
        nonce: stored.nonce,
      });
      const claims = claimsFromIdToken(payload, config);
      const user = await resolveOidcUser(context.env.storage.db, config, claims, {
        hashPassword,
        ensureUserWorkspace: (userId, username) =>
          dependencies.ensureUserWorkspace(
            context.env.storage.db,
            userId,
            username,
            context.req.header("accept-language"),
          ),
      });
      const session = await dependencies.createSession(context, user, stored.deviceId ?? undefined);
      dependencies.setSessionCookie(context, session.token, session.maxAge);
      const now = new Date().toISOString();
      await context.env.storage.db.batch([
        context.env.storage.db.prepare(
          `UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?`,
        ).bind(now, now, user.id),
      ]);
      await audit(
        context.env.storage.db,
        "user",
        user.id,
        "auth.oidc_login",
        "session",
        session.id,
        { username: user.username, issuer: claims.issuer },
      );
      return context.redirect(redirectTo, 302);
    } catch (cause) {
      const codeName = cause instanceof Error ? cause.message : "oidc_callback_failed";
      const known = [
        "oidc_email_not_allowed",
        "oidc_provisioning_disabled",
        "oidc_account_disabled",
        "oidc_user_create_failed",
      ];
      return oidcErrorRedirect(
        context,
        redirectTo,
        known.includes(codeName) ? codeName : "oidc_callback_failed",
      );
    }
  });
};
