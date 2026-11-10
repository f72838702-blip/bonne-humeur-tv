import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from "./config";
import { hardenedCookieOptions, isLocalhostHost } from "./cookies";

/**
 * Client lecture publique (clé anon, SANS cookies) : permet le rendu
 * statique/ISR des pages publiques. La RLS ne renvoie que les contenus
 * publiés. Null si le backend n'est pas configuré.
 *
 * noStore (facultatif) : force la lecture RESEAU à chaque rendu/re-rendu
 * ISR — destiné aux données temps réel (flash-infos) dont la valeur
 * prérendue au build précédent ne doit JAMAIS resservir. Aucun effet
 * sur les autres lectures publiques (cache du site inchangé).
 */
export function getSupabasePublicClient(options?: { noStore?: boolean }) {
  if (!isSupabaseConfigured()) return null;
  const globalFetch = options?.noStore
    ? { fetch: (url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => fetch(url, { ...init, cache: "no-store" }) }
    : undefined;
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: globalFetch,
  });
}

/**
 * Client Supabase côté serveur (Server Components / Server Actions),
 * lié à la session utilisateur via les cookies.
 * Retourne null si le backend n'est pas configuré.
 */
export async function getSupabaseServerClient() {
  if (!isSupabaseConfigured()) return null;

  const cookieStore = await cookies();
  const headerList = await headers();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          // Durcissement sécurité E1 : httpOnly/secure/sameSite forcés.
          // Le Host détecté sert à ne PAS exiger Secure sur le développement
          // local HTTP : en production (Cloudflare) le site est HTTPS seul.
          const isLocal = isLocalhostHost(headerList.get("host"));
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, hardenedCookieOptions(options, isLocal))
          );
        } catch {
          // Appel depuis un Server Component : le middleware rafraîchit les sessions.
        }
      },
    },
  });
}