import { describe, it, expect } from "vitest";
import {
  parseDesignConfig,
  designConfigSchema,
  FONT_OPTIONS,
} from "./schema";
import { normalizeHex, cssDesignStyle, designToVars } from "./tokens";
import { DEFAULT_DESIGN } from "./default";
import { THEME_PRESETS } from "./themes";

/** Toutes les déclarations émises doivent être des variables --bhtv-*. */
function declaredVariables(style: string): string[] {
  return style.match(/--[\w-]+\s*:/g)?.map((m) => m.replace(/\s*:$/, "")) ?? [];
}

describe("Studio de design — schéma fermé (sécurité)", () => {
  it("D1 — hexadécimal court ou long accepté", () => {
    expect(parseDesignConfig({
      ...DEFAULT_DESIGN,
      colors: {
        ...DEFAULT_DESIGN.colors,
        light: { ...DEFAULT_DESIGN.colors.light, brand: "#ce1" },
      },
    })?.colors.light.brand).toBe("#ce1");
    expect(parseDesignConfig({
      ...DEFAULT_DESIGN,
      colors: {
        ...DEFAULT_DESIGN.colors,
        light: { ...DEFAULT_DESIGN.colors.light, brand: "#0FA943" },
      },
    })?.colors.light.brand).toBe("#0FA943");
  });

  it("D2 — AUCUNE injection de couleur acceptée (css/arbitraire)", () => {
    for (const attempt of [
      'red"; background:url(https://evil)',
      "javascript:alert(1)",
      "transparent",
      "#GGGGGG",
      "rgb(0,0,0)",
      "url(https://evil)",
    ]) {
      const cfg = {
        ...DEFAULT_DESIGN,
        colors: {
          ...DEFAULT_DESIGN.colors,
          light: { ...DEFAULT_DESIGN.colors.light, brand: attempt },
        },
      };
      expect(designConfigSchema.safeParse(cfg).success).toBe(false);
    }
  });

  it("D3 — police hors liste fermée refusée", () => {
    const cfg = {
      ...DEFAULT_DESIGN,
      typography: { ...DEFAULT_DESIGN.typography, fontTitles: "comic-sans" },
    };
    expect(designConfigSchema.safeParse(cfg).success).toBe(false);
    expect(FONT_OPTIONS).not.toContain("comic-sans");
  });

  it("D4 — palier hors liste (titleScale 9.9) refusé", () => {
    const cfg = {
      ...DEFAULT_DESIGN,
      typography: { ...DEFAULT_DESIGN.typography, titleScale: "9.9" },
    } as unknown as Parameters<typeof designConfigSchema.safeParse>[0];
    expect(designConfigSchema.safeParse(cfg).success).toBe(false);
  });

  it("D5 — section d'accueil en doublon refusée", () => {
    const cfg = {
      ...DEFAULT_DESIGN,
      home: {
        ...DEFAULT_DESIGN.home,
        sections: [
          ...DEFAULT_DESIGN.home.sections,
          { id: "hero", visible: true, title: null, subtitle: null, columns: null },
        ],
      },
    };
    expect(designConfigSchema.safeParse(cfg).success).toBe(false);
  });

  it("D6 — lien de pied de page non interne/https refusé (anti-injection d'URL)", () => {
    const bad = {
      ...DEFAULT_DESIGN,
      footer: {
        ...DEFAULT_DESIGN.footer,
        links: [{ label: "x", href: "javascript:void(0)" }],
      },
    };
    expect(designConfigSchema.safeParse(bad).success).toBe(false);
    const http = {
      ...DEFAULT_DESIGN,
      footer: {
        ...DEFAULT_DESIGN.footer,
        links: [{ label: "x", href: "http://evil.example" }],
      },
    };
    expect(designConfigSchema.safeParse(http).success).toBe(false);
    const ok = {
      ...DEFAULT_DESIGN,
      footer: {
        ...DEFAULT_DESIGN.footer,
        links: [{ label: "x", href: "/actualites" }],
      },
    };
    expect(designConfigSchema.safeParse(ok).success).toBe(true);
  });

  it("D7 — titre de section trop long refusé (texte pur, borné)", () => {
    const long = "x".repeat(500);
    const cfg = {
      ...DEFAULT_DESIGN,
      home: {
        ...DEFAULT_DESIGN.home,
        sections: DEFAULT_DESIGN.home.sections.map((s) => ({ ...s, title: long })),
      },
    };
    expect(parseDesignConfig(cfg)).toBeNull();
  });

  it("D8 — version de schéma autre que 1 refusée", () => {
    const cfg = { ...DEFAULT_DESIGN, schemaVersion: 2 };
    expect(designConfigSchema.safeParse(cfg).success).toBe(false);
  });
});

