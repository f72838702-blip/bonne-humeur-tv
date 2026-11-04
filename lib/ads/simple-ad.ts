/**
 * Noyau PUR de l'interface simplifiée (« une publicité = un formulaire =
 * une publication ») — aucune dépendance, aucun accès base/réseau.
 *
 * Principe (mission simplification) : toutes les relations techniques
 * (annonceur, campagne, création, liaisons, approbation, activation)
 * restent en arrière-plan ; ce module expose SEULEMENT les décisions que
 * l'interface simplifiée doit prendre :
 *   • une durée lisible (24 h → 90 j, ou libre) → période start/end UTC ;
 *   • un format → les emplacements RÉELLEMENT compatibles (base) ;
 *   • un nom d'entreprise → l'annonceur existant correspondant (jamais
 *     de doublon), sinon la création d'un nouvel annonceur ;
 *   • une prolongation → nouvelle date de fin (jamais dans le passé).
 * La compatibilité des formats est lue depuis les données RÉELLES
 * (ad_placements.allowed_formats) — jamais codée en dur double.
 */

// ─── Durées simples ─────────────────────────────────────────────────
export interface SimpleDuration {
  key: string;
  hours: number | null; // null = personnalisée (dates libres)
  label: string;
  /** Jours en clair pour l'action « Prolonger ». */
  days: number | null;
}

export const SIMPLE_DURATIONS: SimpleDuration[] = [
  { key: "24h", hours: 24, label: "24 heures", days: 1 },
  { key: "3j", hours: 72, label: "3 jours", days: 3 },
  { key: "7j", hours: 168, label: "7 jours", days: 7 },
  { key: "15j", hours: 360, label: "15 jours", days: 15 },
  { key: "30j", hours: 720, label: "30 jours", days: 30 },
  { key: "60j", hours: 1440, label: "60 jours", days: 60 },
  { key: "90j", hours: 2160, label: "90 jours", days: 90 },
  { key: "libre", hours: null, label: "Personnalisée", days: null },
];

export const DEFAULT_DURATION_KEY = "7j";
export const SIMPLE_DURATION_KEYS = SIMPLE_DURATIONS.map((d) => d.key) as [string, ...string[]];

export function durationOf(key: string): SimpleDuration | null {
  return SIMPLE_DURATIONS.find((d) => d.key === key) ?? null;
}

// ─── Libellés simplifiés des emplacements (aucun code technique) ─────
/** Libellé court compréhensible — le code stable reste en coulisses. */
export const SIMPLE_PLACEMENT_LABELS: Record<string, string> = {
  home_top_banner: "Page d'accueil — bannière en haut",
  home_inline: "Page d'accueil — entre les sections",
  news_feed_inline: "Liste des actualités",
  article_inline: "À l'intérieur des articles",
  article_bottom: "Après les articles",
  videos_inline: "Rubrique vidéos",
  home_promo_strip: "Bandeau promotionnel de l'accueil",
  home_partners: "Espace partenaires (logos)",
};

// ─── Formats simplifiés (6 cartes de l'étape 2) ─────────────────────
// 5 formats créative + le cas particulier « partenaire » (table ad_partners
// dédiée — PAS une campagne). Clé simpleAdFormat ≠ format SQL « partner ».
export const SIMPLIZED_AD_FORMATS = [
  "banner",
  "card",
  "video",
  "sponsor_article",
  "promo_strip",
  "partner",
] as const;
export type SimpleAdFormat = (typeof SIMPLIZED_AD_FORMATS)[number];

/** Tuple pour z.enum (zod 4 exige un tuple lisible). */
export const SIMPLE_FORMAT_KEYS = [...SIMPLIZED_AD_FORMATS] as [
  SimpleAdFormat,
  ...SimpleAdFormat[],
];

export const SIMPLE_FORMAT_CARDS: { key: SimpleAdFormat; label: string; hint: string }[] = [
  { key: "banner", label: "Bannière publicitaire", hint: "Grande image en haut d'une page" },
  { key: "card", label: "Carte publicitaire", hint: "Image + texte dans les listes" },
  { key: "video", label: "Vidéo YouTube", hint: "Lire une vidéo dans la page" },
  { key: "sponsor_article", label: "Article sponsorisé", hint: "Mettre en avant un article" },
  { key: "promo_strip", label: "Bandeau promotionnel", hint: "Message court sur l'accueil" },
  { key: "partner", label: "Logo partenaire", hint: "Logo dans l'espace partenaires" },
];

export const SIMPLE_FORMAT_LABELS: Record<SimpleAdFormat, string> = {
  banner: "Bannière publicitaire",
  card: "Carte publicitaire",
  video: "Vidéo YouTube",
  sponsor_article: "Article sponsorisé",
  promo_strip: "Bandeau promotionnel",
  partner: "Logo partenaire",
};

/** Formats qui s'appuient sur les campagnes (le partenaire est séparé). */
export function isCampaignFormat(format: SimpleAdFormat): boolean {
  return format !== "partner";
}

// ─── Compatibilité format ↔ emplacements (DONNÉES RÉELLES) ──────────
export interface PlacementCompatInput {
  code: string;
  allowed_formats: string[];
  is_active: boolean;
}

