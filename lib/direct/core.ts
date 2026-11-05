/**
 * Module DIRECT YouTube — NOYAU PUR (aucun accès réseau, aucune base).
 *
 * Philosophie (directive direction) :
 * • JAMAIS de direct fabriqué : la section « EN DIRECT » n'affiche un
 *   lecteur QUE si l'état réel est confirmé (API YouTube) OU si la
 *   rédaction a volontairement posé le lien du direct (mode manuel) ;
 * • toute autre situation = présentation discrète + bouton vers la
 *   chaîne, la rediffusion étant clairement étiquetée « rediffusion »;
 * • le flux RSS de la chaîne (15 dernières vidéos) est analysé ici de
 *   façon pure, testable, sans dépendance XML.
 */

/** Chaîne officielle @Bonnehumeurt (identifiant résolu 04/11/2026). */
export const CHANNEL_ID = "UCc7NeYxDS7k8iVgRl97uOnA";
export const CHANNEL_URL = "https://www.youtube.com/@Bonnehumeurt";

export type DirectMode = "auto" | "manual" | "off";

export interface LiveConfig {
  enabled: boolean;
  mode: DirectMode;
  manualVideoId: string | null;
  replayVideoId: string | null;
  lastState: "live" | "none" | "unconfigured" | "error" | null;
  lastCheckedAt: string | null;
}

/** Résultat d'une détection réelle côté serveur. */
export type Detection =
  | { status: "live"; videoId: string; title: string | null }
  | { status: "none" }
  | { status: "unconfigured" } // clé API absente : on NE PRÉTEND rien
  | { status: "error" };

export interface RssEntry {
  id: string;
  title: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// RSS de la chaîne (feeds/videos.xml — 15 dernières vidéos, sans clé)
// ─────────────────────────────────────────────────────────────────────────────

const ENTRY_RE = /<entry>([\s\S]*?)<\/entry>/g;
const YT_VIDEO_ID_RE = /<(?:[\w-]*:)?yt:videoId>([A-Za-z0-9_-]{11})<\/(?:[\w-]*:)?yt:videoId>/;
const FALLBACK_ID_RE = /<id>yt:video:([A-Za-z0-9_-]{11})<\/id>/;
const TITLE_RE = /<title>([\s\S]*?)<\/title>/;

/** Décodage minimal des entités XML dans un titre. */
function decodeXmlText(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Extrait les vidéos du flux RSS de la chaîne, dans l'ordre du flux
 * (le plus récent d'abord). Un flux invalide ou vide → liste vide :
 * la détection répondra honnêtement « none », jamais un faux direct.
 */
export function parseRssEntries(xml: string): RssEntry[] {
  const entries: RssEntry[] = [];
  for (const match of xml.matchAll(ENTRY_RE)) {
    const block = match[1] ?? "";
    const id =
      block.match(YT_VIDEO_ID_RE)?.[1] ?? block.match(FALLBACK_ID_RE)?.[1] ?? null;
    const title = block.match(TITLE_RE)?.[1];
    if (!id) continue; // pas une entrée vidéo (ex. entrée chaîne)
    entries.push({
      id,
      title: title ? decodeXmlText(title) : null,
    });
  }
  return entries;
}

// ─────────────────────────────────────────────────────────────────────────────
// Réponse YouTube Data API v3 — videos.list
// ─────────────────────────────────────────────────────────────────────────────

interface ApiItem {
  id?: unknown;
  snippet?: {
    title?: unknown;
    liveBroadcastContent?: unknown;
  } | null;
}

/**
 * Sélectionne le direct dans la réponse videos.list : le PREMIER item du
 * lot récent dont `liveBroadcastContent === "live"`. « upcoming » et
 * « none » sont explicitement rejetés — une émission à venir ou une
 * ordinaire vidéo ne deviennent JAMAIS un « direct ».
 */
export function chooseLiveFromApi(
  items: ApiItem[]
): { videoId: string; title: string | null } | null {
  for (const item of items) {
    const videoId = typeof item.id === "string" ? item.id : null;
    if (!videoId) continue;
    if (item.snippet?.liveBroadcastContent !== "live") continue;
    const title =
      typeof item.snippet?.title === "string" ? item.snippet.title : null;
    return { videoId, title };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Décision d'affichage — la SEULE source de vérité de la section
// ─────────────────────────────────────────────────────────────────────────────

export type LiveDecision =
  | { show: "player"; videoId: string; title: string | null }
  | {
      show: "channel";
      replayVideoId: string | null;
      reason: "not-live" | "unconfigured" | "error" | "manual-missing";
    }
  | { show: null }; // section entière masquée

/**
 * Décision pure : configuration + dernier état détecté → rendu.
 * Aucun lecteur vide, aucune ancienne diffusion présentée comme direct.
 */
export function applyLiveConfig(
  config: LiveConfig | null,
  detection: Detection | null
): LiveDecision {
  if (!config || !config.enabled || config.mode === "off") {
    return { show: null };
  }

  // Mode manuel : la rédaction GARDE la main — son lien est le direct
  // affiché, sans dépendre de l'API (secours zéro quota).
  if (config.mode === "manual") {
    return config.manualVideoId
      ? { show: "player", videoId: config.manualVideoId, title: null }
      : { show: "channel", replayVideoId: config.replayVideoId, reason: "manual-missing" };
  }

  // Mode auto : UNiquement un état confirmé « live ».
  if (detection?.status === "live") {
    return {
      show: "player",
      videoId: detection.videoId,
      title: detection.title,
    };
  }
  return {
    show: "channel",
    replayVideoId: config.replayVideoId,
    reason:
      detection?.status === "unconfigured"
        ? "unconfigured"
        : detection?.status === "error"
          ? "error"
          : "not-live",
  };
}
