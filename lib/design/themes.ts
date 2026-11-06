import type { DesignConfig } from "./schema";
import { DEFAULT_DESIGN } from "./default";

/**
 * LES 5 THÈMES PRÉDÉFINIS du Studio de design (direction §4).
 * Chaque thème = une pile complète de réglages ; l'administrateur peut
 * ensuite l'affiner clé par clé (un thème n'est jamais un verrou).
 * « signature » est proposé comme thème initial (identité drapeau
 * modernisée : rouge/jaune/vert affirmés, fonds nuit encre).
 */

const HUE = (light: DesignConfig["colors"]["light"], dark: DesignConfig["colors"]["dark"]) => ({
  light,
  dark,
});

const section = (
  id: DesignConfig["home"]["sections"][number]["id"],
  visible = true,
) => ({ id, visible, title: null, subtitle: null, columns: null });

const homeSections = (
  overrides: Partial<Record<DesignConfig["home"]["sections"][number]["id"], boolean>> = {},
) =>
  ["hero", "featured", "categories", "videos", "b2b", "partners"].map(
    (id) => section(id as never, overrides[id as never] ?? (id !== "categories")),
  );

/* ─── 1. Premium Média — élégant, professionnel, éditorial ───────────── */
export const THEME_PREMIUM_MEDIA: DesignConfig = {
  schemaVersion: 1,
  mode: null,
  colors: HUE(
    {
      bg: "#fafaf7",
      surface: "#ffffff",
      surfaceAlt: "#f1f0ea",
      line: "#e4e2d8",
      inkStrong: "#191919",
      ink: "#444444",
      inkMuted: "#6f6f6f",
      inkFaint: "#9a9a94",
      brand: "#a31226", // rouge profond de salle de rédaction
      accent: "#b98a00",
      positive: "#0b7a37",
    },
    {
      bg: null, // nuit du socle
      surface: null,
      surfaceAlt: null,
      line: null,
      inkStrong: null,
      ink: null,
      inkMuted: null,
      inkFaint: null,
      brand: null,
      accent: null,
      positive: null,
    },
  ),
  typography: {
    fontBody: "inter",
    fontTitles: "newsreader",
    baseSize: null,
    titleScale: "1",
    titleWeight: "700",
    lineHeight: "1.6",
    titleTracking: "-0.01em",
  },
  components: {
    radius: "small",
    shadows: "soft",
    spacing: "standard",
  },
  header: {
    height: "standard",
    style: "glass",
    behavior: "sticky",
    logoScale: "standard",
  },
  home: { sections: homeSections(), featuredCategorySlugs: [] },
  footer: { style: "classic", showNavigation: true, showContact: true },
};

/* ─── 2. Modern TV — dynamique, visuel, orienté vidéo ─────────────────── */
export const THEME_MODERN_TV: DesignConfig = {
  schemaVersion: 1,
  mode: null,
  colors: HUE(
    {
      bg: "#f4f4f6",
      surface: "#ffffff",
      surfaceAlt: "#ececf2",
      line: "#dcdce4",
      inkStrong: "#101018",
      ink: "#3d3d4a",
      inkMuted: "#6a6a78",
      inkFaint: "#9898a6",
      brand: "#CE1126",
      accent: "#FCD116",
      positive: "#009A44",
    },
    {
      bg: "#08080d",
      surface: "#14141d",
      surfaceAlt: "#0e0e16",
      line: null,
      inkStrong: "#f5f5f7",
      ink: "#c9c9d4",
      inkMuted: "#8f8f9e",
      inkFaint: "#62626f",
      brand: "#e22940",
      accent: null,
      positive: null,
    },
  ),
  typography: {
    fontBody: "inter",
    fontTitles: "oswald",
    baseSize: null,
    titleScale: "1.1",
    titleWeight: "800",
    lineHeight: "1.5",
    titleTracking: "-0.01em",
  },
  components: {
    radius: "standard",
    shadows: "strong",
    spacing: "standard",
  },
  header: {
    height: "compact",
    style: "glass",
    behavior: "sticky",
    logoScale: "standard",
  },
  home: { sections: homeSections(), featuredCategorySlugs: [] },
  footer: { style: "classic", showNavigation: true, showContact: true },
};

