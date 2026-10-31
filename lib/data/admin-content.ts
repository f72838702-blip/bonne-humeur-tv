import { getSupabaseServerClient } from "@/lib/supabase/server";
import type {
  Article,
  ArticleWithRelations,
  BreakingNewsItem,
  Category,
  ContentStatus,
  Video,
  VideoWithRelations,
} from "@/lib/types";

/**
 * Lectures STAFF du CMS : articles/vidéos/flash-infos TOUS statuts
 * (la RLS restreint déjà chaque requête au rôle de la session :
 * un reporter ne verra ici que ses propres articles, un editor/admin tout).
 * Sans backend configuré → listes vides / null + journal, jamais de
 * contenu fictif.
 */

type StaffClient = NonNullable<Awaited<ReturnType<typeof getSupabaseServerClient>>>;

const ARTICLE_FIELDS = `
  id, title, slug, excerpt, content, featured_image, category_id, author_id,
  status, published_at, scheduled_at, meta_title, meta_description,
  is_featured, created_at, updated_at,
  categories ( id, name, slug )
`;

type ArticleRow = Article & {
  categories: Pick<Category, "id" | "name" | "slug"> | null;
};

/** Bylines via la vue limitée author_names (id + nom, rien d'autre). */
async function resolveAuthorNamesStaff(
  supabase: StaffClient,
  authorIds: (string | null)[]
): Promise<Map<string, string>> {
  const ids = [...new Set(authorIds.filter((x): x is string => Boolean(x)))];
  const map = new Map<string, string>();
  if (ids.length === 0) return map;

  const { data, error } = await supabase
    .from("author_names")
    .select("id, full_name")
    .in("id", ids);

  if (error) {
    console.error("[data/admin-content] resolveAuthorNamesStaff :", error.message);
    return map;
  }
  for (const row of data ?? []) {
    map.set(row.id, row.full_name ?? "Rédaction Bonne Humeur TV");
  }
  return map;
}

function withAuthor(row: ArticleRow, names: Map<string, string>): ArticleWithRelations {
  return {
    ...row,
    author_name: row.author_id ? names.get(row.author_id) ?? null : null,
  };
}

/** Tous les articles visibles par la session (tous statuts confondus). */
export async function getStaffArticles(
  status?: ContentStatus
): Promise<ArticleWithRelations[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  let query = supabase
    .from("articles")
    .select(ARTICLE_FIELDS)
    .order("updated_at", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    console.error("[data/admin-content] getStaffArticles :", error.message);
    return [];
  }

  const rows = (data ?? []) as unknown as ArticleRow[];
  const names = await resolveAuthorNamesStaff(supabase, rows.map((r) => r.author_id));
  return rows.map((r) => withAuthor(r, names));
}

/**
 * Article par id, pour préremplir le formulaire d'édition.
 * Sous RLS : inexistant ou hors périmètre → null (refus neutre).
 */
export async function getStaffArticleById(id: string): Promise<ArticleWithRelations | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("articles")
    .select(ARTICLE_FIELDS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[data/admin-content] getStaffArticleById :", error.message);
    return null;
  }
  if (!data) return null;

  const row = data as unknown as ArticleRow;
  const names = await resolveAuthorNamesStaff(supabase, [row.author_id]);
  const article = withAuthor(row, names);

  // Tags attachés (liaison many-to-many via article_tags).
  const { data: tagRows, error: tagError } = await supabase
    .from("article_tags")
    .select("tags ( id, name, slug )")
    .eq("article_id", id);

  if (tagError) {
    console.error("[data/admin-content] getStaffArticleById tags :", tagError.message);
    return article;
  }

  article.tags = ((tagRows ?? []) as unknown as { tags: { id: string; name: string; slug: string } | null }[])
    .map((r) => r.tags)
    .filter((t): t is { id: string; name: string; slug: string } => Boolean(t));
  return article;
}

const VIDEO_FIELDS = `
  id, title, slug, description, youtube_id, thumbnail_url, category_id,
  duration, published_at, status, is_featured, is_live, created_at, updated_at,
  categories ( id, name, slug )
`;

type VideoRow = Video & {
  categories: Pick<Category, "id" | "name" | "slug"> | null;
};

/** Toutes les vidéos visibles par la session (tous statuts). */
export async function getStaffVideos(): Promise<VideoWithRelations[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("videos")
    .select(VIDEO_FIELDS)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[data/admin-content] getStaffVideos :", error.message);
    return [];
  }
  return (data ?? []) as unknown as VideoRow[];
}

export async function getStaffVideoById(id: string): Promise<VideoWithRelations | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("videos")
    .select(VIDEO_FIELDS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[data/admin-content] getStaffVideoById :", error.message);
    return null;
  }
  return (data as VideoRow | null) ?? null;
}

/** Tous les flash-infos visibles par la session (actifs ET inactifs). */
export async function getStaffBreakingNews(): Promise<BreakingNewsItem[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("breaking_news")
    .select("*")
    .order("position", { ascending: true });

  if (error) {
    console.error("[data/admin-content] getStaffBreakingNews :", error.message);
    return [];
  }
  return (data ?? []) as BreakingNewsItem[];
}