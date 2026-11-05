"use client";

import { useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";
import { youtubeThumbnailUrl } from "@/lib/youtube/url";

/**
 * Lecteur du direct — façade avant chargement (demande explicite de la
 * direction : AUCUNE connexion à YouTube tant que le visiteur n'a pas
 * choisi de lancer la lecture). La miniature est servie par i.ytimg.com
 * (img-src déjà autorisé ; jamais retéléchargée). L'iframe
 * youtube-nocookie est injectée UNIQUEMENT au clic (frame-src CSP ok).
 */
export default function DirectLivePlayer({
  videoId,
  title,
  isLive,
}: {
  videoId: string;
  title: string | null;
  isLive: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const label = title ?? (isLive ? "Bonne Humeur TV — émission en direct" : "Émission de la chaîne");

  return (
    <div className="overflow-hidden rounded-2xl border border-guinea-red/40 bg-night-900 shadow-glow dark:border-guinea-red/30">
      <div className="relative aspect-video w-full">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
            title={label}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`Lancer la lecture : ${label}`}
            className="group absolute inset-0 h-full w-full"
          >
            <Image
              src={youtubeThumbnailUrl(videoId, "maxres")}
              alt={`Miniature : ${label}`}
              fill
              sizes="(max-width: 1024px) 100vw, 66vw"
              unoptimized
              className="object-cover opacity-75 transition-opacity group-hover:opacity-90"
            />
            <span className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-guinea-red shadow-glow transition-transform duration-300 group-hover:scale-110">
                <Play className="ml-1 h-9 w-9 fill-white text-white" />
              </span>
              {isLive && (
                <span className="relative mt-5 inline-flex items-center gap-2 rounded-full bg-guinea-red px-4 py-1.5 text-xs font-extrabold uppercase tracking-widest text-white">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute h-full w-full animate-ping rounded-full bg-white opacity-75" />
                    <span className="relative h-2 w-2 rounded-full bg-white" />
                  </span>
                  En direct
                </span>
              )}
            </span>
          </button>
        )}
      </div>
      <p className="bg-white px-4 py-2.5 text-sm font-semibold dark:bg-night-800">
        {isLive ? "En direct : " : "Émission (rediffusion) : "}
        <span className="text-guinea-red">{label}</span>
      </p>
    </div>
  );
}
