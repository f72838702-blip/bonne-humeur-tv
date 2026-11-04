import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { getCategories } from "@/lib/data/categories";
import { getStaffVideoById } from "@/lib/data/admin-content";
import VideoForm from "@/components/admin/VideoForm";
import { ForbiddenScreen, NotFoundScreen, UnconfiguredScreen } from "@/components/admin/AccessDenied";

export const metadata = { title: "Modifier la vidéo" };

export default async function EditVideoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) {
    if (guard.denied === "unauthenticated") redirect("/admin/login");
    if (guard.denied === "unconfigured") return <UnconfiguredScreen />;
    return <ForbiddenScreen />;
  }

  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    notFound();
  }

  const [video, categories] = await Promise.all([
    getStaffVideoById(id),
    getCategories(),
  ]);

  if (!video) return <NotFoundScreen what="Vidéo" />;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-extrabold sm:text-3xl">{video.title}</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">ID YouTube : {video.youtube_id}</p>
        </div>
        <div className="flex items-center gap-3">
          {video.status === "published" && (
            <Link
              href={`/videos/${video.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 px-4 py-2 text-xs font-bold text-neutral-600 hover:border-guinea-red/50 hover:text-guinea-red dark:border-white/10 dark:text-neutral-300"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Voir en ligne
            </Link>
          )}
          <Link
            href="/admin/videos"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-500 hover:text-guinea-red dark:text-neutral-400"
          >
            <ArrowLeft className="h-4 w-4" />
            Vidéos
          </Link>
        </div>
      </header>

      <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-white/10 dark:bg-night-800">
        <VideoForm categories={categories} video={video} />
      </div>
    </div>
  );
}