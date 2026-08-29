import { createHmac, timingSafeEqual } from "node:crypto";
import type { VercelRequest } from "@vercel/node";

export const ADMIN_COOKIE = "fco_admin_session";
export const ADMIN_SESSION_SECONDS = 8 * 60 * 60;

function digest(value: string) {
  return createHmac("sha256", "fco-admin-password-check").update(value).digest();
}

export function passwordsMatch(candidate: string, expected: string) {
  return timingSafeEqual(digest(candidate), digest(expected));
}

function signature(expiresAt: string, secret: string) {
  return createHmac("sha256", secret).update(`v1.${expiresAt}`).digest("base64url");
}

export function createAdminSession(secret: string) {
  const expiresAt = String(Date.now() + ADMIN_SESSION_SECONDS * 1_000);
  return `${expiresAt}.${signature(expiresAt, secret)}`;
}

function readCookie(req: VercelRequest, name: string) {
  const cookieHeader = req.headers.cookie || "";
  for (const pair of cookieHeader.split(";")) {
    const separator = pair.indexOf("=");
    if (separator === -1) continue;
    const key = pair.slice(0, separator).trim();
    if (key === name) return decodeURIComponent(pair.slice(separator + 1).trim());
  }
  return undefined;
}

export function hasValidAdminSession(req: VercelRequest, secret: string) {
  const value = readCookie(req, ADMIN_COOKIE);
  if (!value) return false;
  const [expiresAt, providedSignature] = value.split(".");
  if (!expiresAt || !providedSignature || Number(expiresAt) <= Date.now()) return false;
  const expectedSignature = signature(expiresAt, secret);
  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export function adminCookie(value: string, maxAge = ADMIN_SESSION_SECONDS) {
  return `${ADMIN_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

