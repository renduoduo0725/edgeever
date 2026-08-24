import type { Bindings } from "./api-context";

export type OidcRuntimeConfig = {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string | null;
  scopes: string;
  usernameClaim: string;
  autoProvision: boolean;
  allowedEmails: string[];
  allowedDomains: string[];
};

const parseList = (value: string | undefined) =>
  (value ?? "")
    .split(/[,\s]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

export const isPasswordLoginEnabled = (environment: Bindings) =>
  environment.EDGE_EVER_PASSWORD_LOGIN_ENABLED?.trim().toLowerCase() !== "false";

export const resolveOidcRuntimeConfig = (environment: Bindings): OidcRuntimeConfig | null => {
  const issuer = environment.EDGE_EVER_OIDC_ISSUER?.trim().replace(/\/+$/, "");
  const clientId = environment.EDGE_EVER_OIDC_CLIENT_ID?.trim();
  const clientSecret = environment.EDGE_EVER_OIDC_CLIENT_SECRET?.trim();
  if (!issuer || !clientId || !clientSecret) return null;

  return {
    issuer,
    clientId,
    clientSecret,
    redirectUri: environment.EDGE_EVER_OIDC_REDIRECT_URI?.trim() || null,
    scopes: environment.EDGE_EVER_OIDC_SCOPES?.trim() || "openid profile email",
    usernameClaim: environment.EDGE_EVER_OIDC_USERNAME_CLAIM?.trim() || "preferred_username",
    autoProvision: environment.EDGE_EVER_OIDC_AUTO_PROVISION?.trim().toLowerCase() === "true",
    allowedEmails: parseList(environment.EDGE_EVER_OIDC_ALLOWED_EMAILS),
    allowedDomains: parseList(environment.EDGE_EVER_OIDC_ALLOWED_DOMAINS),
  };
};

export const isOidcEnabled = (environment: Bindings) => resolveOidcRuntimeConfig(environment) !== null;

export const oidcSessionHints = (environment: Bindings) => ({
  oidcEnabled: isOidcEnabled(environment),
  passwordLoginEnabled: isPasswordLoginEnabled(environment),
});

export const hasOidcAllowlist = (config: OidcRuntimeConfig) =>
  config.allowedEmails.length > 0 || config.allowedDomains.length > 0;

export const isEmailAllowed = (config: OidcRuntimeConfig, email: string | null | undefined) => {
  if (!hasOidcAllowlist(config)) return true;

  const normalized = email?.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) return false;
  if (config.allowedEmails.includes(normalized)) return true;
  const domain = normalized.slice(normalized.indexOf("@") + 1);
  return config.allowedDomains.includes(domain);
};

export const sanitizeOidcUsername = (value: string) => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return normalized || "user";
};
