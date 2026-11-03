import Image from "next/image";
import Link from "next/link";
import { getSponsoredArticle } from "@/lib/data/ads-public";
import type { AdPublicCreative } from "@/lib/types";
import { SponsoredArticleBadge } from "./AdVisuals";

/**
 * Article SPONSORISÉ — jamais un faux article, jamais un article non
 * publié (lecture publique RLS). La carte mène vers l'article réel
 * (contenu éditorial) ; l'annonceur est identifié par la mention
 * « Sponsorisé » DISTINCTE du flux classique (bordure pointillée
 * ambre + baliage), jamais confondu avec un article normal.
 */
export default async function SponsoredArticleCard({
  creative,
  placement,
}: {
  creative: AdPublicCreative;
  placement: string;
}) {
  const articleId = creative.article_id ?? null;
  if (!articleId) return null;
  const article = await getSponsoredArticle(articleId);
  if (!article) return null; // article retiré/non publié : création silencieuse

  return (
    <Link
      href={`/actualites/${article.slug}`}
      className="group block rounded-2xl border border-dashed border-guinea-yellow/60 bg-white p-4 transition-colors hover:border-guinea-yellow dark:border-guinea-yellow/50 dark:bg-night-800"
    >
      <span className="flex items-center justify-between">
        <SponsoredArticleBadge />
        {article.categories && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-guinea-green">
            {article.categories.name}
          </span>
        )}
      </span>
      {article.featured_image && (
        <Image
          src={article.featured_image}
          alt={article.title}
          width={800}
          height={450}
          loading="lazy"
          unoptimized
          className="mt-3 h-40 w-full rounded-xl object-cover"
        />
      )}
      <h3 className="mt-2 line-clamp-2 font-display text-base font-bold leading-snug group-hover:text-guinea-red">
        {article.title}
      </h3>
      {article.excerpt && (
        <p className="mt-1.5 line-clamp-2 text-sm text-neutral-500 dark:text-neutral-400">{article.excerpt}</p>
      )}
      <span className="mt-3 block text-[10px] font-bold uppercase tracking-widest text-neutral-400">
        {String(creative.name)}
      </span>
    </Link>
  );
}