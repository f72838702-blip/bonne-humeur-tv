"use client";

import { useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";
import type { VideoWithRelations } from "@/lib/types";

/**
 * Lecteur principal (accueil + page vidéo). La miniature réelle est
 * chargée via next/image (thumbnail éditoriale ou vignette YouTube) ;
 * l'iframe youtube-nocookie n'est injectée qu'au clic (économie de
 * bande passante + respect du consentement implicite).
 * Le badge « En direct » ne s'affiche QUE si la donnée réelle is_live
 * a été activée par la rédaction — jamais de faux direct.
 */
export default function HeroPlayer({ video }: { video: VideoWithRelations }) {
  const [playing, setPlaying] = useState(false);

  const thumbnail =
    video.thumbnail_url ?? `https://i.ytimg.com/vi/${video.youtube_id}/hqdefault.jpg`;

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-night-900 shadow-glow dark:border-white/10">
      <div className="relative aspect-video w-full">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${video.youtube_id}?autoplay=1&rel=0`}
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
            className="group absolute inset-0 flex h-full w-full flex-col items-center justify-center"
          >
            <Image
              src={thumbnail}
              alt=""
              fill
              sizes="(max-width: 1024px) 100vw, 65vw"
              className="object-cover opacity-70 transition-opacity group-hover:opacity-85"
            />
            <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-guinea-red shadow-glow transition-transform duration-300 group-hover:scale-110">
              <Play className="ml-1 h-9 w-9 fill-white text-white" />
            </span>
            <span className="relative mt-6 line-clamp-2 px-6 text-center font-display text-lg font-bold text-white sm:text-2xl">
              {video.title}
            </span>
            {video.categories && (
              <span className="relative mt-2 text-xs uppercase tracking-widest text-neutral-200">
                {video.categories.name}
                {video.duration ? ` — ${video.duration}` : ""}
              </span>
            )}
          </button>
        )}

        {video.is_live && (
          <span className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-guinea-red px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-white shadow-glow">
            <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-white" />
            En direct
          </span>
        )}
      </div>
    </div>
  );
}