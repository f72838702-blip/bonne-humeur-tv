/**
 * TOKENS — conversion du design publié en variables CSS.
 *
 * Rôle de sécurité central : la SEULE sortie de ce module est une liste
 * de déclarations `--bhtv-*` produite depuis une config VALIDÉE
 * (designConfigSchema). Aucune chaîne libre ne peut atteindre le
 * <style> : les couleurs traversent normalizeHex → triplets canal
 * (r g b), les polices/arrondis/ombres sont des énumérations fermées
 * mappées sur des valeurs fixes, les tailles sont des listes fermées.
 * Les libellés éditoriaux (titres, liens) ne passent PAS ici.
 */

import type { DesignConfig, ColorSet, ComponentsConfig, HeaderConfig } from "./schema";

/**
 * Mapping clé → variable CSS, PAR THÈME.
 *  - claire  : « l'encre sur papier » du thème clair (défauts = valeurs
 *              historiques du site).
 *  - sombre  : palette du thème nuit. NB : la ligne des bordures sombres
 *              suit automatiquement la couleur des surfaces (white/10)
 *              — la clé `line` sombre est donc ignorée (choix assumé).
 */
const COLOR_TOKENS = {
  light: {
    bg: "--bhtv-nt-50",
    surface: "--bhtv-surface",
    surfaceAlt: "--bhtv-nt-100",
    line: "--bhtv-nt-200",
    inkStrong: "--bhtv-nt-900",
    ink: "--bhtv-nt-600",
    inkMuted: "--bhtv-nt-500",
    inkFaint: "--bhtv-nt-400",
    brand: "--bhtv-guinea-red",
    accent: "--bhtv-guinea-yellow",
    positive: "--bhtv-guinea-green",
  },
  dark: {
    bg: "--bhtv-night-950",
    surface: "--bhtv-night-800",
    surfaceAlt: "--bhtv-night-900",
    line: null,
    inkStrong: "--bhtv-nt-100",
    ink: "--bhtv-nt-300",
    inkMuted: "--bhtv-nt-500",
    inkFaint: "--bhtv-nt-400",
    brand: "--bhtv-guinea-red",
    accent: "--bhtv-guinea-yellow",
    positive: "--bhtv-guinea-green",
  },
} as const;

