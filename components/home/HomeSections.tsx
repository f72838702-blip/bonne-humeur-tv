import { Fragment } from "react";
import Link from "next/link";
import { CalendarDays, Newspaper, Tv, ArrowRight } from "lucide-react";
import HeroPlayer from "@/components/home/HeroPlayer";
import VideosGrid from "@/components/home/VideosGrid";
import B2BCta from "@/components/home/B2BCta";
import ArticleCard from "@/components/shared/ArticleCard";
import EmptyState from "@/components/shared/EmptyState";
import Reveal from "@/components/shared/Reveal";
import AdSlot from "@/components/publicite/AdSlot";
import PartnerShowcase from "@/components/publicite/PartnerShowcase";
import { SectionTitle } from "@/components/shared/PageTitle";
import type { DesignConfig, HomeSection } from "@/lib/design/schema";
import type { ArticleWithRelations, VideoWithRelations } from "@/lib/types";
import { formatDate } from "@/lib/utils";

/**
 * SECTIONS DE LA PAGE D'ACCUEIL — composant serveur réutilisable par :
 *  • la page d'accueil publique (design publié) ;
 *  • la prévisualisation du Studio de design (brouillon).
 * PUR RENDU : reçoit déjà les données (aucune lecture base ici) —
 * la config ne porte que l'ordre, la visibilité, les titres, les
 * colonnes. Texte JSX pur (React échappe) — jamais d'HTML brut du Studio.
 */

/** Grilles par défaut = rendu historique (config sans colonne). */
const DEFAULT_GRID: Record<HomeSection["id"], string> = {
  hero: "",
  featured: "grid-cols-2 lg:grid-cols-3",
  categories: "grid-cols-2 lg:grid-cols-3",
  videos: "grid-cols-2 lg:grid-cols-3",
  b2b: "",
  partners: "",
};

/** Colonnes surchargées — MAP STATIQUE (Tailwind détecte ces classes
 *  littérales au build ; une interpolation runtime serait perdue). */
const OVERRIDE_GRID: Record<"2" | "3" | "4", string> = {
  "2": "grid-cols-2",
  "3": "grid-cols-2 lg:grid-cols-3",
  "4": "grid-cols-2 lg:grid-cols-4",
};

/** Scinde un titre surchargé en « corps + mot fort » (dernier mot en
 *  rouge) — même grammaire visuelle que les titres par défaut. */
function splitTitle(title: string): { head: string; tail?: string } {
  const i = title.lastIndexOf(" ");
  if (i === -1) return { head: title };
  return { head: title.slice(0, i), tail: title.slice(i + 1) };
}

/** Données passées au rendu (exactement celles de la page d'accueil). */
export interface HomeSectionsData {
  featuredVideo: VideoWithRelations | null;
  videos: VideoWithRelations[];
  featuredArticles: ArticleWithRelations[];
  latestArticles: ArticleWithRelations[];
  categoryIdBySlug: { slug: string; name: string }[];
  /** IDs des articles sponsorisés (badge « Partenariat »). */
  sponsoredIds: string[];
  hasContent: boolean;
}

