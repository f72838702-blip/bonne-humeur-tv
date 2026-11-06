import type { MetadataRoute } from "next";
import { getPublishedArticles } from "@/lib/data/articles";
import { getPublishedVideos } from "@/lib/data/videos";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bonne-humeur-tv.bonne-humeur-tv.workers.dev";

/**
 * Sitemap dynamique : uniquement les pages réelles et les contenus
 * RÉELLEMENT publiés (aucune URL fictive ; vide honnêtement si le
 * backend n'est pas configuré).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    "",
    "/actualites",
    "/videos",
    "/partenariats",
    "/contact",
    "/mentions-legales",
    "/confidentialite",
  ].map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : 0.7,
  }));

  const [articles, videos] = await Promise.all([
    getPublishedArticles({ page: 1, perPage: 200 }),
    getPublishedVideos(200),
  ]);

  const articleUrls: MetadataRoute.Sitemap = articles.items.map((a) => ({
    url: `${siteUrl}/actualites/${a.slug}`,
    lastModified: a.updated_at ? new Date(a.updated_at) : undefined,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  const videoUrls: MetadataRoute.Sitemap = videos.map((v) => ({
    url: `${siteUrl}/videos/${v.slug}`,
    lastModified: v.updated_at ? new Date(v.updated_at) : undefined,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticPages, ...articleUrls, ...videoUrls];
}