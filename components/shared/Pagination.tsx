import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Pagination serveur : les numéros de page vivent dans l'URL (?page=N),
 * partageables et indexables — pas d'état client.
 */
export default function Pagination({
  currentPage,
  totalPages,
  buildHref,
}: {
  currentPage: number;
  totalPages: number;
  buildHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  const pages: number[] = [];
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, start + 4);
  for (let p = Math.max(1, end - 4); p <= end; p++) pages.push(p);

  return (
    <nav className="mt-10 flex items-center justify-center gap-1.5" aria-label="Pagination">
      {currentPage > 1 && (
        <Link
          href={buildHref(currentPage - 1)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 transition-colors hover:border-guinea-red/50 hover:text-guinea-red dark:border-white/10 dark:bg-night-800 dark:text-neutral-300"
          aria-label="Page précédente"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
      )}
      {pages.map((p) => (
        <Link
          key={p}
          href={buildHref(p)}
          aria-current={p === currentPage ? "page" : undefined}
          className={
            p === currentPage
              ? "flex h-9 w-9 items-center justify-center rounded-full bg-guinea-red font-bold text-white"
              : "flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 transition-colors hover:border-guinea-red/50 hover:text-guinea-red dark:border-white/10 dark:bg-night-800 dark:text-neutral-300"
          }
        >
          {p}
        </Link>
      ))}
      {currentPage < totalPages && (
        <Link
          href={buildHref(currentPage + 1)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 transition-colors hover:border-guinea-red/50 hover:text-guinea-red dark:border-white/10 dark:bg-night-800 dark:text-neutral-300"
          aria-label="Page suivante"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      )}
    </nav>
  );
}