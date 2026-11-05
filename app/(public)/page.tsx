import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Newspaper, Radio, Tv } from "lucide-react";
import BreakingNews from "@/components/home/BreakingNews";
import HeroPlayer from "@/components/home/HeroPlayer";
import LiveSection from "@/components/home/LiveSection";
import VideosGrid from "@/components/home/VideosGrid";
import B2BCta from "@/components/home/B2BCta";
import ArticleCard from "@/components/shared/ArticleCard";
import EmptyState from "@/components/shared/EmptyState";
import Reveal from "@/components/shared/Reveal";
import AdSlot from "@/components/publicite/AdSlot";
import PartnerShowcase from "@/components/publicite/PartnerShowcase";
import { getSponsoredArticleIds } from "@/lib/data/ads-public";
import { getFeaturedVideo, getLiveVideo, getPublishedVideos } from "@/lib/data/videos";
import { getFeaturedArticles, getPublishedArticles } from "@/lib/data/articles";
import { formatDate } from "@/lib/utils";

/**
 * Accueil — 100 % données réelles (base via RLS). Sans contenu publié,
 * la page affiche des états vides honnêtes : aucun mock, aucun faux
 * lecteur, aucun faux compteur. Rendu ISR (revalidate) possible car
 * les lectures passent par le client public sans cookies.
 */
export const revalidate = 120;

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const [liveVideo, featuredVideo, videos, featuredArticles, latestArticles, sponsoredIds] =
    await Promise.all([
      getLiveVideo(),
      getFeaturedVideo(),
      getPublishedVideos(6),
      getFeaturedArticles(3),
      getPublishedArticles({ perPage: 4 }),
      getSponsoredArticleIds(),
    ]);

  const sponsored = new Set(sponsoredIds);

  const sideArticles = latestArticles.items;
  const hasContent = featuredVideo !== null || sideArticles.length > 0;

  return (
    <>
      <BreakingNews />

      {/* ─── Bannière publicitaire haute (additif — rien n'est masqué) ─── */}
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
            <span className="absolute h-full w-full animate-ping rounded-full bg-white opacity-75" />
            <span className="relative h-2.5 w-2.5 rounded-full bg-white" />
          </span>
          <Radio className="h-4 w-4" />
          EN DIRECT MAINTENANT : {liveVideo.title}
        </Link>
      )}

      {/* ─── Section « EN DIRECT » YouTube (module live, additive) ─── */}
      <LiveSection />


      {/* ─── Hero : vidéo à la une + dernières actualités ─── */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Reveal>
          <h1 className="mb-5 flex items-center gap-3 font-display text-xl font-extrabold sm:text-2xl">
            En ce moment sur <span className="text-guinea-red">Bonne Humeur TV</span>
          </h1>
        </Reveal>
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Reveal>
            {featuredVideo ? (
              <HeroPlayer video={featuredVideo} />
            ) : (
              <EmptyState
                icon={Tv}
                title="La Web TV est en cours de préparation"
                description="Les premières émissions officielles de Bonne Humeur TV arrivent bientôt. Revenez très vite !"
              />
            )}
          </Reveal>

          <Reveal delay={120} className="flex flex-col">
            <aside className="flex h-full flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-white/10 dark:bg-night-800">
              <h2 className="flex items-center gap-2 font-display text-sm font-extrabold uppercase tracking-widest text-guinea-red">
                <Newspaper className="h-4 w-4" />
                Dernières actualités
              </h2>
              {sideArticles.length === 0 ? (
                <p className="rounded-xl bg-neutral-100 px-4 py-6 text-center text-sm text-neutral-500 dark:bg-white/5 dark:text-neutral-400">
                  Aucune actualité publiée pour le moment.
                </p>
              ) : (
                sideArticles.map((article) => (
                  <Link
                    key={article.slug}
                    href={`/actualites/${article.slug}`}
                    className="group rounded-xl p-3 transition-colors hover:bg-neutral-100 dark:hover:bg-white/5"
                  >
                    {article.categories && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-guinea-green">
                        {article.categories.name}
                      </span>
                    )}
                    <p className="mt-1 line-clamp-2 text-sm font-bold leading-snug transition-colors group-hover:text-guinea-red">
                      {article.title}
                    </p>
                    {article.published_at && (
                      <span className="mt-1.5 flex items-center gap-1 text-[11px] text-neutral-400">
                        <CalendarDays className="h-3 w-3" />
                        {formatDate(article.published_at)}
                      </span>
                    )}
                  </Link>
                ))
              )}
              <Link
                href="/actualites"
                className="mt-auto text-center text-sm font-bold text-guinea-red underline-offset-4 hover:underline"
              >
                Toutes les actualités →
              </Link>
            </aside>
          </Reveal>
        </div>
      </section>

      {/* ─── État global honnête tant qu'aucun contenu n'est publié ─── */}
      {!hasContent && (
        <section className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
          <EmptyState
            icon={Newspaper}
            title="La plateforme est en cours de préparation"
            description="Les articles et émissions publiés par la rédaction apparaîtront ici dès leur mise en ligne officielle."
          />
        </section>
      )}

      {/* ─── Actualités à la une ─── */}
      {featuredArticles.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-extrabold sm:text-3xl">
                L&apos;actualité de la <span className="text-guinea-red">rédaction</span>
              </h2>
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                Société, politique, économie, culture — l&apos;information
                vérifiée, en direct de Conakry.
              </p>
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featuredArticles.map((article) => (
              <Reveal key={article.id}>
                <ArticleCard article={article} sponsored={sponsored.has(article.id)} />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* ─── Insertion publicitaire entre les sections (additif) ─── */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <AdSlot code="home_inline" />
      </div>

      {/* ─── Dernières vidéos ─── */}
      {videos.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
          <div className="mb-6">
            <h2 className="font-display text-2xl font-extrabold sm:text-3xl">
              Nos dernières <span className="text-guinea-red">émissions</span>
            </h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Toute l&apos;actualité en vidéo, produite par la rédaction de
              Bonne Humeur TV.
            </p>
          </div>
          <VideosGrid videos={videos.slice(0, 6)} />
        </section>
      )}

      {/* ─── Bandeau promotionnel (additif) ─── */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <AdSlot code="home_promo_strip" className="" />
      </div>

      {/* ─── Section vitrine B2B ─── */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <Reveal>
          <B2BCta />
        </Reveal>
      </section>
      {/* ─── Partenaires officiels (additif) ─── */}
      <PartnerShowcase className="mx-auto mb-16 max-w-7xl px-4 sm:px-6" />
    </>
  );
}