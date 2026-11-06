import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Newspaper } from "lucide-react";
import ArticleCard from "@/components/shared/ArticleCard";
import EmptyState from "@/components/shared/EmptyState";
import PageTitle from "@/components/shared/PageTitle";
import FilterChips from "@/components/shared/FilterChips";
import Pagination from "@/components/shared/Pagination";
import { getPublishedArticles } from "@/lib/data/articles";
import { getCategories, getCategoryBySlug } from "@/lib/data/categories";

/** Rubrique : articles publiés d'une catégorie réelle (notFound si inconnue). */
export const revalidate = 120;

type Params = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
};

const PER_PAGE = 9;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: "Rubrique introuvable" };

  return {
    title: category.name,
    description:
      category.description ??
      `Toute l'actualité « ${category.name} » de la rédaction de Bonne Humeur TV.`,
    alternates: { canonical: `/actualites/categorie/${category.slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: Params) {
  const [{ slug }, { page: pageParam }] = await Promise.all([params, searchParams]);
  const page = Math.max(1, Number(pageParam) || 1);

  const [category, categories] = await Promise.all([
    getCategoryBySlug(slug),
    getCategories(),
  ]);
  if (!category) notFound();

  const result = await getPublishedArticles({
    page,
    perPage: PER_PAGE,
    categorySlug: category.slug,
  });
  const totalPages = Math.max(1, Math.ceil(result.total / PER_PAGE));

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <PageTitle
        kicker="Rubrique"
        title="Rubrique"
        highlight={category.name}
        subtitle={category.description ?? undefined}
      />
      {/* L'ancien bloc doublonné (h1 + description) est remplacé par le
          composant unifié — description passée en sous-titre ci-dessus. */}

      {categories.length > 0 && (
        <div className="mt-8">
          <FilterChips
            categories={categories}
            currentSlug={category.slug}
            basePath="/actualites"
          />
        </div>
      )}

      <div className="mt-8">
        {result.items.length === 0 ? (
          <EmptyState
            icon={Newspaper}
            title="Aucun article dans cette rubrique"
            description="Les prochains articles de cette rubrique apparaîtront ici dès leur publication par la rédaction."
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
            ? `/actualites/categorie/${category.slug}`
            : `/actualites/categorie/${category.slug}?page=${p}`
        }
      />
    </section>
  );
}