import type { Metadata } from "next";
import VideosGallery from "@/components/video/VideosGallery";
import { videos } from "@/lib/videos";

export const metadata: Metadata = {
  title: "Vidéos & Émissions",
  description:
    "Toutes les émissions de Bonne Humeur TV : société, culture, économie, éducation et institutionnel — recherche instantanée et filtres par thématique.",
};

export default function VideosPage() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
        Vidéos & <span className="text-guinea-red">Émissions</span>
      </h1>
      <p className="mt-2 max-w-xl text-sm text-neutral-500 dark:text-neutral-400">
        Retrouvez l'intégralité de nos programmes, filtrables par thématique.
      </p>
      <div className="mt-8">
        <VideosGallery videos={videos} />
      </div>
    </section>
  );
}
