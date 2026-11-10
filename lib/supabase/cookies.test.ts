import { describe, expect, it } from "vitest";
import { hardenedCookieOptions, isLocalhostHost } from "./cookies";

/**
 * Tests du durcissement E1 (audit sécurité nov. 2026) : les cookies de
 * session Supabase ne sont JAMAIS lisibles côté JavaScript (httpOnly),
 * jamais envoyés hors HTTPS en production, même attributs sinon.
 */
describe("cookies durcis (audit E1)", () => {
  it("force httpOnly:true et sameSite:lax dans tous les cas", () => {
    expect(hardenedCookieOptions({})).toMatchObject({ httpOnly: true, sameSite: "lax" });
    expect(hardenedCookieOptions({ path: "/admin" })).toMatchObject({ httpOnly: true });
    expect(hardenedCookieOptions(undefined)).toMatchObject({ httpOnly: true });
  });

  it("exige Secure hors localhost (production), le relâche en dev local", () => {
    expect(hardenedCookieOptions({}, false)).toMatchObject({ secure: true });
    expect(hardenedCookieOptions({}, true)).toMatchObject({ secure: false });
  });

  it("conserve les attributs fournis (path, maxAge, chunks)", () => {
    expect(hardenedCookieOptions({ path: "/x", maxAge: 42 })).toMatchObject({
      path: "/x",
      maxAge: 42,
      httpOnly: true,
    });
  });

  it("detecte les hôtes locaux sans jamais bloquer la production", () => {
    expect(isLocalhostHost("localhost:3000")).toBe(true);
    expect(isLocalhostHost("127.0.0.1")).toBe(true);
    expect(isLocalhostHost("sub.localhost")).toBe(true);
    expect(isLocalhostHost("bonnehumeur.info")).toBe(false);
    expect(isLocalhostHost(null)).toBe(false);
    expect(isLocalhostHost("evil-localhost.com")).toBe(false);
  });
});
