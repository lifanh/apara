import { afterEach, describe, expect, it } from "vitest";
import { checkAuth, createAuthCookie, isAuthEnabled } from "../server/auth.js";

describe("auth", () => {
  const originalEnv = process.env.APARA_AUTH_TOKEN;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.APARA_AUTH_TOKEN;
    } else {
      process.env.APARA_AUTH_TOKEN = originalEnv;
    }
  });

  describe("isAuthEnabled", () => {
    it("returns false when APARA_AUTH_TOKEN is not set", () => {
      delete process.env.APARA_AUTH_TOKEN;
      expect(isAuthEnabled()).toBe(false);
    });

    it("returns true when APARA_AUTH_TOKEN is set", () => {
      process.env.APARA_AUTH_TOKEN = "secret123";
      expect(isAuthEnabled()).toBe(true);
    });
  });

  describe("checkAuth", () => {
    it("returns true when auth is disabled", () => {
      delete process.env.APARA_AUTH_TOKEN;
      expect(checkAuth("")).toBe(true);
    });

    it("returns true when cookie matches token", () => {
      process.env.APARA_AUTH_TOKEN = "secret123";
      expect(checkAuth("apara_token=secret123")).toBe(true);
    });

    it("returns false when cookie does not match", () => {
      process.env.APARA_AUTH_TOKEN = "secret123";
      expect(checkAuth("apara_token=wrong")).toBe(false);
    });

    it("returns false when cookie is missing", () => {
      process.env.APARA_AUTH_TOKEN = "secret123";
      expect(checkAuth("")).toBe(false);
    });

    it("returns false when cookie header is undefined", () => {
      process.env.APARA_AUTH_TOKEN = "secret123";
      expect(checkAuth(undefined)).toBe(false);
    });
  });

  describe("createAuthCookie", () => {
    it("creates a cookie with HttpOnly and SameSite=Strict", () => {
      const cookie = createAuthCookie("secret123", false);
      expect(cookie).toContain("apara_token=secret123");
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("SameSite=Strict");
      expect(cookie).not.toContain("Secure");
    });

    it("includes Secure flag when useSecure is true", () => {
      const cookie = createAuthCookie("secret123", true);
      expect(cookie).toContain("Secure");
    });
  });
});
