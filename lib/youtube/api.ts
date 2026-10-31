/**
 * Client YouTube Data API v3 — SERVEUR UNIQUEMENT.
 *
 * • La clé API (YOUTUBE_API_KEY) ne quitte jamais le serveur ; elle n'est
 *   jamais préfixée NEXT_PUBLIC_ et n'est jamais lue côté navigateur.
 * • Cache TTL en mémoire (1 h) : réduit fortement les appels répétés et
 *   protège le quota de l'API ; en serverless, le cache est par instance
 *   — les ISR/revalidate (contenus publics) limitent de surcroît les appels.
 * • API NON configurée → retour null : l'ajout manuel reste toujours
 *   possible (la médiathèque ne dépend jamais du service externe).
 */

import { isoDurationToDisplay } from "./url";

export interface YouTubeVideoMeta {
  id: string;
  title: string | null;
  description: string | null;
  /** Miniature la meilleure disponible (i.ytimg, jamais retéléchargée). */
  thumbnailUrl: string | null;
  /** Durée affichable (ex : 12:45) — convertie depuis ISO 8601. */
  duration: string | null;
  publishedAt: string | null;
  /** liveBroadcastContent : "live" | "upcoming" | "none" (état réel YouTube). */
  liveBroadcastContent: "live" | "upcoming" | "none" | null;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 h
const cache = new Map<string, { value: YouTubeVideoMeta | null; expiresAt: number }>();

export function isYouTubeApiConfigured(): boolean {
  return (process.env.YOUTUBE_API_KEY ?? "").length > 0;
}

/**
 * Métadonnées publiques d'une vidéo YouTube.
 * Retourne null si : clé absente, vidéo introuvable, erreur réseau/API
 * (jamais d'exception vers l'appelant — l'ajout manuel reste possible).
 */
export async function fetchYouTubeVideoMeta(
  videoId: string
): Promise<YouTubeVideoMeta | null> {
  const key = process.env.YOUTUBE_API_KEY ?? "";
  if (!key) return null;

  const cached = cache.get(videoId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  let result: YouTubeVideoMeta | null = null;
  try {
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "snippet,contentDetails");
    url.searchParams.set("id", videoId);
    url.searchParams.set("key", key);

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const data = (await res.json()) as {
        items?: {
          snippet?: {
            title?: string;
            description?: string;
            thumbnails?: Record<string, { url?: string }>;
            publishedAt?: string;
            liveBroadcastContent?: string;
          };
          contentDetails?: { duration?: string };
        }[];
      };
      const item = data.items?.[0];
      if (item?.snippet) {
        const thumbs = item.snippet.thumbnails ?? {};
        const best =
          thumbs.maxres?.url ?? thumbs.standard?.url ?? thumbs.high?.url ??
          thumbs.medium?.url ?? thumbs.default?.url ?? null;
        const live = item.snippet.liveBroadcastContent;
        result = {
          id: videoId,
          title: item.snippet.title ?? null,
          description: item.snippet.description ?? null,
          thumbnailUrl: best,
          duration: null, // converti ci-dessous depuis contentDetails
          publishedAt: item.snippet.publishedAt ?? null,
          liveBroadcastContent:
            live === "live" || live === "upcoming" ? live : "none",
        };
        if (item.contentDetails?.duration) {
          result.duration = isoDurationToDisplay(item.contentDetails.duration);
        }
      }
    } else {
      console.error("[youtube/api] HTTP", res.status, "pour", videoId);
    }
  } catch (error) {
    console.error("[youtube/api] fetchYouTubeVideoMeta :", error);
  }

  cache.set(videoId, { value: result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}