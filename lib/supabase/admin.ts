import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./config";

/**
 * ⚠️ CLIENT PRIVILÉGIÉ — RÉSERVÉ AU SERVEUR.
 * Utilise SUPABASE_SERVICE_ROLE_KEY (contourne RLS). Ne doit JAMAIS être
 * importé depuis un composant client ou un bundle navigateur.
 *
 * Retourne null si la clé n'est pas configurée : les traitements concernés
 * (rate limiting RPC, gestion des utilisateurs Auth, nettoyage Storage)
 * sont alors désactivés et documentés comme tels.
 */
export function getSupabaseAdminClient(): SupabaseClient | null {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!SUPABASE_URL || !serviceRoleKey) return null;

  return createClient(SUPABASE_URL, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}