import Link from "next/link";
import { CalendarDays } from "lucide-react";
import BreakingNews from "@/components/home/BreakingNews";
import HeroPlayer from "@/components/home/HeroPlayer";
import VideosGrid from "@/components/home/VideosGrid";
import B2BCta from "@/components/home/B2BCta";
import Reveal from "@/components/shared/Reveal";
import { videos, CATEGORY_LABELS } from "@/lib/videos";
import { formatDate } from "@/lib/utils";

export default function HomePage() {
  const hero = videos.find((v) => v.featured) ?? videos[0];
  const sideList = videos.filter((v) => v.slug !== hero.slug).slice(0, 3);

  return (
    <>
      <BreakingNews />

      {/* ─── Hero : lecteur principal + à la une ─── */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Reveal>
          <h1 className="mb-5 flex items-center gap-3 font-display text-xl font-extrabold sm:text-2xl">
            {hero.live && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute h-full w-full animate-ping rounded-full bg-guinea-red opacity-75" />
                <span className="relative h-2.5 w-2.5 rounded-full bg-guinea-red" />
              </span>
            )}
            En ce moment sur <span className="text-guinea-red">Bonne Humeur TV</span>
          </h1>
        </Reveal>
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Reveal>
            <HeroPlayer video={hero} />
          </Reveal>

          <Reveal delay={120} className="flex flex-col">
            <aside className="flex h-full flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-white/10 dark:bg-night-800">
            <h2 className="flex items-center gap-2 font-display text-sm font-extrabold uppercase tracking-widest text-guinea-red">
              À la une
            </h2>
            {sideList.map((v) => (
              <Link
                key={v.slug}
                href={`/videos/${v.slug}`}
                className="group rounded-xl p-3 transition-colors hover:bg-neutral-100 dark:hover:bg-white/5"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-guinea-green">
                  {CATEGORY_LABELS[v.category]}
                </span>
                <p className="mt-1 line-clamp-2 text-sm font-bold leading-snug group-hover:text-guinea-red">
                  {v.title}
                </p>
                <span className="mt-1.5 flex items-center gap-1 text-[11px] text-neutral-400">
                  <CalendarDays className="h-3 w-3" />
                  {formatDate(v.publishedAt)}
                </span>
              </Link>
            ))}
            </aside>
          </Reveal>
        </div>
      </section>

      {/* ─── Grille de contenus filtrable ─── */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-extrabold sm:text-3xl">
              Nos dernières <span className="text-guinea-red">émissions</span>
            </h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Société, culture, économie, éducation, institutionnel — toute
              l'actualité en vidéo.
            </p>
          </div>
        </div>
        <VideosGrid videos={videos} maxItems={6} />
      </section>

      {/* ─── Section vitrine B2B ─── */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <Reveal>
          <B2BCta />
        </Reveal>
      </section>
    </>
  );
}
