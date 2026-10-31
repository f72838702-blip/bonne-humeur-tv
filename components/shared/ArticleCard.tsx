import Link from "next/link";
import Image from "next/image";
import { CalendarDays } from "lucide-react";
import type { ArticleWithRelations } from "@/lib/types";
import { formatDate } from "@/lib/utils";

/** Vignette de repli neutre — aucune fausse image éditoriale. */
function ArticleThumb({ article }: { article: ArticleWithRelations }) {
  if (article.featured_image) {
    return (
      <Image
        src={article.featured_image}
        alt={article.title}
        width={640}
        height={360}
        className="h-44 w-full rounded-xl object-cover transition-transform duration-300 group-hover:scale-[1.03]"
      />
    );
  }
  return (
    <div className="flex h-44 w-full items-center justify-center rounded-xl bg-gradient-to-br from-night-800 to-night-900 text-sm font-semibold uppercase tracking-widest text-neutral-500 dark:from-night-800 dark:to-night-950">
      Bonne Humeur TV
    </div>
  );
}

export default function ArticleCard({ article }: { article: ArticleWithRelations }) {
  return (
    <Link
      href={`/actualites/${article.slug}`}
      className="group flex flex-col rounded-2xl border border-neutral-200 bg-white p-4 transition-all hover:border-guinea-red/40 hover:shadow-lg dark:border-white/10 dark:bg-night-800 dark:hover:border-guinea-red/50"
    >
      <ArticleThumb article={article} />
      {article.categories && (
        <span className="mt-4 text-[10px] font-bold uppercase tracking-wider text-guinea-green">
          {article.categories.name}
        </span>
      )}
      <h3 className="mt-1.5 line-clamp-2 font-display text-base font-bold leading-snug transition-colors group-hover:text-guinea-red">
        {article.title}
      </h3>
      {article.excerpt && (
        <p className="mt-2 line-clamp-2 text-sm text-neutral-500 dark:text-neutral-400">
          {article.excerpt}
        </p>
      )}
      <span className="mt-auto flex items-center gap-1.5 pt-3 text-[11px] text-neutral-400">
        <CalendarDays className="h-3 w-3" />
        {article.published_at ? formatDate(article.published_at) : ""}
      </span>
    </Link>
  );
}