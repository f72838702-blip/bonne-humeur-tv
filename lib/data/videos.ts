import { getSupabasePublicClient } from "@/lib/supabase/server";
import type { Video, VideoWithRelations, Category } from "@/lib/types";

/**
 * Accès aux vidéos. Le public ne voit, via RLS, que les vidéos publiées.
 * Aucune statistique de vues n'est lue ou affichée (pas de faux compteurs).
 * YouTube est l'unique hébergeur : seuls l'ID et la miniature (i.ytimg,
 * jamais retéléchargée) sont utilisés — zéro bande passante applicative.
 */

const PUBLIC_FIELDS = `
  id, title, slug, description, youtube_id, thumbnail_url, category_id,
  duration, published_at, status, is_featured, is_live, position,
  created_at, updated_at,
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

  // Fenêtre élargie pour inclure les vidéos épinglées (position > 0),
  // puis tri applicatif : épinglées d'abord (position croissante),
  // ensuite ordre chronologique. Le tri final reste borné à `limit`.
  const { data, error } = await supabase
    .from("videos")
    .select(PUBLIC_FIELDS)
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(Math.min(limit * 2, 48));

  if (error) {
    console.error("[data/videos] getPublishedVideos :", error.message);
    return [];
  }
  const rows = (data ?? []) as unknown as RawRow[];
  const pinned = rows
    .filter((r) => r.position > 0)
    .sort((a, b) => a.position - b.position);
  const rest = rows
    .filter((r) => r.position === 0)
    .sort(
      (a, b) =>
        new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime()
    );
  return pinned.concat(rest).slice(0, limit).map((r) => toVideo(r));
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