export default function HomeSections({
  design,
  data,
}: {
  design: DesignConfig;
  data: HomeSectionsData;
}) {
  const sideArticles = data.latestArticles;
  const sponsored = new Set(data.sponsoredIds);

  // Sections visibles, dans l'ordre choisi par l'administrateur.
  const visible = design.home.sections.filter((s) => s.visible);

  const renderSection = (s: HomeSection): React.ReactNode => {
    const title = s.title ?? null;
    const subtitle = s.subtitle ?? undefined;
    const cols = (s.columns && OVERRIDE_GRID[s.columns]) || DEFAULT_GRID[s.id];

    switch (s.id) {
      case "hero": {
        const h = title ? splitTitle(title) : { head: "En ce moment sur", tail: "Bonne Humeur Média" };
        return (
          <section key={s.id} className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
            <Reveal>
              {/* H1 réhabilité (audit F2) — titre surchargeable via Studio. */}
              <h1 className="bhtv-title text-balance text-neutral-900 dark:text-neutral-50">
                {h.head} {h.tail && <span className="text-guinea-red">{h.tail}</span>}
              </h1>
              {subtitle && (
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
                  {subtitle}
                </p>
              )}
            </Reveal>
            <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
              <Reveal>
                {data.featuredVideo ? (
                  <HeroPlayer video={data.featuredVideo} />
                ) : (
                  <EmptyState
                    icon={Tv}
                    title="La Web TV est en cours de préparation"
                    description="Les premières émissions officielles de Bonne Humeur Média arrivent bientôt. Revenez très vite !"
                  />
                )}
              </Reveal>

              <Reveal delay={120} className="flex flex-col">
                <aside className="flex h-full flex-col gap-4 rounded-2xl border border-neutral-200 bg-surface p-5 dark:border-white/10 dark:bg-night-800">
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
                          <span className="text-xs font-bold uppercase tracking-wider text-catink">
                            {article.categories.name}
                          </span>
                        )}
                        <p className="mt-1 line-clamp-2 text-sm font-bold leading-snug transition-colors group-hover:text-guinea-red">
                          {article.title}
                        </p>
                        {article.published_at && (
                          <span className="mt-1.5 flex items-center gap-1 text-xs text-neutral-400">
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
        );
      }

      case "featured": {
        if (data.featuredArticles.length === 0) return null;
        const t = title ? splitTitle(title) : { head: "L'actualité de la", tail: "rédaction" };
        return (
          <section key={s.id} className="mx-auto max-w-7xl px-4 pb-14 sm:px-6">
            <div className="mb-6">
              <SectionTitle
                kicker="L'actualité"
                title={t.head}
                highlight={t.tail}
                subtitle={subtitle ?? "Société, politique, économie, culture — l'information vérifiée, en direct de Conakry."}
              />
            </div>
            <div className={`grid gap-5 ${cols}`}>
              {data.featuredArticles.map((article) => (
                <Reveal key={article.id}>
                  <ArticleCard article={article} sponsored={sponsored.has(article.id)} />
                </Reveal>
              ))}
            </div>
          </section>
        );
      }

      case "categories": {
        const slugs = design.home.featuredCategorySlugs;
        const shown = slugs.length > 0
          ? data.categoryIdBySlug.filter((c) => slugs.includes(c.slug)).slice(0, 6)
          : data.categoryIdBySlug.slice(0, 6);
        if (shown.length === 0) return null;
        const t = title ? splitTitle(title) : { head: "Explorez nos", tail: "rubriques" };
        return (
          <section key={s.id} className="mx-auto max-w-7xl px-4 pb-14 sm:px-6">
            <div className="mb-6">
              <SectionTitle kicker="Rubriques" title={t.head} highlight={t.tail} subtitle={subtitle} />
            </div>
            <div className={`grid gap-4 sm:gap-5 ${cols}`}>
              {shown.map((category) => (
                <Reveal key={category.slug}>
                  <Link
                    href={`/actualites/categorie/${category.slug}`}
                    className="group flex h-full flex-col justify-between gap-2 rounded-2xl border border-neutral-200 bg-surface p-5 transition-colors hover:border-guinea-red/40 dark:border-white/10 dark:bg-night-800"
                  >
                    <p className="font-display text-base font-extrabold text-neutral-900 transition-colors group-hover:text-guinea-red dark:text-neutral-50">
                      {category.name}
                    </p>
                    <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-catink">
                      Voir la rubrique
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                </Reveal>
              ))}
            </div>
          </section>
        );
      }

      case "videos": {
        if (data.videos.length === 0) return null;
        const t = title ? splitTitle(title) : { head: "Nos dernières", tail: "émissions" };
        return (
          <section key={s.id} className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
            <div className="mb-6">
              <SectionTitle
                kicker="Vidéos"
                title={t.head}
                highlight={t.tail}
                subtitle={subtitle ?? "Toute l'actualité en vidéo, produite par la rédaction de Bonne Humeur Média."}
              />
            </div>
            <VideosGrid videos={data.videos.slice(0, 6)} gridClassName={`grid gap-5 ${cols}`} />
          </section>
        );
      }

      case "b2b":
        return (
          <section key={s.id} className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
            <Reveal>
              <B2BCta />
            </Reveal>
          </section>
        );

      case "partners":
        return <PartnerShowcase key={s.id} className="mx-auto mb-16 max-w-7xl px-4 sm:px-6" />;

      default:
        return null;
    }
  };

  return (
    <>
      {/* ─── État global honnête tant qu'aucun contenu n'est publié ─── */}
      {!data.hasContent && (
        <section className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
          <EmptyState
            icon={Newspaper}
            title="La plateforme est en cours de préparation"
            description="Les articles et émissions publiés par la rédaction apparaîtront ici dès leur mise en ligne officielle."
          />
        </section>
      )}

      {/* ─── Sections (ordre/visibilité/titres/colonnes du Studio) ───
           Les emplacements pub restent ACCROCHÉS à leurs sections : la
           bannière en ligne suit « featured », le bandeau suit « videos »
           (ordre par défaut = rendu historique identique). Si la direction
           masque une section, son emplacement pub suit (aucun emplacement
           orphelin) — les AUTRES emplacements restent. */}
      {visible.map((s) => (
        <Fragment key={s.id}>
          {renderSection(s)}
          {s.id === "featured" && (
            <AdSlot key="ad-inline" code="home_inline" className="mx-auto max-w-7xl px-4 sm:px-6" />
          )}
          {s.id === "videos" && (
            <AdSlot key="ad-promo" code="home_promo_strip" className="mx-auto max-w-7xl px-4 sm:px-6" />
          )}
        </Fragment>
      ))}
    </>
  );
}
