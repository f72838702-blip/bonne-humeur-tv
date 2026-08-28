"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import type { Video } from "@/lib/videos";
import { CATEGORY_LABELS } from "@/lib/videos";

/**
 * Lecteur principal de la page d'accueil.
 * Affiche une couverture légère par défaut ; l'iframe YouTube n'est chargée
 * qu'au clic (pas de surcoût de bande passante à l'arrivée sur la page).
 */
export default function HeroPlayer({ video }: { video: Video }) {
  const [playing, setPlaying] = useState(false);

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-night-900 shadow-glow dark:border-white/10">
      <div className="relative aspect-video w-full">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1&rel=0`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <button
            onClick={() => setPlaying(true)}
            aria-label={`Lire : ${video.title}`}
            className="group absolute inset-0 flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-night-800 via-night-900 to-black"
          >
            <div className="pointer-events-none absolute inset-0 opacity-30 [background:radial-gradient(ellipse_at_top,rgba(206,17,38,0.35),transparent_60%)]" />
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-guinea-red shadow-glow transition-transform duration-300 group-hover:scale-110">
              <Play className="ml-1 h-9 w-9 fill-white text-white" />
            </span>
            <span className="mt-6 px-6 text-center font-display text-lg font-bold text-white sm:text-2xl">
              {video.title}
            </span>
            <span className="mt-2 text-xs uppercase tracking-widest text-neutral-400">
              {CATEGORY_LABELS[video.category]} — {video.duration}
            </span>
          </button>
        )}

        {video.live && (
          <span className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-guinea-red px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-white shadow-glow">
            <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-white" />
            En direct
          </span>
        )}
      </div>
    </div>
  );
}
