import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from "./config";

/**
 * Client lecture publique (clé anon, SANS cookies) : permet le rendu
 * statique/ISR des pages publiques. La RLS ne renvoie que les contenus
 * publiés. Null si le backend n'est pas configuré.
 */
export function getSupabasePublicClient() {
  if (!isSupabaseConfigured()) return null;
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
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

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Appel depuis un Server Component : le middleware rafraîchit les sessions.
        }
      },
    },
  });
}