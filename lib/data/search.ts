import { getSupabasePublicClient } from "@/lib/supabase/server";

export interface SearchArticleHit {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image: string | null;
  published_at: string | null;
  category_name: string | null;
  category_slug: string | null;
}

export interface SearchVideoHit {
  id: string;
  title: string;
  slug: string;
  thumbnail_url: string | null;
  published_at: string | null;
  category_name: string | null;
  category_slug: string | null;
}

export interface SearchResults {
  articles: SearchArticleHit[];
  videos: SearchVideoHit[];
  /** true si la recherche n'a pas pu s'exécuter (backend absent/migrations non appliquées). */
  unavailable: boolean;
}

/**
 * Recherche globale (articles + vidéos publiés) via la fonction
 * RPC search_published (security definer : ne renvoie que du publié).
 */
export async function searchPublishedContent(query: string): Promise<SearchResults> {
  const supabase = getSupabasePublicClient();
  if (!supabase) return { articles: [], videos: [], unavailable: true };

  const { data, error } = await supabase.rpc("search_published", {
    p_query: query,
    p_limit: 20,
  });

  if (error) {
    // 42883 : fonction inexistante → migrations non appliquées
    console.error("[data/search] searchPublishedContent :", error.message);
    return { articles: [], videos: [], unavailable: true };
  }

  const parsed = (data ?? {}) as {
    articles?: SearchArticleHit[];
    videos?: SearchVideoHit[];
  };
  return {
    articles: parsed.articles ?? [],
    videos: parsed.videos ?? [],
    unavailable: false,
  };
}