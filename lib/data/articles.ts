import { getSupabasePublicClient } from "@/lib/supabase/server";
import type { Article, ArticleWithRelations, Category } from "@/lib/types";

/**
 * Accès aux articles. Le public ne voit, via RLS, que les articles
 * publiés (status='published' AND published_at <= now()).
 * Sans backend → listes vides, jamais de contenu fictif.
 */

const PUBLIC_FIELDS = `
  id, title, slug, excerpt, content, featured_image, category_id, author_id,
  status, published_at, scheduled_at, meta_title, meta_description,
  created_at, updated_at,
  categories ( id, name, slug )
`;

type RawRow = Omit<Article, "category_id" | "author_id"> & {
  category_id: string | null;
  author_id: string | null;
  categories: Pick<Category, "id" | "name" | "slug"> | null;
};

/** Bylines publiques via la vue limitée author_names (id + nom, rien d'autre). */
export async function resolveAuthorNames(
  authorIds: (string | null)[]
): Promise<Map<string, string>> {
  const ids = [...new Set(authorIds.filter((x): x is string => Boolean(x)))];
  const map = new Map<string, string>();
  if (ids.length === 0) return map;

  const supabase = getSupabasePublicClient();
  if (!supabase) return map;

  const { data, error } = await supabase
    .from("author_names")
    .select("id, full_name")
    .in("id", ids);

  if (error) {
    console.error("[data/articles] resolveAuthorNames :", error.message);
    return map;
  }
  for (const row of data ?? []) {
    map.set(row.id, row.full_name ?? "Rédaction Bonne Humeur TV");
  }
  return map;
}

function withRelations(
  row: RawRow,
  authorNames: Map<string, string>
): ArticleWithRelations {
  return {
    ...row,
    author_name: row.author_id ? authorNames.get(row.author_id) ?? null : null,
  };
}

export interface ArticleListParams {
  categorySlug?: string;
  page?: number;
  perPage?: number;
  featuredOnly?: boolean;
}

export interface ArticleListResult {
  items: ArticleWithRelations[];
  total: number;
  page: number;
  perPage: number;
}

/** Liste paginée des articles publiés (ordre chronologique inverse). */
export async function getPublishedArticles(
  params: ArticleListParams = {}
): Promise<ArticleListResult> {
  const page = Math.max(1, params.page ?? 1);
  const perPage = Math.min(24, params.perPage ?? 9);
  const empty: ArticleListResult = { items: [], total: 0, page, perPage };

  const supabase = getSupabasePublicClient();
  if (!supabase) return empty;

  let query = supabase
    .from("articles")
    .select(PUBLIC_FIELDS, { count: "exact" })
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false });

  if (params.categorySlug) {
    query = query.eq("categories.slug", params.categorySlug);
  }
  if (params.featuredOnly) {
    query = query.eq("is_featured", true);
  }

  const { data, count, error } = await query.range(
    (page - 1) * perPage,
    page * perPage - 1
  );

  if (error) {
    console.error("[data/articles] getPublishedArticles :", error.message);
    return empty;
  }

  const rows = (data ?? []) as unknown as RawRow[];
  const names = await resolveAuthorNames(rows.map((r) => r.author_id));
  return {
    items: rows.map((r) => withRelations(r, names)),
    total: count ?? 0,
    page,
    perPage,
  };
}

export async function getPublishedArticleBySlug(
  slug: string
): Promise<ArticleWithRelations | null> {
  const supabase = getSupabasePublicClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("articles")
    .select(PUBLIC_FIELDS)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    console.error("[data/articles] getPublishedArticleBySlug :", error.message);
    return null;
  }
  if (!data) return null;

  const row = data as unknown as RawRow;
  const names = await resolveAuthorNames([row.author_id]);
  return withRelations(row, names);
}

/** Articles à la une pour l'accueil (marqués is_featured, sinon les plus récents). */
export async function getFeaturedArticles(limit = 3): Promise<ArticleWithRelations[]> {
  const featured = await getPublishedArticles({ perPage: limit, page: 1, featuredOnly: true });
  if (featured.items.length > 0) return featured.items.slice(0, limit);
  const latest = await getPublishedArticles({ perPage: limit, page: 1 });
  return latest.items.slice(0, limit);
}

/** Articles similaires : même catégorie d'abord, puis plus récents. */
export async function getRelatedArticles(
  article: ArticleWithRelations,
  limit = 3
): Promise<ArticleWithRelations[]> {
  const supabase = getSupabasePublicClient();
  if (!supabase) return [];

  const sameCategory = article.categories
    ? await getPublishedArticles({ categorySlug: article.categories.slug, perPage: limit + 1 })
    : { items: [] as ArticleWithRelations[], total: 0, page: 1, perPage: limit + 1 };

  const related = sameCategory.items.filter((a) => a.id !== article.id);
  if (related.length >= limit) return related.slice(0, limit);

  const latest = await getPublishedArticles({ perPage: limit + related.length + 1 });
  const seen = new Set([article.id, ...related.map((a) => a.id)]);
  for (const candidate of latest.items) {
    if (related.length >= limit) break;
    if (!seen.has(candidate.id)) {
      related.push(candidate);
      seen.add(candidate.id);
    }
  }
  return related.slice(0, limit);
}