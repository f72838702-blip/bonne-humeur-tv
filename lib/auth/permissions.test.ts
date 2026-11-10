import { describe, expect, it } from "vitest";
import {
  PERMISSION_KEYS,
  effectivePermissions,
  hasAnyPermission,
  hasPermission,
  isFullyPrivileged,
  sanitizePermissions,
} from "./permissions";

/**
 * Noyau de permissions 0036 — tests du module PUR (aucune dépendance).
 * super_admin/admin = TOUT (sans case à cocher) ; editor = clés cochées ;
 * reporter = aucune. Les clés inconnues (navigateur) sont toujours écartées.
 */

describe("isFullyPrivileged", () => {
  it("super_admin et admin possèdent tout", () => {
    expect(isFullyPrivileged("super_admin")).toBe(true);
    expect(isFullyPrivileged("admin")).toBe(true);
  });

  it("editor / reporter / inconnu / null ne sont pas privilégiés", () => {
    expect(isFullyPrivileged("editor")).toBe(false);
    expect(isFullyPrivileged("reporter")).toBe(false);
    expect(isFullyPrivileged("hackeur")).toBe(false);
    expect(isFullyPrivileged(null)).toBe(false);
    expect(isFullyPrivileged(undefined)).toBe(false);
  });
});

describe("effectivePermissions", () => {
  it("super_admin et admin : TOUTES les clés, sans exception", () => {
    expect(effectivePermissions({ role: "super_admin", permissions: [] })).toEqual([
      ...PERMISSION_KEYS,
    ]);
    expect(effectivePermissions({ role: "admin", permissions: null })).toHaveLength(
      PERMISSION_KEYS.length
    );
    // Même si permissions[] contient des ordures : admin ignore les cases.
    expect(
      effectivePermissions({ role: "admin", permissions: ["inconnue"] })
    ).toHaveLength(PERMISSION_KEYS.length);
  });

  it("editor : uniquement les clés valides cochées", () => {
    expect(
      effectivePermissions({
        role: "editor",
        permissions: ["videos", "flash", "clé-fabriquée-par-le-navigateur"],
      })
    ).toEqual(["videos", "flash"]);
  });

  it("editor : permissions null = aucune", () => {
    expect(effectivePermissions({ role: "editor", permissions: null })).toEqual([]);
  });

  it("reporter et compte inconnu : aucune clé, jamais", () => {
    expect(effectivePermissions({ role: "reporter", permissions: ["videos"] })).toEqual([]);
    expect(effectivePermissions({ role: "hackeur", permissions: ["videos"] })).toEqual([]);
    expect(effectivePermissions(null)).toEqual([]);
    expect(effectivePermissions(undefined)).toEqual([]);
  });
});

describe("hasPermission / hasAnyPermission", () => {
  const editorVidoes: Parameters<typeof hasPermission>[0] = {
    role: "editor",
    permissions: ["videos", "consultation"],
  };

  it("clé cochée → oui ; clé non cochée → non", () => {
    expect(hasPermission(editorVidoes, "videos")).toBe(true);
    expect(hasPermission(editorVidoes, "flash")).toBe(false);
  });

  it("admin/super_admin : toute clé", () => {
    expect(hasPermission({ role: "admin", permissions: [] }, "publicite")).toBe(true);
    expect(hasPermission({ role: "super_admin" }, "directs")).toBe(true);
  });

  it("reporter : jamais", () => {
    expect(hasPermission({ role: "reporter" }, "articles")).toBe(false);
    expect(hasAnyPermission({ role: "reporter" }, ["articles_publier"])).toBe(false);
  });

  it("hasAnyPermission : au moins une des clés", () => {
    expect(hasAnyPermission(editorVidoes, ["flash", "videos"])).toBe(true);
    expect(hasAnyPermission(editorVidoes, ["flash", "publicite"])).toBe(false);
  });
});

describe("sanitizePermissions", () => {
  it("ne garde que les 9 clés autorisées", () => {
    expect(
      sanitizePermissions(["articles", "x", "videos", "__proto__", "ADMIN"])
    ).toEqual(["articles", "videos"]);
  });

  it("entrées non-tableau et valeurs non-chaîne rejetées", () => {
    expect(sanitizePermissions(null)).toEqual([]);
    expect(sanitizePermissions(undefined)).toEqual([]);
    // @ts-expect-error — comportement robuste face à des données hostiles
    expect(sanitizePermissions(["videos", 42, {}])).toEqual(["videos"]);
  });
});