/* ─── 3. Magazine — grandes images, typographie expressive ────────────── */
export const THEME_MAGAZINE: DesignConfig = {
  schemaVersion: 1,
  mode: null,
  colors: HUE(
    {
      bg: "#f7f5f1",
      surface: "#fffefb",
      surfaceAlt: "#efece4",
      line: "#e0dccf",
      inkStrong: "#1d1a15",
      ink: "#494539",
      inkMuted: "#77726a",
      inkFaint: "#a49e93",
      brand: "#c23e17",
      accent: "#8a6d1f",
      positive: "#2e6b3a",
    },
    {
      bg: null,
      surface: null,
      surfaceAlt: null,
      line: null,
      inkStrong: null,
      ink: null,
      inkMuted: null,
      inkFaint: null,
      brand: null,
      accent: null,
      positive: null,
    },
  ),
  typography: {
    fontBody: "dmSans",
    fontTitles: "lora",
    baseSize: "17px",
    titleScale: "1.1",
    titleWeight: "800",
    lineHeight: "1.75",
    titleTracking: "-0.02em",
  },
  components: {
    radius: "small",
    shadows: "soft",
    spacing: "airy",
  },
  header: {
    height: "airy",
    style: "glass",
    behavior: "sticky",
    logoScale: "large",
  },
  home: { sections: homeSections(), featuredCategorySlugs: [] },
  footer: { style: "columns2", showNavigation: true, showContact: true },
};

/* ─── 4. Minimaliste — épuré, lisible, très moderne ───────────────────── */
export const THEME_MINIMAL: DesignConfig = {
  schemaVersion: 1,
  mode: null,
  colors: HUE(
    {
      bg: "#fdfdfd",
      surface: "#ffffff",
      surfaceAlt: "#f4f4f4",
      line: "#e8e8e8",
      inkStrong: "#111111",
      ink: "#4a4a4a",
      inkMuted: "#767676",
      inkFaint: "#a6a6a6",
      brand: "#111111",
      accent: "#009A44",
      positive: "#009A44",
    },
    {
      bg: null,
      surface: null,
      surfaceAlt: null,
      line: null,
      inkStrong: "#ffffff",
      ink: "#cccccc",
      inkMuted: null,
      inkFaint: null,
      brand: "#ffffff",
      accent: null,
      positive: null,
    },
  ),
  typography: {
    fontBody: "inter",
    fontTitles: "inter",
    baseSize: null,
    titleScale: "0.9",
    titleWeight: "700",
    lineHeight: "1.6",
    titleTracking: "-0.01em",
  },
  components: {
    radius: "small",
    shadows: "none",
    spacing: "airy",
  },
  header: {
    height: "standard",
    style: "flat",
    behavior: "sticky",
    logoScale: "standard",
  },
  home: { sections: homeSections(), featuredCategorySlugs: [] },
  footer: { style: "centered", showNavigation: true, showContact: true },
};

/* ─── 5. Bonne Humeur Signature — rouge, jaune, vert, moderne ─────────── */
export const THEME_SIGNATURE: DesignConfig = {
  ...DEFAULT_DESIGN,
  colors: {
    light: {
      bg: "#fbfaf8",
      surface: null, // blanc (tokens)
      surfaceAlt: "#f5f3ef",
      line: "#e7e4de",
      inkStrong: "#17171F",
      ink: "#3f3f4a",
      inkMuted: "#6c6c78",
      inkFaint: "#9a9aa4",
      brand: "#CE1126",
      accent: "#FCD116",
      positive: "#009A44",
    },
    dark: {
      bg: null,
      surface: null,
      surfaceAlt: null,
      line: null,
      inkStrong: null,
      ink: null,
      inkMuted: null,
      inkFaint: null,
      brand: null,
      accent: null,
      positive: null,
    },
  },
  typography: {
    fontBody: null, // Inter
    fontTitles: null, // Archivo
    baseSize: null,
    titleScale: "1",
    titleWeight: "800",
    lineHeight: "1.6",
    titleTracking: "-0.01em",
  },
  components: { radius: "standard", shadows: "soft", spacing: "standard" },
  header: {
    height: "standard",
    style: "glass",
    behavior: "sticky",
    logoScale: "standard",
  },
  home: { sections: homeSections(), featuredCategorySlugs: [] },
  footer: { style: "classic", showNavigation: true, showContact: true },
};

export const THEME_PRESETS = [
  {
    id: "signature",
    name: "Bonne Humeur Signature",
    description: "Identité rouge, jaune et verte — moderne et distinctive.",
    config: THEME_SIGNATURE,
  },
  {
    id: "premium",
    name: "Premium Média",
    description: "Élégant, professionnel, éditorial — rouge profond, serif.",
    config: THEME_PREMIUM_MEDIA,
  },
  {
    id: "modernTv",
    name: "Modern TV",
    description: "Dynamique, visuel, orienté vidéo — titres massifs.",
    config: THEME_MODERN_TV,
  },
  {
    id: "magazine",
    name: "Magazine",
    description: "Grandes images, typographie expressive, marges généreuses.",
    config: THEME_MAGAZINE,
  },
  {
    id: "minimal",
    name: "Minimaliste",
    description: "Épuré, lisible, très moderne — encre et papier.",
    config: THEME_MINIMAL,
  },
] as const;
