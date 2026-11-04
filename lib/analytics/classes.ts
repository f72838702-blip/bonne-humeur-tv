/**
 * Classes PUR de l'analytics (aucune I/O) : classifications serveur,
 * seuils de lecture engagée, périodes de filtre, drapeaux pays.
 * Testables à 100 % (scénarios §12 de la mission).
 */

// ─────────────────────────────────────────────────────────────────────────
// Provenance — classifiée CÔTÉ SERVEUR depuis l'en-tête Referer réel.
// Règle d'honnêteté : rien n'est jamais inventé — pas d'en-tête ou hôte
// absent → 'unknown' ; accès direct (aucun referer) → 'direct'.
// ─────────────────────────────────────────────────────────────────────────

export type ReferrerClass =
  | "direct" | "search" | "facebook" | "whatsapp" | "instagram" | "twitter"
  | "tiktok" | "youtube" | "other_social" | "external" | "unknown";

const SOCIAL_HOSTS: { host: string; cls: ReferrerClass }[] = [
  { host: "facebook.com", cls: "facebook" },
  { host: "fb.com", cls: "facebook" },
  { host: "fb.me", cls: "facebook" },
  { host: "m.facebook.com", cls: "facebook" },
  { host: "l.facebook.com", cls: "facebook" },
  { host: "lm.facebook.com", cls: "facebook" },
  { host: "whatsapp.com", cls: "whatsapp" },
  { host: "wa.me", cls: "whatsapp" },
  { host: "chat.whatsapp.com", cls: "whatsapp" },
  { host: "instagram.com", cls: "instagram" },
  { host: "twitter.com", cls: "twitter" },
  { host: "x.com", cls: "twitter" },
  { host: "t.co", cls: "twitter" },
  { host: "tiktok.com", cls: "tiktok" },
  { host: "youtube.com", cls: "youtube" },
  { host: "youtu.be", cls: "youtube" },
];

const SEARCH_HOSTS = [
  "google.com", "google.com.gn", "google.fr", "bing.com", "duckduckgo.com",
  "yahoo.com", "ecosia.org", "yandex.com", "search.marcia.africa",
];

export function classifyReferrer(referer: string | null | undefined): ReferrerClass {
  if (!referer) return "direct";
  let host: string;
  try {
    host = new URL(referer).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "unknown";
  }
  const social = SOCIAL_HOSTS.find((s) => host === s.host || host.endsWith(`.${s.host}`));
  if (social) return social.cls;
  if (SEARCH_HOSTS.some((s) => host === s || host.endsWith(`.${s}`))) return "search";
  return "external";
}

export const REFERRER_LABELS: Record<ReferrerClass, string> = {
  direct: "Accès direct",
  search: "Moteurs de recherche",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  twitter: "X (Twitter)",
  tiktok: "TikTok",
  youtube: "YouTube",
  other_social: "Autres réseaux sociaux",
  external: "Sites externes",
  unknown: "Inconnu",
};

// ─────────────────────────────────────────────────────────────────────────
// Appareil / navigateur — lus sur l'User-Agent CÔTÉ SERVEUR (le client ne
// décide jamais de ce qu'il rapporte), sans stocker l'UA.
// ─────────────────────────────────────────────────────────────────────────

export type Device = "mobile" | "desktop" | "tablet";
export type Browser = "chrome" | "safari" | "firefox" | "edge" | "samsung" | "opera" | "other";

export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua || ua.length < 10) return true; // UA vide = trafic non crédible
  return /bot|crawler|spider|crawling|curl|wget|python|headless|preview|monitor|lighthouse|facebookexternalhit|whatsapp|telegram|slack|discord/i.test(ua);
}

export function classifyDevice(ua: string): Device {
  if (/ipad|tablet|playbook|silk|kindle/i.test(ua)) return "tablet";
  // Un Android SANS mobile = souvent tablette ; on garde une heuristique
  // simple et honnête : Mobi / iPhone → mobile.
  if (/mobi|iphone|android(?!.*tablet)/i.test(ua)) return "mobile";
  return "desktop";
}

