import { createHash } from "crypto";

/**
 * Identité ANONYME du visiteur public pour l'anti-abus du chatbot
 * (C5, Phase E — audit).
 *
 * • CLOUDFLARE D'ABORD : `CF-Connecting-IP` est posé par l'edge Cloudflare
 *   (non contrôlé par le client quand la requête traverse le réseau CF) —
 *   le X-Forwarded-For fourni par le client n'est PAS fiable et n'est
 *   consulté qu'en recours (développement local, hors Cloudflare).
 * • AUCUNE IP en clair : seule la SORTIE (hash tronqué, roté chaque jour
 *   UTC) est transmise aux compteurs de quota — le même motif que
 *   l'analytics (migration 0025).
 * • L'adresse réelle n'est jamais stockée ni journalisée par ce module.
 */

export function clientIpFromHeaders(
  get: (name: string) => string | null
): string {
  const cf = get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  // Recours (dev local / hors Cloudflare) : premier élément du XFF.
  const xff = get("x-forwarded-for") ?? "";
  const first = xff.split(",")[0]?.trim();
  return first ? first : "inconnu";
}

/**
 * Empreinte anti-abus : sha256("bhtv::ai::" + jour UTC + IP + UA),
 * tronquée à 48 caractères — rotation quotidienne intégrée (le jour
 * entre DANS le hash, impossible de le réutiliser le lendemain).
 */
export function publicFingerprint(
  ip: string,
  ua: string,
  now = new Date()
): string {
  const day = now.toISOString().slice(0, 10); // roté chaque jour UTC
  return createHash("sha256")
    .update(`bhtv::ai::${day}::${ip}::${ua}`)
    .digest("hex")
    .slice(0, 48);
}

/** Identité complète prête pour le quota (jamais d'IP en sortie). */
export function publicIdentifier(
  get: (name: string) => string | null,
  ua: string,
  now = new Date()
): string {
  return publicFingerprint(clientIpFromHeaders(get), ua.slice(0, 300), now);
}
