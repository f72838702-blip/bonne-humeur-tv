import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { getCategories } from "@/lib/data/categories";
import VideoForm from "@/components/admin/VideoForm";
import { ForbiddenScreen, UnconfiguredScreen } from "@/components/admin/AccessDenied";

export const metadata = { title: "Nouvelle vidéo" };

export default async function NewVideoPage() {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) {
    if (guard.denied === "unauthenticated") redirect("/admin/login");
    if (guard.denied === "unconfigured") return <UnconfiguredScreen />;
    return <ForbiddenScreen />;
  }

  if (guard.session.profile?.role === "editor" && !hasPermission(guard.session.profile, "videos")) {
    return <ForbiddenScreen />;
  }

  const categories = await getCategories();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Ajouter une vidéo</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Collez l’ID d’une vraie vidéo YouTube de la chaîne Bonne Humeur Média.
          </p>
        </div>
        <Link
          href="/admin/videos"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-500 hover:text-guinea-red dark:text-neutral-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Vidéos
        </Link>
      </header>

      <div className="rounded-2xl border border-neutral-200 bg-surface p-6 dark:border-white/10 dark:bg-night-800">
        <VideoForm categories={categories} />
      </div>
    </div>
  );
}