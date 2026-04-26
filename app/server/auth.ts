import { timingSafeEqual } from "crypto";

const COOKIE_NAME = "apara_token";

export function isAuthEnabled(): boolean {
  return (
    typeof process.env.APARA_AUTH_TOKEN === "string" &&
    process.env.APARA_AUTH_TOKEN.length > 0
  );
}

export function checkAuth(cookieHeader: string | undefined): boolean {
  if (!isAuthEnabled()) {
    return true;
  }

  if (!cookieHeader) {
    return false;
  }

  const token = parseCookie(cookieHeader, COOKIE_NAME);
  const expected = process.env.APARA_AUTH_TOKEN!;
  if (!token || token.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

export function createAuthCookie(token: string, useSecure: boolean, crossOrigin = false): string {
  const sameSite = crossOrigin ? "None" : "Strict";
  const secure = useSecure || crossOrigin;
  let cookie = `${COOKIE_NAME}=${token}; HttpOnly; SameSite=${sameSite}; Path=/; Max-Age=604800`;
  if (secure) {
    cookie += "; Secure";
  }
  return cookie;
}

export function validateOrigin(
  origin: string | null,
  expectedHost: string
): boolean {
  if (!origin) {
    return false;
  }

  try {
    return new URL(origin).host === expectedHost;
  } catch {
    return false;
  }
}

function parseCookie(header: string, name: string): string | null {
  const prefix = `${name}=`;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return trimmed.slice(prefix.length);
    }
  }
  return null;
}
