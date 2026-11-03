/**
 * Dossiers logiques & variantes d'images — directive §2.
 * Module PUR : partagé par le client (compression) et le serveur
 * (validation), sans dépendance ni secret.
 *
 * Dossiers Supabase Storage (bucket « media », public en lecture) :
 *   articles/    couvertures d'articles   → full + card + thumb
 *   categories/  illustrations rubriques → card + thumb
 *   thumbnails/  miniatures dédiées       → thumb
 *   reporters/   photos de reporter       → avatar
 *   branding/    identité, bannières      → full
 *   advertising/ visuels de la régie      → full + card
 */

export const MEDIA_PURPOSES = [
  "articles",
  "categories",
  "thumbnails",
  "reporters",
  "branding",
  "advertising",
] as const;

export type MediaPurpose = (typeof MEDIA_PURPOSES)[number];

export const MEDIA_VARIANTS = ["full", "card", "thumb", "avatar"] as const;
export type MediaVariant = (typeof MEDIA_VARIANTS)[number];

/** Variante principale affichée par défaut pour chaque dossier. */
export const MAIN_VARIANT: Record<MediaPurpose, MediaVariant> = {
  articles: "full",
  categories: "card",
  thumbnails: "thumb",
  reporters: "avatar",
  branding: "full",
  advertising: "full",
};

/** Variantes produites pour chaque dossier (la compression client
 *  génère exactement celles-ci ; le serveur n'accepte qu'elles). */
export const PURPOSE_VARIANTS: Record<MediaPurpose, MediaVariant[]> = {
  articles: ["full", "card", "thumb"],
  categories: ["card", "thumb"],
  thumbnails: ["thumb"],
  reporters: ["avatar"],
  branding: ["full"],
  advertising: ["full", "card"],
};

/** Cibles de compression côté navigateur (directive §2) :
 *  dimension max, qualité, poids visé — le ratio est préservé et
 *  l'encodage canvas supprime les métadonnées EXIF (dont GPS). */
export const VARIANT_PRESETS: Record<
  MediaVariant,
  { maxDim: number; quality: number; targetBytes: number }
> = {
  full: { maxDim: 1920, quality: 0.85, targetBytes: 500 * 1024 },
  card: { maxDim: 800, quality: 0.8, targetBytes: 200 * 1024 },
  thumb: { maxDim: 480, quality: 0.78, targetBytes: 120 * 1024 },
  avatar: { maxDim: 400, quality: 0.8, targetBytes: 100 * 1024 },
};

/** Plafonds SERVEUR (défense en profondeur — jamais la seule barrière) :
 *  au-delà, le fichier est refusé quelle que soit sa déclaration. */
export const SERVER_MAX_DIM: Record<MediaVariant, number> = {
  full: 2000,
  card: 900,
  thumb: 600,
  avatar: 500,
};

export const SERVER_MAX_BYTES: Record<MediaVariant, number> = {
  full: 600 * 1024,
  card: 300 * 1024,
  thumb: 200 * 1024,
  avatar: 200 * 1024,
};

/** Suffixe de fichier d'une variante (la variante principale n'en a pas). */
export function variantSuffix(variant: MediaVariant): string {
  return variant === "full" ? "" : `-${variant}`;
}

/**
 * URL de la variante d'une image stockée. N'agit QUE sur les URLs du
 * bucket Storage public : une URL externe (miniature YouTube i.ytimg,
 * etc.) est renvoyée inchangée — on ne retélécharge ni ne réécrit
 * jamais les miniatures YouTube (directive §1).
 *
 *   mediaVariantUrl("…/media/articles/123-abc.webp", "card")
 *     → "…/media/articles/123-abc-card.webp"
 */
export function mediaVariantUrl(url: string, variant: MediaVariant): string {
  if (!url) return url;
  const marker = "/storage/v1/object/public/media/";
  const idx = url.indexOf(marker);
  if (idx === -1) return url;
  const base = url.slice(0, idx + marker.length);
  const path = url.slice(idx + marker.length);
  const dot = path.lastIndexOf(".");
  const slash = path.lastIndexOf("/");
  // Pas d'extension ou extension avant le dernier segment : URL inattendue.
  if (dot === -1 || dot < slash) return url;
  const suffix = variantSuffix(variant);
  return `${base}${path.slice(0, dot)}${suffix}${path.slice(dot)}`;
}