/** Normalise #abc → #aabbcc puis convertit en triplet canaux « r g b ». */
export function normalizeHex(hex: string): string | null {
  let h = hex.replace(/^#/, "").toLowerCase();
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  if (!/^[0-9a-f]{6}$/.test(h)) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

const FONT_VARS: Record<string, string> = {
  inter: "var(--font-sans)",
  archivo: "var(--font-display)",
  dmSans: "var(--font-dm-sans)",
  lora: "var(--font-lora)",
  newsreader: "var(--font-newsreader)",
  oswald: "var(--font-oswald)",
};

/** Exporté pour les MINIATURES du Studio simplifié (rendu fidèle) —
 *  mêmes cartes, sources uniques partagées avec designToVars. */
export const FONT_VAR_FOR = FONT_VARS;

export const RADIUS_SETS: Record<NonNullable<ComponentsConfig["radius"]>, [string, string]> = {
  // [radius-xl, radius-2xl] — le 3xl suit à 1,5 × le 2xl (échelle relative) :
  sharp: ["0", "0"],
  small: ["0.25rem", "0.25rem"],
  standard: ["0.75rem", "1rem"],
  round: ["1.25rem", "1.75rem"],
};

export const SHADOW_SETS: Record<NonNullable<ComponentsConfig["shadows"]>, string> = {
  soft: "0 1px 2px rgb(0 0 0 / 0.05), 0 4px 12px -2px rgb(0 0 0 / 0.08)",
  strong:
    "0 10px 15px -3px rgb(0 0 0 / 0.12), 0 18px 32px -8px rgb(0 0 0 / 0.18)",
  none: "none",
};

export const SPACING_SETS: Record<NonNullable<ComponentsConfig["spacing"]>, string> = {
  compact: "1.25rem",
  standard: "1.5rem",
  airy: "2rem",
};

const HEADER_HEIGHTS: Record<NonNullable<HeaderConfig["height"]>, string> = {
  compact: "3.5rem",
  standard: "4rem",
  airy: "4.5rem",
};

/** Déclarations de variables d'un jeu de couleurs validé (null → rien). */
function colorDeclarations(set: ColorSet, mapping: Record<string, string | null>): string[] {
  const out: string[] = [];
  for (const [key, token] of Object.entries(mapping)) {
    if (token === null) continue;
    const hex = set[key as keyof ColorSet];
    if (hex !== null && hex !== undefined) {
      const triplet = normalizeHex(hex);
      if (triplet) out.push(`${token}: ${triplet};`);
    }
  }
  return out;
}

export type CssRules = {
  varsRoot: string[];
  varsDark: string[];
};

/**
 * Construit les règles CSS (variables uniquement) du design.
 * Entrée attendue : config valide (parseDesignConfig) — invalide = zéro.
 */
export function designToVars(config: DesignConfig): CssRules {
  const root: string[] = [];
  const dark: string[] = [];

  if (config.colors) {
    root.push(...colorDeclarations(config.colors.light, COLOR_TOKENS.light));
    dark.push(...colorDeclarations(config.colors.dark, COLOR_TOKENS.dark));
  }

  const t = config.typography;
  if (t) {
    const body = t.fontBody ? FONT_VARS[t.fontBody] : null;
    const display = t.fontTitles ? FONT_VARS[t.fontTitles] : null;
    if (body) root.push(`--bhtv-font-body: ${body};`);
    if (display) root.push(`--bhtv-font-display: ${display};`);
    if (t.baseSize) root.push(`--bhtv-base-size: ${t.baseSize};`);
    if (t.titleScale) root.push(`--bhtv-title-scale: ${t.titleScale};`);
    if (t.titleWeight) root.push(`--bhtv-title-weight: ${t.titleWeight};`);
    if (t.lineHeight) root.push(`--bhtv-leading: ${t.lineHeight};`);
    if (t.titleTracking) root.push(`--bhtv-title-tracking: ${t.titleTracking};`);
  }

  const c = config.components;
  if (c) {
    if (c.radius) {
      const [rx, r2] = RADIUS_SETS[c.radius];
      root.push(
        `--bhtv-radius-xl: ${rx};`,
        `--bhtv-radius-2xl: ${r2};`,
        `--bhtv-radius-3xl: calc(${r2} * 1.5);`
      );
    }
    if (c.shadows) {
      const s = SHADOW_SETS[c.shadows];
      root.push(
        `--bhtv-shadow-lg: ${s};`,
        `--bhtv-shadow-xl: ${s};`,
        // Le glow suit l'échelle choisie (signature directe) ; « none »
        // éteint aussi la signature lumineuse.
        `--bhtv-shadow-glow: ${c.shadows === "none" ? "none" : s};`
      );
    }
    if (c.spacing) {
      root.push(`--bhtv-spacing-section: ${SPACING_SETS[c.spacing]};`);
    }
  }

  const h = config.header;
  if (h) {
    if (h.height) root.push(`--bhtv-header-h: ${HEADER_HEIGHTS[h.height]};`);
  }

  return { varsRoot: root, varsDark: dark };
}

/**
 * Texte du <style> à injecter (server-renderé) — UNIQUEMENT des
 * déclarations de variables appartenant à la liste fermée au-dessus.
 */
export function cssDesignStyle(config: DesignConfig): string {
  const { varsRoot, varsDark } = designToVars(config);
  const chunks: string[] = [];
  if (varsRoot.length > 0) chunks.push(`:root{${varsRoot.join("")}}`);
  if (varsDark.length > 0) chunks.push(`.dark{${varsDark.join("")}}`);
  return chunks.join("\n");
}
