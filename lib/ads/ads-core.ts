/**
 * Noyau PUR de la régie publicitaire (aucune dépendance, aucun accès
 * base/réseau) — partagé par les Server Actions, les pages admin, le
 * moteur de diffusion public et les tests (horloges simulées).
 *
 * Décisions structurantes (cahier §2) :
 *  • le statut « Programmée » n'est jamais stocké : état EFFECTIF d'une
 *    campagne active dont le début est futur ;
 *  • diffusion publique = active ET période couvrant « maintenant »
 *    (horloge SERVEUR, jamais le navigateur) ET création approved
 *    ET emplacement actif autorisé ;
 *  • aucune URL externe reçue du client : les liens publics pointent
 *    /ads/click/[id] — le serveur lit la destination en base et la
 *    revalide exclusivement http/https (aucun open redirect).
 */

// ─── Formats (§6 des cahiers) ───────────────────────────────────────
export const AD_FORMATS = [
  "banner",
  "sponsor_article",
  "video",
  "card",
  "promo_strip",
] as const;
export type AdFormat = (typeof AD_FORMATS)[number];

/** 6e format : logos partenaires — table dédiée ad_partners (cahier §2). */
export const PARTNER_PLACEMENT = "home_partners";

// ─── Emplacements (§7) — codes stables, seedés en 0025 ──────────────
export const AD_PLACEMENT_CODES = [
  "home_top_banner",
  "home_inline",
  "news_feed_inline",
  "article_inline",
  "article_bottom",
  "videos_inline",
  "home_promo_strip",
  "home_partners",
] as const;
export type AdPlacementCode = (typeof AD_PLACEMENT_CODES)[number];

export const AD_DEVICES = ["desktop", "mobile"] as const;
export type AdDevice = (typeof AD_DEVICES)[number];

// ─── Statuts de campagne — états STOCKÉS (« Programmée » est calculée) ───
export const AD_STORED_STATUSES = [
  "draft",
  "pending",
  "active",
  "suspended",
  "completed",
  "cancelled",
  "refused",
] as const;
export type AdStoredStatus = (typeof AD_STORED_STATUSES)[number];

/** État effectif affiché/comportemental (calculé, jamais stocké). */
export type AdEffectiveState =
  | "draft"
  | "pending"
  | "programmed" // active + début futur (« Programmée » du cahier des charges)
  | "diffusing" //  active + créative diffusée en ce moment
  | "expired" //    active + fin passée (dénomination du bandeau, jamais public)
  | "paused"
  | "suspended"
  | "completed"
  | "cancelled"
  | "refused";

/** Diffusion publique : UNIQUEMENT ce statut effectif peut être rendu. */
export function isPubliclyDiffused(state: AdEffectiveState): boolean {
  return state === "diffusing";
}

/** Machine à états de la campagne (contrôles côté action, non contournables). */
const TRANSITIONS: Record<AdStoredStatus, AdStoredStatus[]> = {
  draft: ["pending"],
  pending: ["active", "refused", "cancelled", "draft"],
  active: ["suspended", "completed", "cancelled"],
  suspended: ["active", "completed", "cancelled"],
  completed: ["draft"],
  cancelled: ["draft"],
  refused: ["draft"],
};

/** Transitions réservées à l'administrateur (éditeur : jamais). */
const ADMIN_ONLY_TARGETS: AdStoredStatus[] = [
  "refused",
  "cancelled",
  "completed",
];

export function canTransition(
  from: AdStoredStatus,
  to: AdStoredStatus,
  role: "admin" | "editor"
): boolean {
  if (!TRANSITIONS[from]?.includes(to)) return false;
  if (ADMIN_ONLY_TARGETS.includes(to) && role !== "admin") return false;
  return true;
}

/** Liste lisible des transitions permises (aide de l'interface). */
export function allowedTransitions(
  from: AdStoredStatus,
  role: "admin" | "editor"
): AdStoredStatus[] {
  return (TRANSITIONS[from] ?? []).filter((to) => canTransition(from, to, role));
}

/**
 * État effectif d'une campagne à « now » (ISO UTC — horloge SERVEUR).
 * Une campagne active DOIT avoir début et fin (contrôle à l'activation) ;
 * si les dates manquent, l'état ne peut jamais diffuser (fail-closed).
 */
export function adStateOf(
  campaign: {
    status: AdStoredStatus;
    start_at: string | null;
    end_at: string | null;
  },
  nowIso: string
): AdEffectiveState {
  if (campaign.status !== "active") return campaign.status;
  if (!campaign.start_at || !campaign.end_at) return "paused";
  const now = Date.parse(nowIso);
  const start = Date.parse(campaign.start_at);
  const end = Date.parse(campaign.end_at);
  if (Number.isNaN(now) || Number.isNaN(start) || Number.isNaN(end)) return "paused";
  if (now < start) return "programmed";
  if (now >= end) return "expired";
  return "diffusing";
}

// ─── Validation des URLs publicitaires (§12) ────────────────────────
const FORBIDDEN_PROTOCOLS = /^(javascript|data|file|vbscript|blob):/i;

