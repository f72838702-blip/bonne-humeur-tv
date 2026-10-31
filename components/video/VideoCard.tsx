import Link from "next/link";
import Image from "next/image";
import { CalendarDays, Clock, Play } from "lucide-react";
import type { VideoWithRelations } from "@/lib/types";
import { formatDate } from "@/lib/utils";

/**
 * Carte vidéo — miniature réelle (image éditoriale ou vignette YouTube),
 * catégorie issue de la base, date de publication réelle.
 * Aucun compteur de vues (donnée inexistante → jamais de chiffre fictif).
 */
export default function VideoCard({ video }: { video: VideoWithRelations }) {
  const thumbnail =
    video.thumbnail_url ?? `https://i.ytimg.com/vi/${video.youtube_id}/hqdefault.jpg`;

  return (
    <Link
      href={`/videos/${video.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white transition-all hover:-translate-y-1 hover:shadow-xl dark:border-white/10 dark:bg-night-800 dark:hover:border-white/20"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-night-800 via-night-900 to-black">
        <Image
          src={thumbnail}
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover opacity-80 transition-all duration-300 group-hover:scale-105 group-hover:opacity-95"
        />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/40 backdrop-blur transition-all duration-300 group-hover:scale-110 group-hover:bg-guinea-red">
            <Play className="ml-0.5 h-5 w-5 fill-white text-white" />
          </span>
        </span>
        {video.is_live && (
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-guinea-red px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
            <span className="h-1 w-1 animate-pulse-dot rounded-full bg-white" />
            Direct
          </span>
        )}
        {video.duration && (
          <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-white">
            <Clock className="h-3 w-3" />
            {video.duration}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        {video.categories && (
          <span className="w-fit rounded-full bg-guinea-green/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-guinea-green">
            {video.categories.name}
          </span>
        )}
        <h3 className="line-clamp-2 font-display text-sm font-bold leading-snug transition-colors group-hover:text-guinea-red sm:text-base">
          {video.title}
        </h3>
        {video.description && (
          <p className="line-clamp-2 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
            {video.description}
          </p>
        )}
        {video.published_at && (
          <span className="mt-auto flex items-center gap-1.5 pt-1 text-[11px] font-medium text-neutral-400">
            <CalendarDays className="h-3.5 w-3.5" />
            {formatDate(video.published_at)}
          </span>
        )}
      </div>
    </Link>
  );
}