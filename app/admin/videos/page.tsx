import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Plus, Video } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { getStaffVideos } from "@/lib/data/admin-content";
import { deleteVideo } from "@/lib/actions/content";
import { formatDateTime } from "@/lib/utils";
import StatusBadge from "@/components/admin/StatusBadge";
import DeleteActionForm from "@/components/admin/DeleteActionForm";
import { ForbiddenScreen, NotFoundScreen, UnconfiguredScreen } from "@/components/admin/AccessDenied";

export const metadata = { title: "Vidéos" };

export default async function AdminVideosPage() {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) {
    if (guard.denied === "unauthenticated") redirect("/admin/login");
    if (guard.denied === "unconfigured") return <UnconfiguredScreen />;
    return <ForbiddenScreen />;
  }

  const videos = await getStaffVideos();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Vidéos</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Émissions et reportages de la chaîne — uniquement de vraies vidéos YouTube.
          </p>
        </div>
        <Link
          href="/admin/videos/new"
          className="inline-flex items-center gap-2 rounded-xl bg-guinea-red px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-guinea-red/90"
        >
          <Plus className="h-4 w-4" />
          Ajouter une vidéo
        </Link>
      </header>

      {videos.length === 0 ? (
        <NotFoundScreen what="Aucune vidéo" />
      ) : (
        <ul className="flex flex-col gap-3">
          {videos.map((video) => (
            <li
              key={video.id}
              className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-surface p-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10 dark:bg-night-800"
            >
              <div className="flex min-w-0 items-center gap-4">
                {/* Miniature réelle depuis l'ID YouTube — dimension adaptée
                    (mqdefault 320 px), pas de réoptimisation serveur. */}
                <div className="relative hidden h-14 w-24 shrink-0 sm:block">
                  <Image
                    src={`https://i.ytimg.com/vi/${video.youtube_id}/mqdefault.jpg`}
                    alt={`Miniature de ${video.title}`}
                    fill
                    sizes="96px"
                    loading="lazy"
                    unoptimized
                    className="rounded-lg object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={video.status} />
                    {video.is_live && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-guinea-red/15 px-2 py-0.5 text-[10px] font-bold uppercase text-guinea-red">
                        <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-guinea-red" />
                        Direct
                      </span>
                    )}
                    {video.is_featured && (
                      <span className="text-[10px] font-bold uppercase tracking-wide text-guinea-yellow">
                        À la une
                      </span>
                    )}
                    {video.categories && (
                      <span className="text-[10px] font-bold uppercase tracking-wide text-guinea-green">
                        {video.categories.name}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 truncate font-display text-base font-bold">{video.title}</p>
                  <p className="mt-0.5 text-xs text-neutral-400">
                    ID : {video.youtube_id}
                    {video.published_at ? ` · publié le ${formatDateTime(video.published_at)}` : " · non publiée"}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/admin/videos/${video.id}`}
                  className="rounded-lg px-3 py-1.5 text-xs font-bold text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-white/10"
                >
                  <Video className="mr-1 inline h-3.5 w-3.5" />
                  Modifier
                </Link>
                <DeleteActionForm
                  action={deleteVideo}
                  hiddenFields={{ id: video.id }}
                  confirmLabel={`Supprimer définitivement « ${video.title} » ? Cette action est irréversible.`}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}