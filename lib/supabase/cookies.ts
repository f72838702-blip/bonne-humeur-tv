import { DEFAULT_COOKIE_OPTIONS } from "@supabase/ssr";

/**
 * Durcissement des cookies de session Supabase (audit sécurité E1, nov. 2026).
 * Les défauts de @supabase/ssr sont httpOnly:false / sameSite:lax / maxAge
 * 400 jours : les jetons de session seraient lisibles par tout JavaScript de
 * la page (danger aggravé par 'unsafe-inline' dans la CSP, requis par Next).
 * L'application NE lit JAMAIS la session côté navigateur (connexion 100 %
 * serveur, aucun createBrowserClient) → httpOnly:true est sans régression.
 * La vérification `isLocalhost` évite d'étrangler le développement local HTTP
 * (next start) : en production Cloudflare le site est HTTPS uniquement.
 *
 * Ne change aucun comportement applicatif : les mêmes cookies, les mêmes
 * noms, la même taille — uniquement des attributs plus sûrs à la pose.
 */

export function isLocalhostHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const hostname = host.split(":")[0].toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".localhost");
}

/**
 * Options durcies pour un cookie de session : surchage les options proposées
 * par @supabase/ssr (nom/durée/chunks toujours conservés, attributs forcés).
 * `undefined` → options par défaut durcies (pose initiale).
 */
export function hardenedCookieOptions(
  base: Record<string, unknown> | undefined,
  isLocalhost = false
): Record<string, unknown> {
  return {
    ...DEFAULT_COOKIE_OPTIONS,
    ...(base ?? {}),
    httpOnly: true,
    sameSite: "lax",
    secure: !isLocalhost,
  };
}
