import {
  CHANNEL_ID,
  parseRssEntries,
  chooseLiveFromApi,
} from "@/lib/direct/core";
import type { Detection, RssEntry } from "@/lib/direct/core";

/**
 * Détection réelle du direct — UNIQUEMENT côté serveur :
 * • RSS officiel de la chaîne (https://www.youtube.com/feeds/videos.xml)
 *   — gratuit, sans clé, conforme aux conditions : JAMAIS de scraping
 *   HTML fragile ;
 * • YouTube Data API v3 videos.list (1 unité de quota par appel) pour
 *   CONFIRMER l'état « live » — la clé vit dans la variable
 *   d'environnement YOUTUBE_API_KEY du Worker, jamais exposée au
 *   navigateur ;
 * • cache mémoire Worker (TTL ~3 min) : quelques appels par heure même
 *   avec des dizaines de visiteurs — largement sous le quota gratuit
 *   (10 000 unités/jour) ;
 * • sans clé : statut « unconfigured » honnête — la section bascule
 *   automatiquement sur la présentation discrète (jamais de faux direct),
 *   et le mode manuel de la rédaction reste disponible sans aucune clé.
 */

const RSS_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
const API_URL = "https://www.googleapis.com/youtube/v3/videos";
const RECENT_WINDOW = 5; // vidéos récentes examinées (le RSS en fournit 15)
const CACHE_TTL_MS = 3 * 60 * 1000;

let cache: { at: number; value: Detection } | null = null;

export function resetDetectionCache(): void {
  cache = null;
}

interface ApiPayloadItem {
  id?: unknown;
  snippet?: { title?: unknown; liveBroadcastContent?: unknown } | null;
}

/** Réponse videos.list → état : SEUL `liveBroadcastContent === "live"` compte. */
function parseApiPayload(payload: unknown): Detection {
  const raw = (payload as { items?: unknown } | null)?.items;
  const items = Array.isArray(raw) ? (raw as ApiPayloadItem[]) : [];
  const live = chooseLiveFromApi(items);
  return live
    ? { status: "live", videoId: live.videoId, title: live.title }
    : { status: "none" };
}

/** Détection completée : RSS → videos.list (si clé) → état. */
export async function detectLive(): Promise<Detection> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.value;

  const value = await detectLiveUncached();
  cache = { at: now, value };
  return value;
}

async function detectLiveUncached(): Promise<Detection> {
  const apiKey = process.env.YOUTUBE_API_KEY ?? "";

  // 1) Flux RSS (gratuit, sans clé) — identifie les vidéos récentes.
  let entries: RssEntry[];
  try {
    const res = await fetch(RSS_URL, {
      cache: "no-store",
      headers: { accept: "application/xml" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return { status: "error" };
    entries = parseRssEntries(await res.text());
  } catch {
    return { status: "error" };
  }

  // 2) Confirmation via API — REQUISE pour afficher « EN DIRECT » : le RSS
  //    seul ne permet pas de distinguer une vidéo ordinaire d'un direct.
  if (!apiKey) return { status: "unconfigured" };

  const recent = entries.slice(0, RECENT_WINDOW);
  if (recent.length === 0) return { status: "none" };

  try {
    const url =
      `${API_URL}?part=snippet&maxResults=${RECENT_WINDOW}&id=` +
      recent.map((e) => e.id).join(",") +
      `&key=${apiKey}`;
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return { status: "error" };
    return parseApiPayload(await res.json());
  } catch {
    return { status: "error" };
  }
}
