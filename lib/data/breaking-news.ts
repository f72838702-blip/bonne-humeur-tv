import { getSupabasePublicClient } from "@/lib/supabase/server";
import type { BreakingNewsItem } from "@/lib/types";

/**
 * Flash-infos. La RLS ne renvoie au public que les entrées actives
 * et dans leur période de diffusion ; sans backend → bandeau masqué.
 *
 * Lecture NO-STORE : le bandeau est une donnée TEMPS RÉEL — chaque
 * rendu (et chaque re-rendu ISR) relit la table, jamais la valeur
 * figée du build précédent. Table minuscule : un seul appel léger.
 */
export async function getActiveBreakingNews(): Promise<BreakingNewsItem[]> {
  const supabase = getSupabasePublicClient({ noStore: true });
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("breaking_news")
    .select("*")
    .order("position", { ascending: true });

  if (error) {
    console.error("[data/breaking-news] getActiveBreakingNews :", error.message);
    return [];
  }
  return (data ?? []) as BreakingNewsItem[];
}