"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { CATEGORIES, useFilters } from "@/store/filters";
import type { Video } from "@/lib/videos";
import VideoCard from "@/components/video/VideoCard";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 6;

export default function VideosGallery({ videos }: { videos: Video[] }) {
  const { active, setActive, search, setSearch } = useFilters();
  const [visible, setVisible] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return videos.filter((v) => {
      const matchCat = active === "all" || v.category === active;
      const matchSearch =
        !q ||
        v.title.toLowerCase().includes(q) ||
        v.excerpt.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [videos, active, search]);

  return (
    <div>
      <div className="relative mb-6">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setVisible(PAGE_SIZE);
          }}
          placeholder="Rechercher une émission, un sujet…"
          className="w-full rounded-full border border-neutral-300 bg-white py-3.5 pl-11 pr-4 text-sm outline-none transition-colors placeholder:text-neutral-400 focus:border-guinea-red focus:ring-2 focus:ring-guinea-red/20 dark:border-white/15 dark:bg-night-800"
        />
      </div>

      <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => {
              setActive(cat.key);
              setVisible(PAGE_SIZE);
            }}
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
        <p className="py-16 text-center text-sm text-neutral-500">
          Aucune vidéo ne correspond à votre recherche.
        </p>
      ) : (
        <>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.slice(0, visible).map((video) => (
              <VideoCard key={video.slug} video={video} />
            ))}
          </div>
          {visible < filtered.length && (
            <div className="mt-10 text-center">
              <button
                onClick={() => setVisible((n) => n + PAGE_SIZE)}
                className="rounded-full border border-neutral-300 px-8 py-3.5 text-sm font-bold transition-colors hover:border-guinea-red hover:text-guinea-red dark:border-white/20"
              >
                Charger plus de vidéos
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
