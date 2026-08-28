import Link from "next/link";
import { Clock, Eye, Play } from "lucide-react";
import type { Video } from "@/lib/videos";
import { CATEGORY_LABELS } from "@/lib/videos";
import { formatDate, formatViews } from "@/lib/utils";

const CATEGORY_STYLES: Record<Video["category"], string> = {
  societe: "bg-guinea-green/15 text-guinea-green",
  culture: "bg-guinea-yellow/15 text-yellow-600 dark:text-guinea-yellow",
  economie: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  education: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  institutionnel: "bg-guinea-red/15 text-guinea-red",
};

export default function VideoCard({ video }: { video: Video }) {
  return (
    <Link
      href={`/videos/${video.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white transition-all hover:-translate-y-1 hover:shadow-xl dark:border-white/10 dark:bg-night-800 dark:hover:border-white/20"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-night-800 via-night-900 to-black">
        <div className="absolute inset-0 opacity-25 transition-opacity group-hover:opacity-40 [background:radial-gradient(ellipse_at_center,rgba(0,154,68,0.3),transparent_65%)]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 backdrop-blur transition-all duration-300 group-hover:scale-110 group-hover:bg-guinea-red">
            <Play className="ml-0.5 h-5 w-5 fill-white text-white" />
          </span>
        </div>
        <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-white">
          <Clock className="h-3 w-3" />
          {video.duration}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <span
          className={`w-fit rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${CATEGORY_STYLES[video.category]}`}
        >
          {CATEGORY_LABELS[video.category]}
        </span>
        <h3 className="line-clamp-2 font-display text-sm font-bold leading-snug sm:text-base">
          {video.title}
        </h3>
        <p className="line-clamp-2 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
          {video.excerpt}
        </p>
        <div className="mt-auto flex items-center gap-3 pt-1 text-[11px] font-medium text-neutral-400">
          <span className="flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" />
            {formatViews(video.views)} vues
          </span>
          <span>{formatDate(video.publishedAt)}</span>
        </div>
      </div>
    </Link>
  );
}