export function classifyBrowser(ua: string): Browser {
  // Ordre important : Edge/OPR contiennent "Chrome".
  if (/edg\//i.test(ua)) return "edge";
  if (/opr\/|opera/i.test(ua)) return "opera";
  if (/samsungbrowser/i.test(ua)) return "samsung";
  if (/firefox|fxios/i.test(ua)) return "firefox";
  if (/chrome|crios/i.test(ua)) return "chrome";
  if (/safari/i.test(ua)) return "safari";
  return "other";
}

export const DEVICE_LABELS: Record<Device, string> = {
  mobile: "Téléphones",
  desktop: "Ordinateurs",
  tablet: "Tablettes",
};

export const BROWSER_LABELS: Record<Browser, string> = {
  chrome: "Chrome",
  safari: "Safari",
  firefox: "Firefox",
  edge: "Edge",
  samsung: "Samsung Internet",
  opera: "Opera",
  other: "Autres",
};

// ─────────────────────────────────────────────────────────────────────────
// Pays — drapeau emoji déduit de l'ISO-2 (aucune donnée personnelle) ;
// null/absent → jamais inventé → bucket « Inconnu ».
// ─────────────────────────────────────────────────────────────────────────

export function toCountryIso2(value: string | null | undefined): string | null {
  const v = (value ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(v) ? v : null;
}

export function countryFlag(iso2: string): string {
  if (!/^[A-Z]{2}$/.test(iso2)) return "🏳️";
  return String.fromCodePoint(...[...iso2].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

// Noms français des pays plausibles sur ce site (le reste → code ISO, brut,
// JAMAIS de nom inventé).
export const COUNTRY_NAMES_FR: Record<string, string> = {
  GN: "Guinée",
  CI: "Côte d'Ivoire",
  SN: "Sénégal",
  ML: "Mali",
  BF: "Burkina Faso",
  SL: "Sierra Leone",
  LR: "Liberia",
  GH: "Ghana",
  NG: "Nigéria",
  FR: "France",
  US: "États-Unis",
  BE: "Belgique",
  CA: "Canada",
  DE: "Allemagne",
  ES: "Espagne",
  IT: "Italie",
  GB: "Royaume-Uni",
  PT: "Portugal",
  MA: "Maroc",
  DZ: "Algérie",
  TN: "Tunisie",
  CM: "Cameroun",
  TG: "Togo",
  BJ: "Bénin",
};

export function countryName(iso2: string): string {
  return COUNTRY_NAMES_FR[iso2.toUpperCase()] ?? iso2;
}

// ─────────────────────────────────────────────────────────────────────────
// Seuils d'engagement (règles affichées dans l'interface, §5/§6)
// ─────────────────────────────────────────────────────────────────────────

export const ENGAGED_READ_MS = 30_000; // lecture engagée : ≥ 30 s page visible
export const ABANDON_MS = 10_000; // page abandonnée : < 10 s visibles
export const HEARTBEAT_SEND_MS = 30_000; // ≤ 1 requête d'engagement / 30 s
export const SESSION_IDLE_MS = 30 * 60_000; // nouvelle session après 30 min d'inactivité
export const ENGAGEMENT_CAP_MS = 86_400_000; // 24 h max (cohérent avec la SQL)
export const DAILY_EVENT_CAP = 240; // plafond d'anti-abus par empreinte/heure

export function isEngagedRead(engagedMs: number): boolean {
  return engagedMs >= ENGAGED_READ_MS;
}

export function isAbandoned(engagedMs: number): boolean {
  return engagedMs > 0 && engagedMs < ABANDON_MS;
}

export function capEngagement(engagedMs: number): number {
  if (!Number.isFinite(engagedMs)) return 0;
  return Math.max(0, Math.min(Math.floor(engagedMs), ENGAGEMENT_CAP_MS));
}

/** Durée « estimée » lisible : 1 min 20 / 2 h 05 — jamais présentée exacte. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "0 s";
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec} s`;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return m > 0 ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
  if (m > 0) return s > 0 && m < 5 ? `${m} min ${String(s).padStart(2, "0")} s` : `${m} min`;
  return `${totalSec} s`;
}

// ─────────────────────────────────────────────────────────────────────────
// Périodes du filtre (Conakry = UTC+0 : les bornes de journée serveur
// correspondent à l'heure locale — aucune conversion trompeuse).
// ─────────────────────────────────────────────────────────────────────────

export const PERIOD_PRESETS = ["today", "yesterday", "7d", "30d", "90d"] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number] | "custom";

export function resolvePeriodRange(
  preset: string,
  customFrom?: string,
  customTo?: string
): { from: Date; to: Date } {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const endOf = (d: Date) => startOfDay(d).getTime() + 24 * 3600_000 - 1;
  switch (preset) {
    case "today":
      return { from: startOfDay(now), to: now };
    case "yesterday": {
      const y = new Date(now.getTime() - 24 * 3600_000);
      return { from: startOfDay(y), to: new Date(endOf(y)) };
    }
    case "7d":
    case "30d":
    case "90d": {
      const days = Number(preset.slice(0, -1)) || 7;
      const from = new Date(startOfDay(now).getTime() - (days - 1) * 24 * 3600_000);
      return { from, to: now };
    }
    case "custom": {
      const f = parseDayParam(customFrom);
      const t = parseDayParam(customTo);
      if (f && t && t >= f) return { from: f, to: new Date(t.getTime() + 24 * 3600_000 - 1) };
      if (f && !t) return { from: f, to: now };
      return { from: startOfDay(now), to: now }; // repli honnête : aujourd'hui
    }
    default:
      return { from: startOfDay(now), to: now };
  }
}

function parseDayParam(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [yStr, mStr, dStr] = value.split("-");
  const d = new Date(Number(yStr), Number(mStr) - 1, Number(dStr));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function previousRange(range: { from: Date; to: Date }): { from: Date; to: Date } {
  const span = range.to.getTime() - range.from.getTime();
  return { from: new Date(range.from.getTime() - span - 1), to: new Date(range.from.getTime() - 1) };
}

export const PERIOD_LABELS: Record<string, string> = {
  today: "Aujourd'hui",
  yesterday: "Hier",
  "7d": "7 derniers jours",
  "30d": "30 derniers jours",
  "90d": "90 derniers jours",
  custom: "Période personnalisée",
};

/** Variation % honnête : incomparable ou base à 0 → null (jamais de chiffre inventé). */
export function percentDelta(current: number, previous: number): number | null {
  if (!Number.isFinite(previous) || !Number.isFinite(current)) return null;
  if (previous === 0) return current > 0 ? null : 0;
  return Math.round(((current - previous) / previous) * 100);
}
