import { redirect } from "next/navigation";
import Image from "next/image";
import { ImagesIcon } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { listMedia } from "@/lib/data/media";
import { deleteMediaAction } from "@/lib/actions/admin";
import MediaUploader from "@/components/admin/MediaUploader";
import DeleteActionForm from "@/components/admin/DeleteActionForm";
import { ForbiddenScreen, NotFoundScreen, UnconfiguredScreen } from "@/components/admin/AccessDenied";

export const metadata = { title: "Médiathèque" };

export default async function AdminMediaPage() {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) {
    if (guard.denied === "unauthenticated") redirect("/admin/login");
    if (guard.denied === "unconfigured") return <UnconfiguredScreen />;
    return <ForbiddenScreen />;
  }

  const { objects, unavailable } = await listMedia();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Médiathèque</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Images de couverture des articles et visuels du site. Copiez l’URL
          d’un fichier pour la coller dans un article ou une vidéo.
        </p>
      </header>

      <section className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-white/10 dark:bg-night-800">
        <h2 className="mb-4 flex items-center gap-2 font-display text-base font-bold">
          <ImagesIcon className="h-4 w-4 text-guinea-red" />
          Téléverser une image
        </h2>
        <MediaUploader />
      </section>

      {unavailable ? (
        <UnconfiguredScreen />
      ) : objects.length === 0 ? (
        <NotFoundScreen what="Aucun fichier" />
      ) : (
        <section>
          <h2 className="mb-3 font-display text-lg font-bold">
            Fichiers ({objects.length})
          </h2>
          <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {objects.map((obj) => (
              <li
                key={obj.path}
                className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-white/10 dark:bg-night-800"
              >
                {/* Aperçu : URL publique réelle du Storage (Image optimisée) */}
                <div className="relative h-28 w-full">
                  <Image
                    src={obj.url}
                    alt={obj.name}
                    fill
                    sizes="(max-width: 1024px) 50vw, 25vw"
                    className="object-cover"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-2 p-3">
                  <p className="truncate text-[11px] font-semibold" title={obj.name}>
                    {obj.name}
                  </p>
                  <p className="text-[10px] text-neutral-400">
                    {Math.max(1, Math.round(obj.size / 1024))} Ko
                    {obj.type ? ` · ${obj.type.replace("image/", "")}` : ""}
                  </p>
                  {/* URL copiable — affichée en texte, sélectionnable */}
                  <input
                    readOnly
                    value={obj.url}
                    aria-label={`URL de ${obj.name}`}
                    onFocus={(e) => e.currentTarget.select()}
                    className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1 text-[10px] text-neutral-500 dark:border-white/10 dark:bg-night-900 dark:text-neutral-400"
                  />
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="text-[9px] text-neutral-400">{obj.type}</span>
                    <DeleteActionForm
                      action={deleteMediaAction}
                      hiddenFields={{ path: obj.path }}
                      confirmLabel={`Supprimer « ${obj.name} » du stockage ? Les articles qui utilisent cette image perdront leur visuel.`}
                      buttonLabel="Supprimer"
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}