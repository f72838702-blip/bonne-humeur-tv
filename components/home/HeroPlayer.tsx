"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ExternalLink, Play } from "lucide-react";
import type { VideoWithRelations } from "@/lib/types";
import { youtubeThumbnailUrl, youtubeWatchUrl } from "@/lib/youtube/url";

/**
 * Lecteur principal (accueil + page vidéo). Directive §1/§3 :
 * • la miniature réelle (éditoriale ou vignette YouTube) s'affiche AVANT
 *   l'iframe youtube-nocookie, injectée uniquement au clic — pas de
 *   préchargement du lecteur ;
 * • l'image est `unoptimized` : les vignettes YouTube et les variantes
 *   Storage sont déjà compressées, aucune réoptimisation à chaque
 *   requête sur le serveur applicatif ;
 * • `priority` : image principale au-dessus de la ligne de flottaison
 *   (les images secondaires restent en chargement différé) ;
 * • le badge « En direct » ne s'affiche QUE si la donnée réelle is_live
 *   a été activée par la rédaction — jamais de faux direct ;
 * • repli honnête : lien vers YouTube si la vidéo ne se charge pas.
 */
export default function HeroPlayer({ video }: { video: VideoWithRelations }) {
  const [playing, setPlaying] = useState(false);

  const thumbnail =
    video.thumbnail_url ?? youtubeThumbnailUrl(video.youtube_id, "hq");

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
              alt={`Miniature de la vidéo : ${video.title}`}
              fill
              sizes="(max-width: 1024px) 100vw, 65vw"
              priority
              unoptimized
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

      <p className="flex items-center gap-2 border-t border-white/10 px-4 py-2.5 text-xs text-neutral-300">
        <span className="font-medium">La vidéo ne se charge pas&nbsp;?</span>
        <Link
          href={youtubeWatchUrl(video.youtube_id)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-bold text-guinea-yellow underline underline-offset-2"
        >
          Regardez-la sur YouTube
          <ExternalLink className="h-3 w-3" />
        </Link>
      </p>
    </div>
  );
}