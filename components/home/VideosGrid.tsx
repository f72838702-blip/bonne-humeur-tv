"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CATEGORIES, useFilters } from "@/store/filters";
import type { Video } from "@/lib/videos";
import VideoCard from "@/components/video/VideoCard";
import { cn } from "@/lib/utils";

export default function VideosGrid({
  videos,
  maxItems = 6,
  showAllLink = true,
}: {
  videos: Video[];
  maxItems?: number;
  showAllLink?: boolean;
}) {
  const { active, setActive } = useFilters();

  const filtered = videos
    .filter((v) => (active === "all" ? true : v.category === active))
    .slice(0, maxItems);

  return (
    <div>
      <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setActive(cat.key)}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-all",
              active === cat.key
                ? "border-guinea-red bg-guinea-red text-white shadow-glow"
                : "border-neutral-200 text-neutral-600 hover:border-neutral-400 dark:border-white/15 dark:text-neutral-300 dark:hover:border-white/40"
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-neutral-500">
          Aucune vidéo dans cette catégorie pour le moment.
        </p>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((video) => (
            <VideoCard key={video.slug} video={video} />
          ))}
        </div>
      )}

      {showAllLink && (
        <div className="mt-8 text-center">
          <Link
            href="/videos"
            className="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-6 py-3 text-sm font-semibold transition-colors hover:border-guinea-red hover:text-guinea-red dark:border-white/20 dark:hover:border-guinea-red"
          >
            Voir toutes les vidéos
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
