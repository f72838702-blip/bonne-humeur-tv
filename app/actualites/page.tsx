import type { Metadata } from "next";
import { Newspaper } from "lucide-react";
import ArticleCard from "@/components/shared/ArticleCard";
import EmptyState from "@/components/shared/EmptyState";
import FilterChips from "@/components/shared/FilterChips";
import Pagination from "@/components/shared/Pagination";
import { getPublishedArticles } from "@/lib/data/articles";
import { getCategories } from "@/lib/data/categories";

/**
 * Toutes les actualités publiées — pagination serveur (?page=N) et filtre
 * par catégorie (?categorie=slug), tous deux pilotés par l'URL.
 */
export const revalidate = 120;

export const metadata: Metadata = {
  title: "Actualités",
  description:
    "Toute l'actualité de Bonne Humeur TV : société, politique, économie, culture, sport et éducation — l'information vérifiée en direct de Conakry, Guinée.",
  alternates: { canonical: "/actualites" },
};

const PER_PAGE = 9;

export default async function ActualitesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; categorie?: string }>;
}) {
  const { page: pageParam, categorie } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const [categories, result] = await Promise.all([
    getCategories(),
    getPublishedArticles({
      page,
      perPage: PER_PAGE,
      categorySlug: categorie,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(result.total / PER_PAGE));

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
        Toutes les <span className="text-guinea-red">actualités</span>
      </h1>
      <p className="mt-2 max-w-xl text-sm text-neutral-500 dark:text-neutral-400">
        L&apos;information vérifiée de la rédaction de Bonne Humeur TV.
      </p>

      {categories.length > 0 && (
        <div className="mt-8">
          <FilterChips
            categories={categories}
            currentSlug={categorie}
            basePath="/actualites"
          />
        </div>
      )}

      <div className="mt-8">
        {result.items.length === 0 ? (
          <EmptyState
            icon={Newspaper}
            title={categorie ? "Aucun article dans cette rubrique" : "Aucune actualité publiée pour le moment"}
            description={
              categorie
                ? "Les prochains articles de cette rubrique apparaîtront ici dès leur publication par la rédaction."
                : "Les articles de la rédaction de Bonne Humeur TV apparaîtront ici dès leur mise en ligne officielle."
            }
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {result.items.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        )}
      </div>

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        buildHref={(p) =>
          p === 1
            ? categorie
              ? `/actualites?categorie=${categorie}`
              : "/actualites"
            : `/actualites?${new URLSearchParams({
                ...(categorie ? { categorie } : {}),
                page: String(p),
              }).toString()}`
        }
      />
    </section>
  );
}