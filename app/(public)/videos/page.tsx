import type { Metadata } from "next";
import { Tv } from "lucide-react";
import VideoCard from "@/components/video/VideoCard";
import EmptyState from "@/components/shared/EmptyState";
import PageTitle from "@/components/shared/PageTitle";
import FilterChips from "@/components/shared/FilterChips";
import AdSlot from "@/components/publicite/AdSlot";
import { getPublishedVideos } from "@/lib/data/videos";
import { getCategories } from "@/lib/data/categories";

/**
 * Toutes les vidéos publiées — filtre par catégorie piloté par l'URL
 * (?categorie=slug) : partageable, indexable, sans état client.
 */
export const revalidate = 120;

export const metadata: Metadata = {
  title: "Vidéos & Émissions",
  description:
    "Toutes les émissions de Bonne Humeur TV : société, culture, économie, éducation et institutionnel — filtrables par thématique.",
  alternates: { canonical: "/videos" },
};

export default async function VideosPage({
  searchParams,
}: {
  searchParams: Promise<{ categorie?: string }>;
}) {
  const { categorie } = await searchParams;

  const [categories, videos] = await Promise.all([
    getCategories(),
    getPublishedVideos(60),
  ]);

  const filtered = categorie
    ? videos.filter((v) => v.categories?.slug === categorie)
    : videos;

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <PageTitle
        kicker="Programmes"
        title="Vidéos &"
        highlight="Émissions"
        subtitle="Retrouvez l'intégralité de nos programmes, filtrables par thématique."
      />

      {categories.length > 0 && (
        <div className="mt-8">
          <FilterChips categories={categories} currentSlug={categorie} basePath="/videos" />
        </div>
      )}

      <div className="mt-8">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Tv}
            title={categorie ? "Aucune vidéo dans cette catégorie" : "Aucune vidéo publiée pour le moment"}
            description={
              categorie
                ? "Les prochaines émissions de cette thématique apparaîtront ici dès leur publication."
                : "Les émissions de Bonne Humeur TV apparaîtront ici dès leur mise en ligne par la rédaction."
            }
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((video) => (
              <VideoCard key={video.slug} video={video} />
            ))}
          </div>
        )}
      </div>

      {/* Insertion publicitaire (additif) */}
      <div className="mt-10">
        <AdSlot code="videos_inline" className="" />
      </div>
    </section>
  );
}