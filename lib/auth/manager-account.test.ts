import { describe, expect, it } from "vitest";
import {
  MANAGER_LOGIN_DOMAIN,
  identifiantToEmail,
  isTechnicalManagerEmail,
  looksLikeEmail,
  normalizeIdentifiant,
  validateIdentifiant,
  generateProvisionalPassword,
} from "./manager-account";

describe("validateIdentifiant", () => {
  it("accepte un identifiant simple et le renvoie normalisé", () => {
    expect(validateIdentifiant("fatou.balde")).toEqual({
      ok: true,
      identifiant: "fatou.balde",
    });
  });

  it("normalise majuscules et espaces embarqués", () => {
    expect(validateIdentifiant(" Fatou  Balde ")).toEqual({
      ok: true,
      identifiant: "fatoubalde",
    });
  });

  it("refuse une saisie vide", () => {
    expect(validateIdentifiant("   ")).toEqual({ ok: false, reason: "vide" });
  });

  it("refuse plus de 32 caractères", () => {
    expect(validateIdentifiant("a".repeat(33))).toEqual({
      ok: false,
      reason: "trop_long",
    });
  });

  it("accepte exactement 32 caractères", () => {
    expect(validateIdentifiant("a".repeat(32)).ok).toBe(true);
  });

  it("refuse les caractères hors liste (accents, chiffres… tolérés : lettres/chiffres/._-)", () => {
    expect(validateIdentifiant("fatou!balde")).toEqual({
      ok: false,
      reason: "caracteres",
    });
    expect(validateIdentifiant("fatouébalde")).toEqual({
      ok: false,
      reason: "caracteres",
    });
    expect(validateIdentifiant("fatou balde@x")).toEqual({
      ok: false,
      reason: "caracteres",
    });
  });

  it("refuse un séparateur en bordure (cas « bornes », message dédié)", () => {
    expect(validateIdentifiant(".balde")).toEqual({ ok: false, reason: "bornes" });
    expect(validateIdentifiant("balde.")).toEqual({ ok: false, reason: "bornes" });
    expect(validateIdentifiant("-balde")).toEqual({ ok: false, reason: "bornes" });
    expect(validateIdentifiant("balde_")).toEqual({ ok: false, reason: "bornes" });
  });

  it("refuse un identifiant d'un seul caractère", () => {
    expect(validateIdentifiant("a")).toEqual({ ok: false, reason: "bornes" });
  });
});

describe("identifiantToEmail", () => {
  it("génère l'adresse technique stable côté serveur", () => {
    expect(identifiantToEmail("Fatou.Balde")).toBe(
      `fatou.balde@${MANAGER_LOGIN_DOMAIN}`
    );
  });

  it("produit la même adresse que la connexion reconstruirait (aller simple déterministe)", () => {
    const email = identifiantToEmail("mariama_d");
    expect(email).toBe(`mariama_d@gestion.bonnehumeur.info`);
  });
});

describe("looksLikeEmail", () => {
  it("distingue un email d'un identifiant", () => {
    expect(looksLikeEmail("ismael@bonnehumeur.info")).toBe(true);
    expect(looksLikeEmail("ismael.toure")).toBe(false);
    expect(looksLikeEmail("")).toBe(false);
  });
});

describe("isTechnicalManagerEmail", () => {
  it("reconnaît le domaine technique (insensible à la casse)", () => {
    expect(isTechnicalManagerEmail("A.B@gestion.bonnehumeur.info")).toBe(true);
    expect(isTechnicalManagerEmail("a.b@GESTION.bonnehumeur.INFO")).toBe(true);
  });

  it("laisse passer les emails réels, historiques inclus", () => {
    expect(isTechnicalManagerEmail("bonnehumeur877@gmail.com")).toBe(false);
    expect(isTechnicalManagerEmail("contact@bonnehumeur.info")).toBe(false);
    expect(isTechnicalManagerEmail(null)).toBe(false);
    expect(isTechnicalManagerEmail(undefined)).toBe(false);
  });

  it("jamais de faux positif par sous-chaîne (préfixe du domaine)", () => {
    expect(isTechnicalManagerEmail("x@gestion.bonnehumeur.info.evil.com")).toBe(false);
  });
});

describe("normalizeIdentifiant", () => {
  it("retire les espaces et met en minuscules", () => {
    expect(normalizeIdentifiant("  Ibrahima  Toure ")).toBe("ibrahimatoure");
  });
});

describe("generateProvisionalPassword", () => {
  const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const LOWER = "abcdefghijkmnpqrstuvwxyz";
  const DIGIT = "23456789";
  const SYMBOL = "!@#$%*+?";

  it("produit 12 caractères", () => {
    expect(generateProvisionalPassword()).toHaveLength(12);
  });

  it("garantit au moins une majuscule, une minuscule, un chiffre et un signe", () => {
    for (let i = 0; i < 200; i += 1) {
      const pw = generateProvisionalPassword();
      expect(pw.split("").some((c) => UPPER.includes(c))).toBe(true);
      expect(pw.split("").some((c) => LOWER.includes(c))).toBe(true);
      expect(pw.split("").some((c) => DIGIT.includes(c))).toBe(true);
      expect(pw.split("").some((c) => SYMBOL.includes(c))).toBe(true);
    }
  });

  it("ne contient aucun caractère ambigu (0 O 1 l I)", () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generateProvisionalPassword()).not.toMatch(/[0O1lI]/);
    }
  });

  it("n'utilise que la liste blanche de caractères", () => {
    const allowed = new Set((UPPER + LOWER + DIGIT + SYMBOL).split(""));
    for (let i = 0; i < 200; i += 1) {
      for (const ch of generateProvisionalPassword()) {
        expect(allowed.has(ch)).toBe(true);
      }
    }
  });
});
