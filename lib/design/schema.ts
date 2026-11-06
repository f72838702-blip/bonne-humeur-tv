import { z } from "zod";

/**
 * SCHÉMA DU DESIGN — liste blanche fermée (directive Studio §5).
 * Toute valeur transmise par l'interface est validée ICI à nouveau CÔTÉ
 * SERVEUR avant enregistrement du brouillon et avant publication.
 * Aucun CSS, HTML ou JavaScript libre : uniquement des hexadécimaux
 * normalisés, des énumérations fermées et des entiers bornés. Les
 * libellés (titres, liens du pied de page) ne rejoignent JAMAIS le
 * <style> : ils sont rendus par React (échappement automatique).
 */

/** Hexadécimal strict #RRGGBB (3 ou 6 chiffres — normalisé ensuite). */
export const hexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Couleur hexadécimale attendue.");

/** Paliers facultatifs : null = conserver la valeur du socle (défaut). */
const colorKey = z.union([hexColor, z.null()]);

const colorSetSchema = z.object({
  bg: colorKey,
  surface: colorKey,
  surfaceAlt: colorKey,
  line: colorKey,
  inkStrong: colorKey,
  ink: colorKey,
  inkMuted: colorKey,
  inkFaint: colorKey,
  brand: colorKey,
  accent: colorKey,
  positive: colorKey,
});

/** Polices du jeu fermé self-hosté (app/layout.tsx charge ces variables). */
export const FONT_OPTIONS = [
  "inter",
  "archivo",
  "dmSans",
  "lora",
  "newsreader",
  "oswald",
] as const;

export const fontChoice = z.enum(FONT_OPTIONS);

export const typographySchema = z.object({
  fontBody: fontChoice.nullable(),
  fontTitles: fontChoice.nullable(),
  /** Taille de base du corps (px) — 100 % = 16 px. */
  baseSize: z.enum(["14px", "15px", "16px", "17px", "18px"]).nullable(),
  /** Multiplicateur des titres (composants unifiés .bhtv-title*). */
  titleScale: z.enum(["0.9", "1", "1.1", "1.2"]).nullable(),
  titleWeight: z.enum(["700", "800", "900"]).nullable(),
  lineHeight: z.enum(["1.4", "1.5", "1.6", "1.75"]).nullable(),
  titleTracking: z.enum(["-0.02em", "-0.01em", "0", "0.01em"]).nullable(),
});

export const componentsSchema = z.object({
  /** Rayon global des cartes/blocs (rounded-2xl et compagnie). */
  radius: z.enum(["sharp", "small", "standard", "round"]).nullable(),
  /** Élévation : ombres douces, marquées ou aucune (design plat). */
  shadows: z.enum(["soft", "strong", "none"]).nullable(),
  /** Densité des espacements de sections. */
  spacing: z.enum(["compact", "standard", "airy"]).nullable(),
});

export const headerSchema = z.object({
  height: z.enum(["compact", "standard", "airy"]).nullable(),
  style: z.enum(["glass", "solid", "flat"]).nullable(),
  /** sticky = fixe ; static = défile avec la page ; compact = réduit au
   *  défilement (hauteur réduite, mécanisme discret). */
  behavior: z.enum(["sticky", "static", "compact"]).nullable(),
  /** Échelle du logo — jamais de déformation : hauteur seulement. */
  logoScale: z.enum(["small", "standard", "large"]).nullable(),
});

/** Sections de la page d'accueil — ordre, visibilité, titres, colonnes. */
export const SECTION_IDS = ["hero", "featured", "categories", "videos", "b2b", "partners"] as const;

export const homeSectionSchema = z.object({
  id: z.enum(SECTION_IDS),
  visible: z.boolean().default(true),
  /** Titre surchargé (texte pur, rendu échappé par React). 1-80 car. */
  title: z.string().trim().max(80).nullable(),
  subtitle: z.string().trim().max(160).nullable(),
  /** Colonnes des grilles d'articles/vidéos (desktop). */
  columns: z.enum(["2", "3", "4"]).nullable(),
});

export const homeSchema = z
  .object({
    sections: z.array(homeSectionSchema),
    /** Catégories mises en avant dans la section vitrine « categories ». */
    featuredCategorySlugs: z.array(z.string().trim().max(60)).max(6),
  })
  .superRefine((home, ctx) => {
    const ids = home.sections.map((s) => s.id);
    // Chaque section présente UNE FOIS au plus — pas de doublon.
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Chaque section ne peut apparaître qu'une fois.",
      });
    }
  });

/** Liens du pied de page — URL validée, jamais rendue en raw HTML. */
const footerLink = z.object({
  label: z.string().trim().min(1).max(60),
  /** Lien interne (/chemin) ou HTTPS absolu — rien d'autre. */
  href: z
    .string()
    .trim()
    .max(300)
    .refine((h) => h.startsWith("/") || /^https:\/\//.test(h), {
      message: "Lien interne (/) ou https:// uniquement.",
    }),
});

export const footerSchema = z.object({
  style: z.enum(["classic", "columns2", "centered"]).nullable(),
  showNavigation: z.boolean().default(true),
  showContact: z.boolean().default(true),
  links: z.array(footerLink).max(10).optional(),
});

/** Apparence par défaut des NOUVELLES visites (Studio simplifié).
 *  null = comportement historique (nuit d'abord) — le commutateur manuel
 *  clair/sombre de l'en-tête reste MAÎTRE pour chaque visiteur. */
export const modeChoice = z.enum(["light", "dark"]);

export const designConfigSchema = z.object({
  /** Version du schéma — évolution future sans migration. */
  schemaVersion: z.literal(1),
  /**
   * Apparence par défaut (null = nuit, historique). .catch(null) : un
   * brouillon/design antérieur sans cette clé reste VALIDE (valeur nulle
   * réintroduite) — aucune rupture de compatibilité, jamais de migration.
   */
  mode: modeChoice.nullable().catch(null),
  colors: z.object({ light: colorSetSchema, dark: colorSetSchema }),
  typography: typographySchema,
  components: componentsSchema,
  header: headerSchema,
  home: homeSchema,
  footer: footerSchema,
});

export type ColorSet = z.infer<typeof colorSetSchema>;
export type TypographyConfig = z.infer<typeof typographySchema>;
export type ComponentsConfig = z.infer<typeof componentsSchema>;
export type HeaderConfig = z.infer<typeof headerSchema>;
export type HomeSection = z.infer<typeof homeSectionSchema>;
export type HomeConfig = z.infer<typeof homeSchema>;
export type FooterConfig = z.infer<typeof footerSchema>;
export type DesignConfig = z.infer<typeof designConfigSchema>;

/** Valide une valeur inconnue (brouillon navigateur ou base). */
export function parseDesignConfig(input: unknown): DesignConfig | null {
  const result = designConfigSchema.safeParse(input);
  return result.success ? result.data : null;
}

/** Libellés FR de l'interface du Studio (source unique). */
export const FONT_LABELS: Record<(typeof FONT_OPTIONS)[number], string> = {
  inter: "Inter — moderne, universelle",
  archivo: "Archivo — éditoriale dynamique (actuelle)",
  dmSans: "DM Sans — ronde, chaleureuse",
  lora: "Lora — serif lisible, magazine",
  newsreader: "Newsreader — serif grand quotidien",
  oswald: "Oswald — condensée, antenne TV",
};
