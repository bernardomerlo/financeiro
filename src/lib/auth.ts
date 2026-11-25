export const AUTH_COOKIE_NAME = "cf_auth_20h";
export const AUTH_CACHE_KEY = "cf_auth_cache_20h";
export const TWENTY_HOURS_SECONDS = 20 * 60 * 60; // 72,000 seconds
export const TWENTY_HOURS_MS = TWENTY_HOURS_SECONDS * 1000; // 72,000,000 ms

const EXPECTED_PASSWORD = process.env.APP_PASSWORD || "Churrascanca1@";
const TOKEN_SALT = "cf_turso_2026_v1";

function computeSignature(expiresAt: number): string {
  // Deterministic lightweight hash suitable for Edge Runtime & Node
  const raw = `${expiresAt}:${EXPECTED_PASSWORD}:${TOKEN_SALT}`;
  let h1 = 0xdeadbeef ^ raw.length;
  let h2 = 0x41c6ce57 ^ raw.length;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
}

export function verifyPassword(input: string): boolean {
  return input === EXPECTED_PASSWORD;
}

export function createSessionToken(nowMs = Date.now()): {
  token: string;
  expiresAt: number;
} {
  const expiresAt = nowMs + TWENTY_HOURS_MS;
  const sig = computeSignature(expiresAt);
  return {
    token: `${expiresAt}.${sig}`,
    expiresAt,
  };
}

export function verifySessionToken(token: string | undefined | null, nowMs = Date.now()): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const expiresAt = Number(parts[0]);
  const sig = parts[1];
  if (isNaN(expiresAt) || nowMs >= expiresAt) {
    return false;
  }
  return sig === computeSignature(expiresAt);
}
