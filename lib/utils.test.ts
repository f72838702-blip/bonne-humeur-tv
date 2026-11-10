import { describe, expect, it } from "vitest";
import {
  cn,
  escapeHtml,
  formatDate,
  neutralizeCsvFormulaPrefix,
  readingTimeMinutes,
  slugify,
  truncateWords,
} from "@/lib/utils";

describe("slugify", () => {
  it("conserve les mots simples en minuscules", () => {
    expect(slugify("Actualité Conakry")).toBe("actualite-conakry");
  });

  it("remplace les accents par leurs lettres de base", () => {
    expect(slugify("Éducation Économie à ç")).toBe("education-economie-a-c");
  });

  it("supprime les caractères spéciaux et les espaces multiples", () => {
    expect(slugify("  Guinée : l'économie 2026 ! ")).toBe(
      "guinee-l-economie-2026"
    );
  });

  it("produit une chaîne vide pour une entrée sans caractères valides", () => {
    expect(slugify("???")).toBe("");
  });
});

describe("escapeHtml", () => {
  it("échappe les caractères HTML dangereux", () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;"
    );
  });

  it("n'altère pas le texte ordinaire", () => {
    expect(escapeHtml("Bonne Humeur Média")).toBe("Bonne Humeur Média");
  });
});

describe("formatDate", () => {
  it("formate une date ISO en français", () => {
    expect(formatDate("2026-10-31T12:00:00Z")).toMatch(/2026/);
  });
});

describe("truncateWords", () => {
  it("coupe au nombre de mots demandé avec ellipse", () => {
    const out = truncateWords("un deux trois quatre cinq", 3);
    expect(out.split(/\s+/).length).toBeLessThanOrEqual(4);
    expect(out).toContain("…");
  });

  it("ne coupe pas un texte plus court que la limite", () => {
    expect(truncateWords("un deux", 5)).toBe("un deux");
  });
});

describe("readingTimeMinutes", () => {
  it("estime le temps de lecture d'après le nombre de mots", () => {
    const words = "mot ".repeat(400).trim();
    expect(readingTimeMinutes(words)).toBeGreaterThanOrEqual(1);
  });

  it("retourne au minimum 1 minute pour un court texte", () => {
    expect(readingTimeMinutes("texte court")).toBe(1);
  });
});

describe("cn", () => {
  it("fusionne les classes conditionnelles", () => {
    expect(cn("a", false && "b", "c")).toBe("a c");
  });
});

describe("neutralizeCsvFormulaPrefix (audit M4)", () => {
  it("neutralise les préfixes de formule = + @ et tabulation par un espace", () => {
    expect(neutralizeCsvFormulaPrefix("=HYPERLINK(...)")).toBe(" =HYPERLINK(...)");
    expect(neutralizeCsvFormulaPrefix("+cmd|'/c'")).toBe(" +cmd|'/c'");
    expect(neutralizeCsvFormulaPrefix("@x")).toBe(" @x");
    expect(neutralizeCsvFormulaPrefix("\t=1")).toBe(" \t=1");
  });

  it("ne touche PAS aux valeurs saines (montants négatifs, texte)", () => {
    expect(neutralizeCsvFormulaPrefix("-5 000 GNF")).toBe("-5 000 GNF");
    expect(neutralizeCsvFormulaPrefix("Mariama Sy")).toBe("Mariama Sy");
    expect(neutralizeCsvFormulaPrefix("")).toBe("");
  });
});