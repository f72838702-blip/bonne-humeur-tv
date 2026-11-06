import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock, PenLine } from "lucide-react";
import ArticleCard from "@/components/shared/ArticleCard";
import EmptyState from "@/components/shared/EmptyState";
import JsonLd from "@/components/shared/JsonLd";
import YouTubeEmbed from "@/components/shared/YouTubeEmbed";
import ShareButtons from "@/components/video/ShareButtons";
import AdSlot from "@/components/publicite/AdSlot";
import { getPublishedArticleBySlug, getRelatedArticles } from "@/lib/data/articles";
import { renderArticleSegments, extractArticleYouTubeIds, markdownToPlainText } from "@/lib/content/markdown";
import { youtubeEmbedUrl, youtubeThumbnailUrl, youtubeWatchUrl } from "@/lib/youtube/url";
import { formatDate, readingTimeMinutes, truncateWords } from "@/lib/utils";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bonne-humeur-tv.bonne-humeur-tv.workers.dev";

export const revalidate = 120;

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const article = await getPublishedArticleBySlug(slug);
  if (!article) return { title: "Article introuvable" };

  const description =
    article.meta_description ??
    article.excerpt ??
    truncateWords(markdownToPlainText(article.content), 30);
  const images = article.featured_image ? [{ url: article.featured_image }] : undefined;

  return {
    title: article.meta_title ?? article.title,
    description,
    alternates: { canonical: `/actualites/${article.slug}` },
    openGraph: {
      type: "article",
      title: article.meta_title ?? article.title,
      description,
      url: `${siteUrl}/actualites/${article.slug}`,
      images,
      publishedTime: article.published_at ?? undefined,
      modifiedTime: article.updated_at,
    },
    twitter: {
      card: "summary_large_image",
      title: article.meta_title ?? article.title,
      description,
      images: article.featured_image ? [article.featured_image] : undefined,
    },
  };
}

