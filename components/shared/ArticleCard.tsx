import Link from "next/link";
import Image from "next/image";
import { CalendarDays } from "lucide-react";
import type { ArticleWithRelations } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { mediaVariantUrl } from "@/lib/media/variants";
import { SponsoredArticleBadge } from "@/components/publicite/AdVisuals";

/**
 * Vignette de repli neutre — aucune fausse image éditoriale.
 * Dimension adaptée : la variante « carte » (800 px, pré-compressée
 * côté éditorial) sert directement depuis le CDN Storage, sans
 * réoptimisation serveur (directive §2/§3).
 */
function ArticleThumb({ article }: { article: ArticleWithRelations }) {
  if (article.featured_image) {
    return (
      <Image
        src={mediaVariantUrl(article.featured_image, "card")}
        alt={article.title}
        width={800}
        height={450}
        loading="lazy"
        unoptimized
        className="h-44 w-full rounded-xl object-cover transition-transform duration-300 group-hover:scale-[1.03]"
      />
    );
  }
  return (
    <div className="flex h-44 w-full items-center justify-center rounded-xl bg-gradient-to-br from-night-800 to-night-900 text-sm font-semibold uppercase tracking-widest text-neutral-500 dark:from-night-800 dark:to-night-950">
      Bonne Humeur Média
    </div>
  );
}

/**
 * Carte d'article — UN SEUL modèle visuel partagé avec VideoCard
 * (image pleine largeur, corps dans la carte — audit F4).
 * Lisibilité (audit F5/F6) : catégorie ≥ 12 px avec la nuance contrastée
 * `catink` (5.5:1 en clair / 8:1 en nuit), date en 11 px minimum.
 */
export default function ArticleCard({
  article,
  sponsored = false,
}: {
  article: ArticleWithRelations;
  /** Mention « Sponsorisé » (§12) — l'article réel suit la marque partout. */
  sponsored?: boolean;
}) {
  return (
    <Link
      href={`/actualites/${article.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-surface transition-all hover:-translate-y-0.5 hover:border-guinea-red/40 hover:shadow-lg dark:border-white/10 dark:bg-night-800 dark:hover:border-guinea-red/50"
    >
      <div className="relative flex h-44 w-full items-center justify-center overflow-hidden rounded-t-2xl bg-gradient-to-br from-night-800 to-night-900">
        {article.featured_image ? (
          <Image
            src={mediaVariantUrl(article.featured_image, "card")}
            alt={article.title}
            width={800}
            height={450}
            loading="lazy"
            unoptimized
            className="h-44 w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <span className="text-sm font-semibold uppercase tracking-widest text-neutral-500">
            Bonne Humeur Média
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        {sponsored && (
          <span className="self-start">
            <SponsoredArticleBadge />
          </span>
        )}
        {article.categories && (
          <span className="text-xs font-bold uppercase tracking-wider text-catink">
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
        <span className="mt-auto flex items-center gap-1.5 pt-3 text-xs text-neutral-400">
          <CalendarDays className="h-3 w-3" />
          {article.published_at ? formatDate(article.published_at) : ""}
        </span>
      </div>
    </Link>
  );
}