/** URL de destination/média : http/https EXCLUSIVEMENT, hôte obligatoire. */
export function isSafeAdUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  const trimmed = url.trim();
  if (trimmed.length === 0 || trimmed.length > 2000) return false;
  if (FORBIDDEN_PROTOCOLS.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    if (!parsed.hostname) return false;
    // Identifiants embarqués : jamais (le hachage des identifiants dans une
    // URL publique est rejeté — ils devraient passer par des en-têtes).
    if (parsed.username || parsed.password) return false;
    return true;
  } catch {
    return false;
  }
}

// ─── Rotation pondérée déterministe (§8) ────────────────────────────
// Hachage FNV-1a 32 bits stable (aucune crypto, aucune dépendance).
function stableUnit01(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h / 0xffffffff;
}

/**
 * Sélection pondérée DETERMINISTE par fenêtre de 5 minutes (Efraimidis-
 * Spirakis) : chaque créative tire une clé (h^(1/poids)) ; les
 * maxItems meilleures sont retenues. Une même fenêtre re-rend exactement
 * les mêmes annonces (cohérence ISR/hydratation) ; toutes les campagnes
 * de l'emplacement tournent — aucune ne monopole, le poids module
 * la probabilité et la priorité (rang campagne) départage l'ordre.
 */
export function rotateAds<T extends { key: string; priority: number; weight: number }>(
  candidates: T[],
  maxItems: number,
  nowMs: number
): T[] {
  if (candidates.length === 0) return [];
  const bucket = Math.floor(nowMs / 300000);
  const keyed = candidates.map((c) => {
    const roll = Math.pow(stableUnit01(`${c.key}#${bucket}`), 1 / Math.max(1, c.weight));
    return { candidate: c, roll, priority: Math.max(0, Math.min(100, c.priority)) };
  });
  keyed.sort(
    (a, b) =>
      b.priority - a.priority ||
      b.roll - a.roll ||
      (a.candidate.key < b.candidate.key ? -1 : 1)
  );
  return keyed.slice(0, Math.max(1, maxItems)).map((k) => k.candidate);
}

// ─── Statistiques (§10) ─────────────────────────────────────────────
/** CTR en % avec 1 décimale ; null sans impression (jamais NaN). */
export function computedCtr(clicks: number, impressions: number): number | null {
  if (impressions <= 0) return null;
  return Math.round((clicks / impressions) * 1000) / 10;
}

/** Règle d'impression uniforme (documentée, affichée dans l'admin). */
export const IMPRESSION_RULE =
  "Une impression est comptée à chaque rendu d'une création dans la page, avec déduplication : au maximum 1 impression par navigateur (empreinte) et par jour et par création. Impressions ≠ visiteurs uniques ; statistiques indicatives, jamais certifiées.";

// ─── Suivi des règlements (§9) ──────────────────────────────────────
export type PaymentState = "unpaid" | "partial" | "paid" | "late";

/** État de règlement d'une campagne (forfaits uniquement — §10). */
export function paymentStateOf(input: {
  amount: number;
  paidSum: number;
  contract_end_at: string | null;
  nowIso: string;
}): PaymentState {
  const due = input.amount - input.paidSum;
  if (due <= 0.0001) return "paid";
  if (input.contract_end_at && Date.parse(input.contract_end_at) < Date.parse(input.nowIso)) {
    return "late";
  }
  return input.paidSum > 0.0001 ? "partial" : "unpaid";
}

export const PAYMENT_METHODS = [
  "espèces",
  "mobile_money",
  "virement",
  "chèque",
  "autre",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

// ─── Export CSV (§9) ────────────────────────────────────────────────
/** Échappement CSV (guillemets, séparateur =, retour ligne réels). */
export function csvEscape(value: unknown): string {
  const raw = value === null || value === undefined ? "" : String(value);
  if (/[",;\r\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) lines.push(row.map(csvEscape).join(","));
  return `${lines.join("\r\n")}\r\n`;
}

// ─── Fingerprint (§10 — aucune IP brute) ────────────────────────────
/** Clé de déduplication : empreinte déjà normalisée côté route. */
export function fingerprintOf(parts: string[]): string {
  return parts.join("|").slice(0, 200);
}

// ─── Affichages humains ─────────────────────────────────────────────
export const AD_STATUS_LABELS: Record<AdStoredStatus, string> = {
  draft: "Brouillon",
  pending: "En attente de validation",
  active: "Active",
  suspended: "Suspendue",
  completed: "Terminée",
  cancelled: "Annulée",
  refused: "Refusée",
};

export const AD_STATE_LABELS: Record<AdEffectiveState, string> = {
  draft: "Brouillon",
  pending: "En attente de validation",
  programmed: "Programmée",
  diffusing: "En diffusion",
  expired: "Expirée",
  paused: "Sans période (fail-closed)",
  suspended: "Suspendue",
  completed: "Terminée",
  cancelled: "Annulée",
  refused: "Refusée",
};

export const AD_FORMAT_LABELS: Record<AdFormat, string> = {
  banner: "Bannière publicitaire",
  sponsor_article: "Article sponsorisé",
  video: "Vidéo publicitaire (YouTube)",
  card: "Carte publicitaire",
  promo_strip: "Bandeau promotionnel",
};

export const PAYMENT_STATE_LABELS: Record<PaymentState, string> = {
  unpaid: "Non payé",
  partial: "Partiellement payé",
  paid: "Payé",
  late: "En retard",
};