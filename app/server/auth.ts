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

  return parseCookie(cookieHeader, COOKIE_NAME) === process.env.APARA_AUTH_TOKEN;
}

export function createAuthCookie(token: string, useSecure: boolean): string {
  let cookie = `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/`;
  if (useSecure) {
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
