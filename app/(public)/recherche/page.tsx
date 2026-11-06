import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { CalendarDays, Newspaper, Search, SearchX, Tv } from "lucide-react";
import EmptyState from "@/components/shared/EmptyState";
import PageTitle from "@/components/shared/PageTitle";
import { searchPublishedContent } from "@/lib/data/search";
import { formatDate } from "@/lib/utils";
import { mediaVariantUrl } from "@/lib/media/variants";

/**
 * Recherche globale (articles + vidéos publiés) via la fonction SQL
 * search_published (RLS : ne renvoie que du publié).
 * Page non indexée : les résultats ne doivent pas polluer les moteurs.
 */
export const metadata: Metadata = {
  title: "Recherche",
  description: "Rechercher dans les actualités et vidéos de Bonne Humeur TV.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/recherche" },
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const results = query.length >= 2 ? await searchPublishedContent(query) : null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <PageTitle
        kicker="Explorer"
        title="Recherche"
        subtitle="Explorez les actualités et vidéos publiées par la rédaction."
      />

      <form action="/recherche" method="GET" className="mt-8 max-w-2xl">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Mot-clé, titre, sujet…"
            minLength={2}
            aria-label="Terme de recherche"
            className="w-full rounded-full border border-neutral-300 bg-surface py-3.5 pl-11 pr-32 text-sm outline-none transition-colors placeholder:text-neutral-400 focus:border-guinea-red focus:ring-2 focus:ring-guinea-red/20 dark:border-white/15 dark:bg-night-800"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-guinea-red px-5 py-2.5 text-sm font-bold text-white shadow-glow transition-transform hover:scale-105"
          >
            Rechercher
          </button>
        </div>
      </form>

      <div className="mt-10">
        {!results && (
          <EmptyState
            icon={Search}
            title="Que souhaitez-vous trouver ?"
            description="Saisissez au moins 2 caractères pour lancer une recherche parmi les contenus publiés."
          />
        )}

        {results && results.unavailable && (
          <EmptyState
            icon={SearchX}
            title="La recherche n'est pas disponible"
            description="Le moteur de recherche n'est pas encore activé sur la plateforme. Réessayez plus tard ou parcourez les rubriques directement."
          >
            <Link
              href="/actualites"
              className="text-sm font-bold text-guinea-red underline-offset-4 hover:underline"
            >
              Parcourir les actualités →
            </Link>
          </EmptyState>
        )}

        {results && !results.unavailable && (
          <>
            {results.articles.length === 0 && results.videos.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title="Aucun résultat"
                description={`Aucune actualité ni vidéo publiée ne correspond à « ${query} ».`}
              />
            ) : (
              <div className="grid gap-12">
                {results.articles.length > 0 && (
                  <div>
                    <h2 className="flex items-center gap-2 font-display text-lg font-extrabold">
                      <Newspaper className="h-5 w-5 text-guinea-green" />
                      Actualités ({results.articles.length})
                    </h2>
                    <div className="mt-4 grid gap-4">
                      {results.articles.map((a) => (
                        <Link
                          key={a.id}
                          href={`/actualites/${a.slug}`}
                          className="group rounded-2xl border border-neutral-200 bg-surface p-4 transition-all hover:border-guinea-red/40 hover:shadow-lg dark:border-white/10 dark:bg-night-800"
                        >
                          {a.category_name && (
                            <span className="text-xs font-bold uppercase tracking-wider text-catink">
                              {a.category_name}
                            </span>
                          )}
                          <p className="mt-1 font-display text-base font-bold leading-snug transition-colors group-hover:text-guinea-red">
                            {a.title}
                          </p>
                          {a.excerpt && (
                            <p className="mt-1.5 line-clamp-2 text-sm text-neutral-500 dark:text-neutral-400">
                              {a.excerpt}
                            </p>
                          )}
                          {a.published_at && (
                            <span className="mt-2 flex items-center gap-1.5 text-xs text-neutral-400">
                              <CalendarDays className="h-3 w-3" />
                              {formatDate(a.published_at)}
                            </span>
                          )}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {results.videos.length > 0 && (
                  <div>
                    <h2 className="flex items-center gap-2 font-display text-lg font-extrabold">
                      <Tv className="h-5 w-5 text-guinea-red" />
                      Vidéos ({results.videos.length})
                    </h2>
                    <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                      {results.videos.map((v) => (
                        <Link
                          key={v.id}
                          href={`/videos/${v.slug}`}
                          className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-surface transition-all hover:-translate-y-1 hover:shadow-xl dark:border-white/10 dark:bg-night-800"
                        >
                          <span className="relative flex aspect-video w-full items-center justify-center bg-gradient-to-br from-night-800 via-night-900 to-black">
                            {v.thumbnail_url && (
                              <Image
                                src={mediaVariantUrl(v.thumbnail_url, "thumb")}
                                alt={`Miniature de la vidéo : ${v.title}`}
                                fill
                                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                loading="lazy"
                                unoptimized
                                className="object-cover opacity-80 transition-opacity group-hover:opacity-95"
                              />
                            )}
                            <Tv className="relative h-8 w-8 text-white/80" />
                          </span>
                          <span className="flex flex-1 flex-col gap-2 p-4">
                            {v.category_name && (
                              <span className="w-fit rounded-full bg-guinea-green/10 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-catink">
                                {v.category_name}
                              </span>
                            )}
                            <span className="line-clamp-2 font-display text-sm font-bold leading-snug transition-colors group-hover:text-guinea-red sm:text-base">
                              {v.title}
                            </span>
                            {v.published_at && (
                              <span className="mt-auto flex items-center gap-1.5 text-xs text-neutral-400">
                                <CalendarDays className="h-3.5 w-3.5" />
                                {formatDate(v.published_at)}
                              </span>
                            )}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}