import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Eye } from "lucide-react";
import HeroPlayer from "@/components/home/HeroPlayer";
import VideoCard from "@/components/video/VideoCard";
import ShareButtons from "@/components/video/ShareButtons";
import { videos, getVideoBySlug, getRelatedVideos, CATEGORY_LABELS } from "@/lib/videos";
import { formatDate, formatViews } from "@/lib/utils";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bonne-humeur-tv.vercel.app";

export function generateStaticParams() {
  return videos.map((v) => ({ slug: v.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const video = getVideoBySlug(slug);
  if (!video) return { title: "Vidéo introuvable" };
  return {
    title: video.title,
    description: video.excerpt,
    openGraph: {
      type: "video.other",
      title: video.title,
      description: video.excerpt,
      url: `${siteUrl}/videos/${video.slug}`,
    },
    twitter: { card: "summary_large_image", title: video.title, description: video.excerpt },
  };
}

export default async function VideoDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const video = getVideoBySlug(slug);
  if (!video) notFound();

  const related = getRelatedVideos(video);
  const url = `${siteUrl}/videos/${video.slug}`;

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
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
            <span className="rounded-full bg-guinea-red/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-guinea-red">
              {CATEGORY_LABELS[video.category]}
            </span>
            <h1 className="mt-3 font-display text-2xl font-extrabold sm:text-3xl">
              {video.title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-neutral-500 dark:text-neutral-400">
              <span className="flex items-center gap-1.5">
                <Eye className="h-4 w-4" /> {formatViews(video.views)} vues
              </span>
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" /> {formatDate(video.publishedAt)}
              </span>
            </div>
            <p className="mt-4 max-w-3xl leading-relaxed text-neutral-600 dark:text-neutral-300">
              {video.excerpt}
            </p>
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
            {related.map((v) => (
              <VideoCard key={v.slug} video={v} />
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