/** Emplacements actifs où ce format peut VRAIMENT s'afficher. */
export function compatiblePlacements(
  sqlFormat: string,
  placements: PlacementCompatInput[]
): PlacementCompatInput[] {
  return placements.filter(
    (p) => p.is_active && Array.isArray(p.allowed_formats) && p.allowed_formats.includes(sqlFormat)
  );
}

/** Codes retenus : ceux cochés qui sont compatibles, sinon TOUT le compatible. */
export function resolvePlacements(
  sqlFormat: string,
  chosen: string[],
  placements: PlacementCompatInput[]
): string[] {
  const compatible = compatiblePlacements(sqlFormat, placements).map((p) => p.code);
  if (compatible.length === 0) return [];
  const filtered = chosen.filter((c) => compatible.includes(c));
  return filtered.length > 0 ? filtered : compatible;
}

// ─── Période depuis une durée simple ────────────────────────────────
export interface AdPeriod {
  start_at: string; // ISO UTC
  end_at: string; //   ISO UTC
}

/**
 * Période de diffusion à partir d'une durée :
 *  • durée préréglée : début = date personnalisée (programmation future)
 *    sinon MAINTENANT (horloge SERVEUR — jamais le navigateur) ; fin =
 *    début + durée ;
 *  • « libre » : les deux dates sont obligatoires et cohérentes
 *    (campagnePeriodError — source de vérité unique des dates).
 * Retourne { error } — l'action refuse toute période incohérente.
 */
export function computeAdPeriod(
  durationKey: string,
  customStartIso: string | null,
  customEndIso: string | null,
  nowIso: string
): AdPeriod | { error: string } {
  const duration = durationOf(durationKey);
  if (!duration) return { error: "Durée de diffusion inconnue : choisissez une durée dans la liste." };
  if (duration.hours === null) {
    if (!customStartIso || !customEndIso) {
      return { error: "Avec la durée personnalisée, indiquez le début ET la fin de diffusion." };
    }
    const s = Date.parse(customStartIso);
    const e = Date.parse(customEndIso);
    if (Number.isNaN(s) || Number.isNaN(e)) return { error: "Dates personnalisées illisibles : reformulez-les." };
    const checked = campaignPeriodCheck(customStartIso, customEndIso);
    if (checked) return { error: checked };
    return { start_at: new Date(s).toISOString(), end_at: new Date(e).toISOString() };
  }
  // Début personnalisé (programmation future) sinon maintenant.
  let start: number;
  if (customStartIso) {
    start = Date.parse(customStartIso);
    if (Number.isNaN(start)) return { error: "Date de début personnalisée illisible : reformulez-la." };
  } else {
    start = Date.parse(nowIso);
  }
  return {
    start_at: new Date(start).toISOString(),
    end_at: new Date(start + duration.hours * 3_600_000).toISOString(),
  };
}

/** Garde de période (une seule règle : fin > début) — pure, testable. */
function campaignPeriodCheck(startIso: string, endIso: string): string | null {
  return Date.parse(endIso) <= Date.parse(startIso)
    ? "La fin doit être postérieure au début : vérifiez l'heure, pas seulement le jour."
    : null;
}

// ─── Annonceur — correspondance sans doublon ────────────────────────
/** Nom normalisé : minuscule, accents retirés, espaces réduits. */
export function normalizedAdvertiserName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export interface AdvertiserNameInput {
  id: string;
  name: string;
}

/**
 * L'annonceur RÉEL correspondant (nom normalisé EXACT) — deux entreprises
 * de noms PROCHES mais différents NE SONT PAS fusionnées : seul un nom
 * identitaire identique réutilise la fiche existante (jamais de doublon,
 * jamais de fusion silencieuse).
 */
export function matchAdvertiserByNormalized(
  name: string,
  advertisers: AdvertiserNameInput[]
): AdvertiserNameInput | null {
  const target = normalizedAdvertiserName(name);
  if (!target) return null;
  return advertisers.find((a) => normalizedAdvertiserName(a.name) === target) ?? null;
}

// ─── Prolongation ───────────────────────────────────────────────────
/**
 * Nouvelle période après prolongation de `days` jours :
 * ancrée sur « maintenant » si la fin est déjà PASSÉE (une pub expirée
 * repart de l'instant présent), sinon sur la fin en cours — le début
 * reste inchangé (l'historique conservé). Jamais de fin dans le passé.
 */
export function extendPeriod(
  current: { start_at: string | null; end_at: string | null },
  days: number,
  nowIso: string
): { start_at: string | null; end_at: string } {
  const now = Date.parse(nowIso);
  const end = current.end_at ? Date.parse(current.end_at) : now;
  const anchor = Number.isNaN(end) || end < now ? now : end;
  return {
    start_at: current.start_at ?? new Date(now).toISOString(),
    end_at: new Date(anchor + days * 86_400_000).toISOString(),
  };
}

// ─── Nom automatique de la publicité ────────────────────────────────
/** « Entreprise · Format » — l'administrateur n'a rien à inventer. */
export function autoPubliciteName(advertiserName: string, format: SimpleAdFormat): string {
  return `${advertiserName} · ${SIMPLE_FORMAT_LABELS[format]}`;
}