export default async function ArticlePage({ params }: Params) {
  const { slug } = await params;
  const article = await getPublishedArticleBySlug(slug);
  if (!article) notFound();

  const related = await getRelatedArticles(article);
  // Corps rendu en segments : blocs Markdown SÛR + blocs vidéo YouTube
  // validés (l'iframe n'est construite qu'à partir d'un ID revalidé).
  const segments = renderArticleSegments(article.content);
  const readingTime = readingTimeMinutes(article.content);
  const author = article.author_name ?? "Rédaction Bonne Humeur TV";
  const url = `${siteUrl}/actualites/${article.slug}`;
  // SEO vidéo : les données structurées VideoObject ne sont produites QUE
  // si au moins un bloc vidéo valide existe réellement dans le corps.
  const videoIds = extractArticleYouTubeIds(article.content);

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Données structurées : données réelles de l'article uniquement */}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "NewsArticle",
          headline: article.title,
          description:
            article.meta_description ??
            article.excerpt ??
            truncateWords(markdownToPlainText(article.content), 30),
          // ALT réel de la couverture en légende d'image structurée (SEO).
          image: article.featured_image
            ? article.featured_image_alt
              ? [{ "@type": "ImageObject", url: article.featured_image, caption: article.featured_image_alt }]
              : [article.featured_image]
            : undefined,
          datePublished: article.published_at ?? undefined,
          dateModified: article.updated_at,
          author: { "@type": "Person", name: author },
          publisher: {
            "@type": "Organization",
            name: "Bonne Humeur TV",
            url: siteUrl,
          },
          mainEntityOfPage: url,
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Accueil", item: siteUrl },
            { "@type": "ListItem", position: 2, name: "Actualités", item: `${siteUrl}/actualites` },
            {
              "@type": "ListItem",
              position: 3,
              name: article.title,
              item: url,
            },
          ],
        }}
      />

      {/* SEO vidéo — déclaré UNIQUEMENT pour les blocs réellement valides */}
      {videoIds.map((id) => (
        <JsonLd
          key={id}
          data={{
            "@context": "https://schema.org",
            "@type": "VideoObject",
            name: article.title,
            description:
              article.meta_description ??
              article.excerpt ??
              truncateWords(markdownToPlainText(article.content), 30),
            thumbnailUrl: youtubeThumbnailUrl(id, "hq"),
            embedUrl: youtubeEmbedUrl(id),
            contentUrl: youtubeWatchUrl(id),
            uploadDate: article.published_at ?? article.created_at,
            publisher: {
              "@type": "Organization",
              name: "Bonne Humeur TV",
              url: siteUrl,
            },
          }}
        />
      ))}

      <nav
        aria-label="Fil d'Ariane"
        className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400"
      >
        <Link href="/actualites" className="inline-flex items-center gap-2 transition-colors hover:text-guinea-red">
          <ArrowLeft className="h-4 w-4" />
          Toutes les actualités
        </Link>
        {article.categories && (
          <>
            <span>/</span>
            <Link
              href={`/actualites/categorie/${article.categories.slug}`}
              className="transition-colors hover:text-guinea-red"
            >
              {article.categories.name}
            </Link>
          </>
        )}
      </nav>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <article className="min-w-0">
          {article.categories && (
            <span className="rounded-full bg-guinea-green/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-guinea-green">
              {article.categories.name}
            </span>
          )}
          <h1 className="mt-4 text-balance font-display text-3xl font-extrabold leading-tight sm:text-4xl">
            {article.title}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-neutral-500 dark:text-neutral-400">
            <span className="flex items-center gap-1.5">
              <PenLine className="h-4 w-4" />
              {author}
            </span>
            {article.published_at && (
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" />
                {formatDate(article.published_at)}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {readingTime} min de lecture
            </span>
          </div>

          {article.featured_image && (
            <Image
              src={article.featured_image}
              alt={article.featured_image_alt ?? `Illustration de l'article : ${article.title}`}
              width={1920}
              height={1080}
              priority
              unoptimized
              className="mt-6 aspect-video w-full rounded-2xl border border-neutral-200 object-cover dark:border-white/10"
            />
          )}

          {article.excerpt && (
            <p className="mt-6 border-l-4 border-guinea-red pl-4 text-lg font-medium leading-relaxed text-neutral-700 dark:text-neutral-200">
              {article.excerpt}
            </p>
          )}

          {/* Corps de l'article : Markdown rendu SÛR côté serveur (échappé
              avant parsing — aucun HTML non fiable n'est exécuté), segmenté
              avec les blocs vidéo YouTube validés. */}
          <div className="mt-8 leading-relaxed text-neutral-800 dark:text-neutral-200 [&_a]:font-semibold [&_a]:text-guinea-red [&_a]:underline-offset-2 [&_a]:hover:underline [&_blockquote]:border-l-4 [&_blockquote]:border-guinea-yellow [&_blockquote]:pl-4 [&_blockquote]:italic [&_code]:rounded [&_code]:bg-neutral-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-sm dark:[&_code]:bg-white/10 [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-extrabold [&_h3]:mt-8 [&_h3]:font-display [&_h3]:text-xl [&_h3]:font-bold [&_hr]:my-8 [&_hr]:border-neutral-200 dark:[&_hr]:border-white/10 [&_img]:my-6 [&_img]:rounded-xl [&_li]:my-1 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-4 [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-night-900 [&_pre]:p-4 [&_pre]:text-sm [&_pre]:text-neutral-100 [&_table]:my-6 [&_table]:w-full [&_td]:border-t [&_td]:border-neutral-200 [&_td]:px-3 [&_td]:py-2 dark:[&_td]:border-white/10 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6">
            {segments.map((segment, index) =>
              segment.type === "youtube" ? (
                <YouTubeEmbed key={index} id={segment.id} />
              ) : (
                segment.html.trim() && (
                  <div key={index} dangerouslySetInnerHTML={{ __html: segment.html }} />
                )
              )
            )}
          </div>

          {/* Insertion publicitaire en lecture (additif — corps intact) */}
          <AdSlot code="article_inline" className="mt-8" />

          <div className="mt-10 flex items-center gap-3 border-t border-neutral-200 pt-6 dark:border-white/10">
            <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">
              Partager l&apos;article
            </span>
            <ShareButtons url={url} title={article.title} />
          </div>
        </article>

        {/* Emplacement bas d'article (additif) */}
        <AdSlot code="article_bottom" className="mt-6" />

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <h2 className="font-display text-sm font-extrabold uppercase tracking-widest text-guinea-red">
            À lire aussi
          </h2>
          <div className="mt-4 grid gap-4">
            {related.length === 0 ? (
              <p className="rounded-xl bg-neutral-100 px-4 py-6 text-center text-sm text-neutral-500 dark:bg-white/5 dark:text-neutral-400">
                Aucun autre article publié pour le moment.
              </p>
            ) : (
              related.map((a) => <ArticleCard key={a.id} article={a} />)
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}