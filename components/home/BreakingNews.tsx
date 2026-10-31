import Link from "next/link";
import { getActiveBreakingNews } from "@/lib/data/breaking-news";

/**
 * Bandeau de flash-infos — données RÉELLES uniquement (table breaking_news,
 * actives et dans leur période de diffusion). Aucune entrée → pas de bandeau.
 */
export default async function BreakingNews() {
  const items = await getActiveBreakingNews();
  if (items.length === 0) return null;

  // Duplication pour le défilement continu (animation CSS marquee).
  const loop = [...items, ...items];

  return (
    <div className="flex items-stretch overflow-hidden bg-guinea-red text-white">
      <span className="flex shrink-0 items-center gap-2 bg-black/25 px-4 py-2 text-[11px] font-extrabold uppercase tracking-widest">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
        </span>
        Flash Infos
      </span>
      <div className="relative flex flex-1 items-center overflow-hidden">
        <div className="flex whitespace-nowrap py-2 animate-marquee">
          {loop.map((news, i) => (
            <span key={`${news.id}-${i}`} className="flex items-center text-sm font-medium">
              {news.link ? (
                <Link href={news.link} className="px-6 underline-offset-4 hover:underline">
                  {news.content}
                </Link>
              ) : (
                <span className="px-6">{news.content}</span>
              )}
              <span className="text-white/50">•</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}