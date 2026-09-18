import { sha256 } from "./hash-utils";

export const SHARE_ACCESS_COOKIE = "ee_share";
export const SHARE_ACCESS_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
export const SHARE_UNLOCK_MAX_ATTEMPTS = 8;
export const SHARE_UNLOCK_WINDOW_MS = 15 * 60 * 1000;

export type ShareUnlockState = {
  unlock_failed_count: number;
  unlock_window_started_at: string | null;
  unlock_blocked_until: string | null;
};

export const isShareUnlockBlocked = (blockedUntil: string | null, nowMs = Date.now()) =>
  Boolean(blockedUntil && Date.parse(blockedUntil) > nowMs);

export const nextShareUnlockFailure = (
  state: ShareUnlockState,
  nowMs = Date.now(),
): { failureCount: number; windowStartedAt: string; blockedUntil: string | null } => {
  const windowStart = state.unlock_window_started_at ? Date.parse(state.unlock_window_started_at) : Number.NaN;
  const inWindow = Number.isFinite(windowStart) && nowMs - windowStart < SHARE_UNLOCK_WINDOW_MS;
  const previousCount = Number(state.unlock_failed_count);
  const failureCount = inWindow ? (Number.isFinite(previousCount) ? previousCount : 0) + 1 : 1;
  return {
    failureCount,
    windowStartedAt: inWindow && state.unlock_window_started_at
      ? state.unlock_window_started_at
      : new Date(nowMs).toISOString(),
    blockedUntil: failureCount >= SHARE_UNLOCK_MAX_ATTEMPTS
      ? new Date(nowMs + SHARE_UNLOCK_WINDOW_MS).toISOString()
      : null,
  };
};

export const createShareAccessCookieValue = async (
  passwordHash: string,
  token: string,
  nowMs = Date.now(),
) => {
  const expiryMs = nowMs + SHARE_ACCESS_MAX_AGE_SECONDS * 1000;
  const mac = await sha256(shareAccessPayload(passwordHash, token, expiryMs));
  return `${expiryMs}.${mac}`;
};

export const isValidShareAccessCookieValue = async (
  value: string | undefined,
  passwordHash: string,
  token: string,
  nowMs = Date.now(),
) => {
  if (!value) return false;
  const separator = value.indexOf(".");
  if (separator <= 0) return false;
  const expiryMs = Number(value.slice(0, separator));
  const mac = value.slice(separator + 1);
  if (!Number.isFinite(expiryMs) || expiryMs <= nowMs || !mac) return false;
  const expected = await sha256(shareAccessPayload(passwordHash, token, expiryMs));
  return timingSafeEqualString(mac, expected);
};

const shareAccessPayload = (passwordHash: string, token: string, expiryMs: number) =>
  `${passwordHash}\n${token}\n${expiryMs}`;

const timingSafeEqualString = (left: string, right: string) => {
  const length = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    diff |= (left.charCodeAt(index % left.length) ?? 0) ^ (right.charCodeAt(index % right.length) ?? 0);
  }
  return diff === 0;
};
