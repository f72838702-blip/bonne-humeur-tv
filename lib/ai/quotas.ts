import { checkRateLimit } from "@/lib/actions/helpers";

/**
 * Quota CENTRALISÉ des assistants IA (demande direction §7).
 *
 * Deux compteurs DISTINTS dans form_submissions (migration 0032) — le
 * public ne peut JAMAIS épuiser le quota réservé à l'administration :
 *   • `assistant_public` : par session (fenêtre courte) + global/jour ;
 *   • `assistant_admin`  : par utilisateur (fenêtre courte) + global/jour.
 *
 * Défense en PROFONDEUR : la base est l'état partagé fiable (service_role),
 * MAIS tant que la migration 0032 n'est pas appliquée, check_rate_limit
 * renvoie une erreur → état « degraded ». Un limiter EN MÉMOIRE (par
 * isolate Worker — best effort, multi-isolates possibles) prend alors le
 * relais : aucune requête n'échappe à TOUT contrôle. Une fois la migration
 * appliquée, la base fait autorité et la mémoire devient un filet.
 * Jamais de bascule payante : au quota atteint, la requête est refusée
 * avec un message visible.
 */

// ─── Limites effectives (documentées au rapport) ────────────────────────────

/** Taille maximale d'un message visiteur (caractères). */
export const PUBLIC_MSG_MAX_CHARS = 2000;
/** Taille maximale d'une demande admin (caractères). */
export const ADMIN_MSG_MAX_CHARS = 6000;
/** Longueur maximale des réponses PUBLIQUES (tokens générés) — réponses
 *  courtes attendues (≤ 3 phrases). Un modèle à raisonnement qui consommerait
 *  tout le budget renvoie une réponse vide → message de recadrage exact
 *  (comportement maîtrisé, testé). */
export const OUTPUT_MAX_TOKENS = 900;
/** Longueur maximale des réponses ADMIN (C4, Phase E) : relevée à la valeur
 *  par défaut documentée du modèle (2000) car qwen3-30b consomme son budget
 *  en RÉAISONNEMENT avant le contenu — à 900, la tâche « reformulation »
 *  renvoyait du raisonnement seul (prouvé au banc du 05/11). Coût plafond
 *  par échange : 2 000 tokens × 30 475 Neurons/M ≈ 61 Neurons. */
export const ADMIN_OUTPUT_MAX_TOKENS = 2000;

/** Public : par session visiteur. */
export const PUBLIC_SESSION_MAX_REQUESTS = 12;
export const PUBLIC_SESSION_WINDOW_SECONDS = 600;
/** Public : global par jour (UTC) — 150 (Phase E2) : régime prudent à
 *  ~33 Neurons/échange pire-cas ≈ 4 950 Neurons, laissant une réserve
 *  d'au moins 3 450 Neurons sur les 10 000 du plan Free (simulation Phase E §7,
 *  dépassement du quota entre (200+60) et (300+90) échanges). */
export const PUBLIC_DAILY_MAX_REQUESTS = 150;
/** Admin : par utilisateur connecté. */
export const ADMIN_USER_MAX_REQUESTS = 40;
export const ADMIN_USER_WINDOW_SECONDS = 600;
/** Admin : global par jour — 40 (Phase E2) : part RÉSERVÉE au travail
 *  éditorial ≈ 1 600-3 000 Neurons pire-cas, conservée même si le public
 *  sature son propre plafond. */
export const ADMIN_DAILY_MAX_REQUESTS = 40;
export const DAILY_WINDOW_SECONDS = 86_400;

export type AiAudience = "public" | "admin";

export type QuotaDecision = "allowed" | "limited";

// ─── Limiter mémoire (filet, isolate-local, purge de fenêtre) ───────────────

interface Bucket {
  hits: number[];
  dayKey: string;
  dayCount: number;
}

const buckets = new Map<string, Bucket>();

