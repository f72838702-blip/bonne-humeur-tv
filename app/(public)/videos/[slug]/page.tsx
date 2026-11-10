import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays } from "lucide-react";
import HeroPlayer from "@/components/home/HeroPlayer";
import VideoCard from "@/components/video/VideoCard";
import ShareButtons from "@/components/video/ShareButtons";
import JsonLd from "@/components/shared/JsonLd";
import { getPublishedVideoBySlug, getRelatedVideos } from "@/lib/data/videos";
import { formatDate } from "@/lib/utils";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bonnehumeur.info";

/** Page vidéo — données réelles uniquement ; JSON-LD si et seulement si les champs requis existent. */
export const revalidate = 120;

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const video = await getPublishedVideoBySlug(slug);
  if (!video) return { title: "Vidéo introuvable" };

  const description = video.description ?? "Émission de Bonne Humeur TV, la Télé de la nouvelle génération.";
  const thumbnail =
    video.thumbnail_url ?? `https://i.ytimg.com/vi/${video.youtube_id}/hqdefault.jpg`;

  return {
    title: video.title,
    description,
    alternates: { canonical: `/videos/${video.slug}` },
    openGraph: {
      type: "video.other",
      title: video.title,
      description,
      url: `${siteUrl}/videos/${video.slug}`,
      images: [{ url: thumbnail }],
    },
    twitter: {
      card: "summary_large_image",
      title: video.title,
      description,
      images: [thumbnail],
    },
  };
}

export default async function VideoDetailPage({ params }: Params) {
  const { slug } = await params;
  const video = await getPublishedVideoBySlug(slug);
  if (!video) notFound();

  const related = await getRelatedVideos(video);
  const url = `${siteUrl}/videos/${video.slug}`;
  const thumbnail =
    video.thumbnail_url ?? `https://i.ytimg.com/vi/${video.youtube_id}/hqdefault.jpg`;

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* VideoObject : uniquement avec des données réelles (uploadDate requis) */}
      {video.published_at && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "VideoObject",
            name: video.title,
            description: video.description ?? undefined,
            thumbnailUrl: [thumbnail],
            uploadDate: video.published_at,
            embedUrl: `https://www.youtube-nocookie.com/embed/${video.youtube_id}`,
            publisher: {
              "@type": "Organization",
              name: "Bonne Humeur TV",
              url: siteUrl,
            },
          }}
        />
      )}

      <Link
        href="/videos"
        className="inline-flex items-center gap-2 text-sm font-medium text-neutral-500 transition-colors hover:text-guinea-red"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux vidéos
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div>
          <HeroPlayer video={video} />

          <div className="mt-6">
            {video.categories && (
              <span className="rounded-full bg-guinea-red/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-guinea-red">
                {video.categories.name}
              </span>
            )}
            <h1 className="mt-3 font-display text-2xl font-extrabold sm:text-3xl">
              {video.title}
            </h1>
            {video.published_at && (
              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-neutral-500 dark:text-neutral-400">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" /> Publiée le {formatDate(video.published_at)}
                </span>
                {video.is_live && (
                  <span className="rounded-full bg-guinea-red px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-white">
                    En direct
                  </span>
                )}
              </div>
            )}
            {video.description && (
              <p className="mt-4 max-w-3xl whitespace-pre-line leading-relaxed text-neutral-600 dark:text-neutral-300">
                {video.description}
              </p>
            )}
            <div className="mt-6 flex items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">
                Partager
              </span>
              <ShareButtons url={url} title={video.title} />
            </div>
          </div>
        </div>

        <aside>
          <h2 className="font-display text-sm font-extrabold uppercase tracking-widest text-guinea-red">
            Vidéos recommandées
          </h2>
          <div className="mt-4 grid gap-4">
            {related.length === 0 ? (
              <p className="rounded-xl bg-neutral-100 px-4 py-6 text-center text-sm text-neutral-500 dark:bg-white/5 dark:text-neutral-400">
                Aucune autre vidéo publiée pour le moment.
              </p>
            ) : (
              related.map((v) => <VideoCard key={v.slug} video={v} />)
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}