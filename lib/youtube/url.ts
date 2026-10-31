/**
 * Extraction d'identifiant YouTube — validation stricte des domaines.
 *
 * Formats acceptés (directive §1) :
 *   • https://www.youtube.com/watch?v=ID  (aussi m.youtube.com, music.)
 *   • https://youtu.be/ID
 *   • https://www.youtube.com/embed/ID
 *   • https://www.youtube.com/live/ID
 *   • l'identifiant brut (11 caractères)
 *
 * Toute autre source (URL externe arbitraire, autre domaine) est REFUSÉE.
 * Aucune vidéo n'est jamais hébergée, téléchargée ou re-diffusée par le
 * serveur applicatif : YouTube reste l'unique hébergeur.
 */

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

/** Domaines YouTube strictement autorisés. */
const ALLOWED_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
  "youtu.be",
  "www.youtu.be",
]);

/** URL de lecture standard (youtube-nocookie pour l'embed). */
export function youtubeEmbedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}`;
}

/** URL de partage/consultation publique. */
export function youtubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

/** Miniature YouTube (jamais téléchargée dans notre stockage). */
export function youtubeThumbnailUrl(id: string, quality: "mq" | "hq" | "maxres" = "hq"): string {
  return `https://i.ytimg.com/vi/${id}/${quality}default.jpg`;
}

/**
 * Extrait l'ID d'une saisie utilisateur (URL YouTube ou ID brut).
 * Retourne null si la source n'est pas YouTube ou l'ID invalide —
 * une URL externe arbitraire ne peut JAMAIS devenir une « source vidéo ».
 */
export function extractYouTubeId(input: string): string | null {
  const value = input.trim();
  if (!value) return null;

  // Saisie directe de l'identifiant (11 caractères)
  if (YT_ID.test(value)) return value;

  // URL — seul http/https est accepté, pas de schéma relatif ambigu
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) return null;

  const host = url.hostname.toLowerCase();
  const path = url.pathname.replace(/\/+$/, "");
  const segments = path.split("/").filter(Boolean);

  // youtu.be/ID
  if (host.endsWith("youtu.be")) {
    return YT_ID.test(segments[0] ?? "") ? segments[0] : null;
  }

  // youtube.com/watch?v=ID (v peut aussi arriver dans le chemin ?v=)
  if (segments.length <= 1) {
    const v = url.searchParams.get("v");
    return v && YT_ID.test(v) ? v : null;
  }

  // youtube.com/embed/ID · youtube.com/live/ID · youtube.com/shorts/ID
  if (["embed", "live", "shorts", "v"].includes(segments[0])) {
    return YT_ID.test(segments[1] ?? "") ? segments[1] : null;
  }

  return null;
}

/** Convertit une durée ISO 8601 (PT12M45S) en affichage lisible (12:45). */
export function isoDurationToDisplay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!match) return null;
  const h = Number(match[1] ?? 0);
  const m = Number(match[2] ?? 0);
  const s = Number(match[3] ?? 0);
  const mm = String(m).padStart(h > 0 ? 2 : 1, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}