describe("Studio de design — tokens CSS (aucune chaîne libre)", () => {
  it("D9 — normalizeHex : 3 chiffres étendus, refus des autres formats", () => {
    expect(normalizeHex("#abc")).toBe("170 187 204");
    expect(normalizeHex("#AABBCC")).toBe("170 187 204");
    expect(normalizeHex("#GGHHII")).toBeNull();
    expect(normalizeHex("#aabbccdd")).toBeNull(); // 8 chiffres refusés
    expect(normalizeHex("red")).toBeNull();
  });

  it("D10 — le style émis ne contient QUE des variables --bhtv-* (aucune balise, aucune chaîne libre)", () => {
    const hostile: Parameters<typeof cssDesignStyle>[0] = {
      ...DEFAULT_DESIGN,
      colors: {
        light: {
          bg: "#ce1126", surface: "#fff", surfaceAlt: "#eee", line: "#ddd",
          inkStrong: "#111", ink: "#333", inkMuted: "#555", inkFaint: "#777",
          brand: "#ce1126", accent: "#fcd116", positive: "#009a44",
        },
        dark: DEFAULT_DESIGN.colors.dark,
      },
      typography: {
        ...DEFAULT_DESIGN.typography,
        fontBody: "oswald",
        fontTitles: "oswald",
        baseSize: "18px",
        titleScale: "1.2",
        titleWeight: "900",
        lineHeight: "1.75",
        titleTracking: "0.01em",
      },
      components: { radius: "round", shadows: "strong", spacing: "airy" },
      header: { height: "airy", style: "glass", behavior: "compact", logoScale: "large" },
    };
    const style = cssDesignStyle(hostile);
    // Chaque déclaration est une variable de la liste blanche.
    for (const varName of declaredVariables(style)) {
      expect(varName.startsWith("--bhtv-")).toBe(true);
    }
    expect(style).toContain("--bhtv-font-display: var(--font-oswald);");
    expect(style).toContain("--bhtv-radius-2xl: 1.75rem;");
    expect(style).toContain("--bhtv-base-size: 18px;");
    // Aucun caractère permettant d'échapper au contexte style.
    expect(/[<>{}@]|javascript:|url\(|expression|behavior/i.test(style.replace(/:root\{|\{|\}/g, ""))).toBe(false);
  });

  it("D11 — thème défaut (tout null) : aucune variable émise, socle intact", () => {
    const parsed = parseDesignConfig(DEFAULT_DESIGN);
    expect(parsed).not.toBeNull();
    if (!parsed) return;
    expect(designToVars(parsed)).toEqual({ varsRoot: [], varsDark: [] });
    expect(cssDesignStyle(parsed)).toBe("");
  });
});

describe("Studio de design — thèmes prédéfinis", () => {
  it("D12 — les 5 thèmes sont tous valides au schéma", () => {
    expect(THEME_PRESETS.length).toBe(5);
    for (const preset of THEME_PRESETS) {
      expect(parseDesignConfig(preset.config)).not.toBeNull();
    }
  });

  it("D13 — thème signature : les couleurs drapeau conservées", () => {
    const signature = THEME_PRESETS.find((t) => t.id === "signature");
    expect(signature).toBeDefined();
    const parsed = parseDesignConfig(THEME_PRESETS[0].config);
    expect(parsed?.colors.light.brand).toBe("#CE1126");
    expect(parsed?.colors.light.accent).toBe("#FCD116");
    expect(parsed?.colors.light.positive).toBe("#009A44");
  });

  it("D14 — défaut : sections visibles = ordre actuel exact du site", () => {
    const parsed = parseDesignConfig(DEFAULT_DESIGN);
    if (!parsed) throw new Error("défaut invalide");
    expect(parsed.home.sections.filter((s) => s.visible).map((s) => s.id)).toEqual(
      ["hero", "featured", "videos", "b2b", "partners"],
    );
  });

  it("D15 — chaque thème comporte exactement les 6 sections, chacune une fois", () => {
    for (const preset of THEME_PRESETS) {
      const parsed = parseDesignConfig(preset.config);
      expect(parsed?.home.sections.length).toBe(6);
      expect(new Set(parsed?.home.sections.map((s) => s.id)).size).toBe(6);
    }
  });
});

describe("Studio de design — mode d'apparence (simplification)", () => {
  it("D16 — mode clair/sombre acceptés, valeur hors liste refusée", () => {
    expect(parseDesignConfig({ ...DEFAULT_DESIGN, mode: "light" })?.mode).toBe("light");
    expect(parseDesignConfig({ ...DEFAULT_DESIGN, mode: "dark" })?.mode).toBe("dark");
    expect(parseDesignConfig({ ...DEFAULT_DESIGN, mode: "system" })?.mode).toBeNull();
    expect(parseDesignConfig({ ...DEFAULT_DESIGN, mode: 1 })?.mode).toBeNull();
  });

  it("D17 — config antérieure SANS mode : toujours valide, mode retombe à null (zéro rupture, sans migration)", () => {
    const legacy = { ...DEFAULT_DESIGN } as Record<string, unknown>;
    delete legacy.mode; // brouillon d'avant l'ajout du champ
    const parsed = parseDesignConfig(legacy);
    expect(parsed).not.toBeNull();
    expect(parsed?.mode).toBeNull();
  });

  it("D18 — mode null = apparence historique (site nuit d'abord) : aucune variable émise", () => {
    const parsed = parseDesignConfig({ ...DEFAULT_DESIGN, mode: "light" });
    expect(parsed?.mode).toBe("light");
    // Le mode ne change RIEN au <style> : c'est un comportement de boot.
    const parsedNull = parseDesignConfig(DEFAULT_DESIGN);
    if (!parsed || !parsedNull) throw new Error("invalide");
    expect(cssDesignStyle(parsed)).toBe(cssDesignStyle(parsedNull));
  });
});