export function utcDayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function memoryLimiterKey(audience: AiAudience, identifier: string): string {
  return `${audience}:${identifier}`;
}

function pruneHits(bucket: Bucket, windowSeconds: number, now: number): void {
  const cutoff = now - windowSeconds * 1000;
  bucket.hits = bucket.hits.filter((t) => t > cutoff);
}

/**
 * Pur TEST : décide avec la mémoire seule (utilisé par les unit tests et
 * comme filet si la base est en « degraded »).
 */
export function memoryQuotaCheck(
  audience: AiAudience,
  identifier: string,
  dailyMax: number,
  shortWindowMax: number,
  shortWindowSeconds: number,
  now = new Date()
): QuotaDecision {
  const key = memoryLimiterKey(audience, identifier);
  const day = utcDayKey(now);
  const ts = now.getTime();
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { hits: [], dayKey: day, dayCount: 0 };
    buckets.set(key, bucket);
  }
  if (bucket.dayKey !== day) {
    bucket.dayKey = day;
    bucket.dayCount = 0;
  }
  pruneHits(bucket, shortWindowSeconds, ts);
  if (bucket.dayCount >= dailyMax || bucket.hits.length >= shortWindowMax) {
    return "limited";
  }
  bucket.hits.push(ts);
  bucket.dayCount += 1;
  return "allowed";
}

// ─── Décision officielle (base si disponible, mémoire sinon) ────────────────

export type QuotaState = "allowed" | "limited" | "degraded";

/**
 * Vérifie PUIS consomme le quota (comme le formulaire existant :
 * check → insert si autorisé). Renvoie l'état le plus précis connu :
 *   - "allowed" : autorisé (dans la base, autorité partagée) ;
 *   - "limited" : refusé (base OU filet mémoire) ;
 *   - "degraded" : autorisé UNIQUEMENT par le filet mémoire (base
 *     indisponible ou migration 0032 pas encore appliquée — état à
 *     documenter, l'assistant reste sous contrôle).
 */
export async function checkAiQuota(
  audience: AiAudience,
  identifier: string
): Promise<QuotaState> {
  const dailyMax =
    audience === "public" ? PUBLIC_DAILY_MAX_REQUESTS : ADMIN_DAILY_MAX_REQUESTS;
  const shortMax =
    audience === "public"
      ? PUBLIC_SESSION_MAX_REQUESTS
      : ADMIN_USER_MAX_REQUESTS;
  const shortWindow =
    audience === "public"
      ? PUBLIC_SESSION_WINDOW_SECONDS
      : ADMIN_USER_WINDOW_SECONDS;

  // 1) Fenêtre courte (la base enregistre un hit par appel autorisé).
  const short = await checkRateLimit(
    audience === "public" ? "assistant_public" : "assistant_admin",
    identifier,
    shortMax,
    shortWindow
  );
  if (short === "limited") return "limited";

  // 2) Quota quotidien global (compteur distinct dédié).
  let daily = await checkRateLimit(
    audience === "public" ? "assistant_public" : "assistant_admin",
    audience === "public" ? "daily-public" : "daily-admin",
    dailyMax,
    DAILY_WINDOW_SECONDS
  );
  if (daily === "limited") return "limited";

  // 3) Base indisponible (« degraded ») → le filet mémoire décide.
  if (short === "degraded" || daily === "degraded") {
    const mem = memoryQuotaCheck(audience, identifier, dailyMax, shortMax, shortWindow);
    return mem === "allowed" ? "degraded" : "limited";
  }
  return "allowed";
}

export const QUOTA_PUBLIC_MESSAGE =
  "L'assistant a atteint sa limite de disponibilité pour aujourd'hui. Merci de réessayer plus tard.";

export const QUOTA_ADMIN_MESSAGE =
  "Quota de l'assistant atteint (fenêtre d'utilisation ou limite journalière). Réessayez plus tard — le quota de l'administration est préservé.";
