import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { VideoWithRelations } from "@/lib/types";
import VideoCard from "@/components/video/VideoCard";

/**
 * Grille des dernières vidéos (composant serveur — les filtres par
 * catégorie vivent dans l'URL sur /videos, plus de store client).
 */
export default function VideosGrid({
  videos,
  showAllLink = true,
  /** Surcharge des colonnes (Studio de design — section « videos »). */
  gridClassName = "grid gap-5 sm:grid-cols-2 lg:grid-cols-3",
}: {
  videos: VideoWithRelations[];
  showAllLink?: boolean;
  gridClassName?: string;
}) {
  return (
    <div>
      <div className={gridClassName}>
        {videos.map((video) => (
          <VideoCard key={video.slug} video={video} />
        ))}
      </div>

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