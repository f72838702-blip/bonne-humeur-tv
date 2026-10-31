import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Category } from "@/lib/types";

/**
 * Filtres par catégorie — pilotés par l'URL (?categorie=slug) :
 * partageables, indexables, sans état client (remplace le store Zustand
 * des filtres, source de désynchronisation A1-4).
 */
export default function FilterChips({
  categories,
  currentSlug,
  allLabel = "Tout",
  basePath,
  extraParams = {},
}: {
  categories: Pick<Category, "id" | "name" | "slug">[];
  currentSlug?: string;
  allLabel?: string;
  /** Base des liens, ex : "/actualites" ou "/videos". */
  basePath: string;
  /** Paramètres d'URL supplémentaires à conserver (ex : ?q=...). */
  extraParams?: Record<string, string | undefined>;
}) {
  function href(slug?: string): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(extraParams)) {
      if (value) params.set(key, value);
    }
    if (slug) params.set("categorie", slug);
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  }

  const chips: { key: string; label: string; href: string; active: boolean }[] = [
    { key: "__all__", label: allLabel, href: href(), active: !currentSlug },
    ...categories.map((c) => ({
      key: c.slug,
      label: c.name,
      href: href(c.slug),
      active: currentSlug === c.slug,
    })),
  ];

  return (
    <div
      className="flex flex-wrap gap-2"
      role="group"
      aria-label="Filtrer par catégorie"
    >
      {chips.map((chip) => (
        <Link
          key={chip.key}
          href={chip.href}
          scroll={false}
          className={cn(
            "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
            chip.active
              ? "border-guinea-red bg-guinea-red text-white shadow-glow"
              : "border-neutral-200 bg-white text-neutral-600 hover:border-guinea-red/50 hover:text-guinea-red dark:border-white/10 dark:bg-night-800 dark:text-neutral-300"
          )}
        >
          {chip.label}
        </Link>
      ))}
    </div>
  );
}