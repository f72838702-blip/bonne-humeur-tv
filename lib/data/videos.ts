import { getSupabasePublicClient } from "@/lib/supabase/server";
import type { Video, VideoWithRelations, Category } from "@/lib/types";

/**
 * Accès aux vidéos. Le public ne voit, via RLS, que les vidéos publiées.
 * Aucune statistique de vues n'est lue ou affichée (pas de faux compteurs).
 */

const PUBLIC_FIELDS = `
  id, title, slug, description, youtube_id, thumbnail_url, category_id,
  duration, published_at, status, is_featured, is_live, created_at, updated_at,
  categories ( id, name, slug )
`;

type RawRow = Video & {
  categories: Pick<Category, "id" | "name" | "slug"> | null;
};

function toVideo(row: RawRow): VideoWithRelations {
  return { ...row };
}

export async function getPublishedVideos(limit = 12): Promise<VideoWithRelations[]> {
  const supabase = getSupabasePublicClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("videos")
    .select(PUBLIC_FIELDS)
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    console.error("[data/videos] getPublishedVideos :", error.message);
    return [];
  }
  return (data ?? []).map((r) => toVideo(r as unknown as RawRow));
}

/** Vidéo à la une (is_featured publiée la plus récente ; sinon la plus récente). */
export async function getFeaturedVideo(): Promise<VideoWithRelations | null> {
  const supabase = getSupabasePublicClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("videos")
    .select(PUBLIC_FIELDS)
    .eq("status", "published")
    .eq("is_featured", true)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[data/videos] getFeaturedVideo :", error.message);
    return null;
  }
  if (data) return toVideo(data as unknown as RawRow);

  // Pas de vidéo mise en avant : la plus récente publiée.
  const fallback = await getPublishedVideos(1);
  return fallback[0] ?? null;
}

/** Direct RÉEL : une vidéo publiée marquée is_live par la rédaction. */
export async function getLiveVideo(): Promise<VideoWithRelations | null> {
  const supabase = getSupabasePublicClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("videos")
    .select(PUBLIC_FIELDS)
    .eq("status", "published")
    .eq("is_live", true)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[data/videos] getLiveVideo :", error.message);
    return null;
  }
  return data ? toVideo(data as unknown as RawRow) : null;
}

export async function getPublishedVideoBySlug(
  slug: string
): Promise<VideoWithRelations | null> {
  const supabase = getSupabasePublicClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("videos")
    .select(PUBLIC_FIELDS)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    console.error("[data/videos] getPublishedVideoBySlug :", error.message);
    return null;
  }
  return data ? toVideo(data as unknown as RawRow) : null;
}

/** Recommandations : même catégorie d'abord, puis plus récentes. */
export async function getRelatedVideos(
  video: VideoWithRelations,
  limit = 3
): Promise<VideoWithRelations[]> {
  const all = await getPublishedVideos(24);
  const sameCategory = all.filter(
    (v) => v.slug !== video.slug && v.category_id && v.category_id === video.category_id
  );
  const others = all.filter((v) => v.slug !== video.slug && (!v.category_id || v.category_id !== video.category_id));
  return sameCategory.concat(others).slice(0, limit);
}