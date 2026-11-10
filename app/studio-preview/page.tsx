import Link from "next/link";
import { redirect } from "next/navigation";
import { Radio } from "lucide-react";
import BreakingNews from "@/components/home/BreakingNews";
import LiveSection from "@/components/home/LiveSection";
import HomeSections from "@/components/home/HomeSections";
import AdSlot from "@/components/publicite/AdSlot";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import DesignStyle from "@/components/design/DesignStyle";
import { isSuperAdmin, getSessionInfo } from "@/lib/auth/session";
import { getDraftForUser } from "@/lib/design/data";
import { DEFAULT_DESIGN } from "@/lib/design/default";
import { getLiveVideo, getFeaturedVideo, getPublishedVideos } from "@/lib/data/videos";
import { getFeaturedArticles, getPublishedArticles } from "@/lib/data/articles";
import { getCategories } from "@/lib/data/categories";
import { getSponsoredArticleIds } from "@/lib/data/ads-public";

/**
 * PRÉVISUALISATION DU STUDIO — façade publique réelle rendue avec le
 * BROUILLON (site_design_draft de l'utilisateur), jamais avec le design
 * publié. Aucune donnée n'est écrite ici : lecture seule du brouillon.
 * Session exigée (admin/éditeur) — sans session : état neutre, aucune
 * fuite du design en cours.
 *
 * Montée dans l'iframe du Studio (desktop/tablette/mobile). URL volontairement
 * hors /admin : rendu dans le layout racine seul (aucune sidebar) — la
 * page est verrouillée par session, l'accès direct navigateur reste
 * protégé et seules les données du brouillon personnalisé apparaissent.
 */
export const revalidate = 0; // toujours frais (brouillon à chaud)

export default async function StudioPreviewPage() {
  const ok = await isSuperAdmin();
  if (!ok) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-neutral-100 p-6 text-center dark:bg-night-950">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Prévisualisation réservée au Super Administrateur — connectez-vous.
        </p>
      </div>
    );
  }

  const session = await getSessionInfo();
  if (!session) redirect("/admin/login");
  const draft = (await getDraftForUser(session.userId)).config ?? DEFAULT_DESIGN;

  // Données réelles (même requêtes que la page publique — aperçu fidèle).
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
      <DesignStyle config={draft} />
      <Header config={draft.header} />
      <BreakingNews headerBehavior={draft.header?.behavior} />
      <div className="mx-auto max-w-7xl px-4 pt-2 sm:px-6">
        <AdSlot code="home_top_banner" className="" />
      </div>
      {!liveVideo ? null : (
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
      <LiveSection />
      <HomeSections
        design={draft}
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
      <div className="flex flex-col items-center justify-between gap-3 px-4 pb-14 text-center text-xs text-neutral-400">
        <p>© 2026 Bonne Humeur Média — prévisualisation (non publiée).</p>
        <p>
          <Link href="/admin/studio" className="underline underline-offset-4">
            ← Revenir au Studio
          </Link>
        </p>
      </div>
      <Footer config={draft.footer} />
    </>
  );
}
