import { getSupabasePublicClient } from "@/lib/supabase/server";
import type { BreakingNewsItem } from "@/lib/types";

/**
 * Flash-infos. La RLS ne renvoie au public que les entrées actives
 * et dans leur période de diffusion ; sans backend → bandeau masqué.
 */
export async function getActiveBreakingNews(): Promise<BreakingNewsItem[]> {
  const supabase = getSupabasePublicClient();
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