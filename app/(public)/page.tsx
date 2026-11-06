import type { Metadata } from "next";
import Link from "next/link";
import BreakingNews from "@/components/home/BreakingNews";
import LiveSection from "@/components/home/LiveSection";
import AdSlot from "@/components/publicite/AdSlot";
import HomeSections from "@/components/home/HomeSections";
import { Radio } from "lucide-react";
import { getSponsoredArticleIds } from "@/lib/data/ads-public";
import { getFeaturedVideo, getLiveVideo, getPublishedVideos } from "@/lib/data/videos";
import { getFeaturedArticles, getPublishedArticles } from "@/lib/data/articles";
import { getCategories } from "@/lib/data/categories";
import { getPublishedDesignCached } from "@/lib/design/data";
import { DEFAULT_DESIGN } from "@/lib/design/default";

/**
 * Accueil — 100 % données réelles (base via RLS). Sans contenu publié,
 * la page affiche des états vides honnêtes : aucun mock, aucun faux
 * lecteur, aucun faux compteur. Rendu ISR (revalidate) possible car
 * les lectures passent par le client public sans cookies.
 *
 * Studio de design : le rendu des sections vit dans HomeSections
 * (design publié) — la config absent/invalide = DEFAULT_DESIGN =
 * l'ordre historique EXACT. Le mobilier permanent (BreakingNews, bannière
 * pub haute, bandeau EN DIRECT, module Live) reste HORS config
 * (protection §8) et les positions pub home_inline/home_promo_strip
 * restent accrochées à leurs sections dans HomeSections.
 */
export const revalidate = 120;

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const design = (await getPublishedDesignCached()).config ?? DEFAULT_DESIGN;

  const [liveVideo, featuredVideo, videos, featuredArticles, latestArticles, sponsoredIds, categories] =
    await Promise.all([
      getLiveVideo(),
      getFeaturedVideo(),
      getPublishedVideos(6),
      getFeaturedArticles(3),
      getPublishedArticles({ perPage: 4 }),
      getSponsoredArticleIds(),
      getCategories(),
    ]);

  const hasContent = featuredVideo !== null || latestArticles.items.length > 0;

  return (
    <>
      <BreakingNews />

      {/* ─── Bannière publicitaire haute (position FIXE — règle §8) ─── */}
      <div className="mx-auto max-w-7xl px-4 pt-2 sm:px-6">
        <AdSlot code="home_top_banner" className="" />
      </div>

      {/* ─── Direct réel : uniquement si la rédaction a activé is_live ─── */}
      {liveVideo && (
        <Link
          href={`/videos/${liveVideo.slug}`}
          className="flex items-center justify-center gap-2.5 bg-guinea-red px-4 py-2.5 text-center text-sm font-bold text-white transition-colors hover:bg-guinea-red/90"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute h-full w-full animate-ping rounded-full bg-surface opacity-75" />
            <span className="relative h-2.5 w-2.5 rounded-full bg-surface" />
          </span>
          <Radio className="h-4 w-4" />
          EN DIRECT MAINTENANT : {liveVideo.title}
        </Link>
      )}

      {/* ─── Section « EN DIRECT » YouTube (module live — mobilier permanent) ─── */}
      <LiveSection />

      <HomeSections
        design={design}
        data={{
          featuredVideo,
          videos,
          featuredArticles,
          latestArticles: latestArticles.items,
          categoryIdBySlug: categories.map((c) => ({ slug: c.slug, name: c.name })),
          sponsoredIds,
          hasContent,
        }}
      />
    </>
  );
}
