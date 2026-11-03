/**
 * NOYAU PUR — durées, niveaux et cycle de vie des flash-infos.
 * Aucune dépendance, aucun accès base/réseau : TOUT prend l'instant
 * courant en paramètre (horloge simulable dans les tests — vitest).
 * Utilisé par la Server Action (calcul d'expiration côté serveur),
 * le formulaire (prévisualisation estimée) et le bandeau public
 * (retrait à échéance).
 */

export interface DurationOption {
  minutes: number;
  label: string;
}

/** Menu déroulant « Durée de diffusion après publication » — valeurs
 *  autorisées côté serveur (jamais la seule validation du navigateur). */
export const DURATION_OPTIONS: readonly DurationOption[] = [
  { minutes: 15, label: "15 minutes" },
  { minutes: 30, label: "30 minutes" },
  { minutes: 45, label: "45 minutes" },
  { minutes: 60, label: "1 heure" },
  { minutes: 120, label: "2 heures" },
  { minutes: 180, label: "3 heures" },
  { minutes: 360, label: "6 heures" },
  { minutes: 480, label: "8 heures" },
  { minutes: 720, label: "12 heures" },
  { minutes: 1440, label: "24 heures" },
] as const;

/** Sélection par défaut du menu : 1 heure. */
export const DEFAULT_DURATION_MINUTES = 60;

const ALLOWED_DURATIONS: ReadonlySet<number> = new Set(
  DURATION_OPTIONS.map((o) => o.minutes)
);

/** Contrôle serveur de la durée : entier figurant dans la liste autorisée
 *  (une valeur hors liste modifiée dans la requête est REFUSÉE). */
export function isAllowedDuration(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    ALLOWED_DURATIONS.has(value)
  );
}

export const FLASH_LEVELS = ["normal", "important", "urgent"] as const;
export type FlashLevel = (typeof FLASH_LEVELS)[number];

export function isFlashLevel(value: unknown): value is FlashLevel {
  return (
    typeof value === "string" && (FLASH_LEVELS as readonly string[]).includes(value)
  );
}

/** « 45 minutes », « 1 heure », « 2 heures », « 24 heures ». */
export function humanizeDuration(minutes: number): string {
  if (minutes === 60) return "1 heure";
  if (minutes > 0 && minutes % 60 === 0) return `${minutes / 60} heures`;
  return `${minutes} minutes`;
}

/**
 * Expiration = début + durée (§3 : date_fin = date_debut + durée).
 * Entrée/sortie en ISO UTC (timestamptz Supabase). Retourne null si
 * l'instant de départ n'est pas parseable (jamais d'expiration fantôme).
 */
export function computeExpiry(startIso: string, minutes: number): string | null {
  if (!isAllowedDuration(minutes)) return null;
  const start = Date.parse(startIso);
  if (Number.isNaN(start)) return null;
  return new Date(start + minutes * 60_000).toISOString();
}

/**
 * Saisie « Programmer » (datetime-local) interprétée en AFRIQUE/CONAKRY.
 * Conakry = UTC+0 constant (pas d'heure d'été) : la saisie humaine est
 * convertie en ISO UTC — même interprétation navigateur/serveur/PostgreSQL,
 * jamais une valeur naïve dépendante du fuseau du navigateur.
 */
export function parseConakryInput(value: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::\d{2})?$/.exec(value.trim());
  if (!m) return null;
  const ms = Date.parse(`${m[1]}:00Z`);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

export type FlashLifecycle =
  | "inactive" // brouillon ou désactivé : jamais public jusqu'à décision
  | "scheduled" // actif, début futur (RLS : invisible avant le début)
  | "active" // actif avec fin future : affiché
  | "active_no_expiry" // actif SANS fin (flash historique) : affiché
  | "expired"; // fin passée : retiré (public) et à réactiver (admin)

/** Cycle de vie pur (le public ne voit que active / active_no_expiry). */
export function classifyFlash(
  nowIso: string,
  isActive: boolean,
  startIso: string | null,
  endIso: string | null
): FlashLifecycle {
  if (!isActive) return "inactive";
  const now = Date.parse(nowIso);
  if (startIso) {
    const start = Date.parse(startIso);
    if (!Number.isNaN(start) && start > now) return "scheduled";
  }
  if (endIso) {
    const end = Date.parse(endIso);
    if (!Number.isNaN(end)) {
      if (end <= now) return "expired";
      return "active";
    }
  }
  return "active_no_expiry";
}

/** « 16h30 » — heure de Conakry (UTC+0), pour l'affichage humain SEUL. */
export function formatConakryTime(iso: string): string | null {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return null;
  const hhmm = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Africa/Conakry",
  }).format(instant);
  // « 16:30 » → « 16h30 » (les libellés du cahier des charges).
  return hhmm.replace(":", "h");
}

/** « 05/11 à 09h00 (Conakry) ». */
export function formatConakryDateTime(iso: string): string | null {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return null;
  const day = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Africa/Conakry",
  }).format(instant);
  return `${day} à ${formatConakryTime(iso) ?? "?"} (Conakry)`;
}

/** Temps restant avant une échéance (« 1 h 32 min restantes ») — pur. */
export function remainingLabel(nowIso: string, endIso: string): string | null {
  const remaining = Date.parse(endIso) - Date.parse(nowIso);
  if (Number.isNaN(remaining) || remaining <= 0) return null;
  const minutes = Math.ceil(remaining / 60_000);
  if (minutes < 1) return "moins d'une minute restante";
  if (minutes < 60) return minutes === 1 ? "1 min restante" : `${minutes} min restantes`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins === 0
    ? hours === 1
      ? "1 h restante"
      : `${hours} h restantes`
    : `${hours} h ${String(mins).padStart(2, "0")} min restantes`;
}

// ─────────────────────────────────────────────────────────────
// RETRAIT CÔTÉ NAVIGATEUR (§8) — pur, testé
// ─────────────────────────────────────────────────────────────

export interface ExpiryEvent {
  id: string;
  /** Millisecondes à attendre avant retrait ; 0 = déjà expiré (retrait
   *  immédiat au montage). Jamais au-delà de la limite des setTimeout
   *  (2 147 483 647 ms ≈ 24,8 j — les durées max 24 h passent largement). */
  delayMs: number;
}

/** Défini par la plateforme : setTimeout au-delà déclenche immédiatement. */
const MAX_TIMEOUT_MS = 2_147_483_647;

/**
 * Calcule les retraits à programmer pour UNE charge de bandeau (aucune
 * boucle de requêtes : un setTimeout par flash actif à fin définie ;
 * les flashs sans fin — historiques — ne sont jamais retirés).
 */
export function expiryEvents(
  items: ReadonlyArray<{ id: string; end_at: string | null }>,
  nowMs: number
): ExpiryEvent[] {
  const events: ExpiryEvent[] = [];
  for (const item of items) {
    if (!item.end_at) continue; // historique sans expiration : inchangé
    const end = Date.parse(item.end_at);
    if (Number.isNaN(end)) continue;
    const delay = end - nowMs;
    if (delay > MAX_TIMEOUT_MS) continue; // échéance trop loin : rechargée plus tard par le serveur
    events.push({ id: item.id, delayMs: Math.max(0, delay) });
  }
  return events;
}