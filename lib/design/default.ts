import type { DesignConfig } from "./schema";

/**
 * DESIGN PAR DÉFAUT — identique à « aucun réglage » : le socle
 * (globals.css) porte les valeurs historiques. Publié dans la table
 * site_design si l'administrateur n'a jamais publié ; sert aussi de
 * repli si la table est absente (le site ne casse jamais).
 */
export const DEFAULT_DESIGN: DesignConfig = {
  schemaVersion: 1,
  /** null = apparence historique (site nuit d'abord — socle inchangé). */
  mode: null,
  colors: {
    light: {
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
    fontBody: null,
    fontTitles: null,
    baseSize: null,
    titleScale: null,
    titleWeight: null,
    lineHeight: null,
    titleTracking: null,
  },
  components: {
    radius: null,
    shadows: null,
    spacing: null,
  },
  header: {
    height: null,
    style: null,
    behavior: null,
    logoScale: null,
  },
  home: {
    sections: [
      { id: "hero", visible: true, title: null, subtitle: null, columns: null },
      { id: "featured", visible: true, title: null, subtitle: null, columns: null },
      { id: "categories", visible: false, title: null, subtitle: null, columns: null },
      { id: "videos", visible: true, title: null, subtitle: null, columns: null },
      { id: "b2b", visible: true, title: null, subtitle: null, columns: null },
      { id: "partners", visible: true, title: null, subtitle: null, columns: null },
    ],
    featuredCategorySlugs: [],
  },
  footer: {
    style: null,
    showNavigation: true,
    showContact: true,
    links: undefined,
  },
};
