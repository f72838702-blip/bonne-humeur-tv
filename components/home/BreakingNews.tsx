import { breakingNews } from "@/lib/videos";

export default function BreakingNews() {
  const items = [...breakingNews, ...breakingNews];
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
          {items.map((news, i) => (
            <span key={i} className="flex items-center text-sm font-medium">
              <span className="px-6">{news}</span>
              <span className="text-white/50">•</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
