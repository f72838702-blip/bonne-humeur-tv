import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { DashboardStats } from "@/lib/types";

/**
 * Statistiques réelles du tableau de bord, calculées par la base.
 * Chaque compteur est un `count` authentique — jamais de chiffre fictif.
 */
export async function getDashboardStats(): Promise<DashboardStats | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const [
    articlesPublished,
    articlesDraft,
    articlesReview,
    articlesScheduled,
    videosPublished,
    breakingNewsActive,
    partnershipRequests,
    contactMessagesNew,
  ] = await Promise.all([
    supabase.from("articles").select("id", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("articles").select("id", { count: "exact", head: true }).eq("status", "draft"),
    supabase.from("articles").select("id", { count: "exact", head: true }).eq("status", "review"),
    supabase.from("articles").select("id", { count: "exact", head: true }).eq("status", "scheduled"),
    supabase.from("videos").select("id", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("breaking_news").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("partnership_requests").select("id", { count: "exact", head: true }),
    supabase.from("contact_messages").select("id", { count: "exact", head: true }).eq("status", "new"),
  ]);

  return {
    articlesPublished: articlesPublished.count ?? 0,
    articlesDraft: articlesDraft.count ?? 0,
    articlesReview: articlesReview.count ?? 0,
    articlesScheduled: articlesScheduled.count ?? 0,
    videosPublished: videosPublished.count ?? 0,
    breakingNewsActive: breakingNewsActive.count ?? 0,
    partnershipRequests: partnershipRequests.count ?? 0,
    contactMessagesNew: contactMessagesNew.count ?? 0,
  };
}