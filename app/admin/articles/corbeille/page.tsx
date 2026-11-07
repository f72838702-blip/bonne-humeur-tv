import Link from "next/link";
import { redirect } from "next/navigation";
import { Trash2 } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { getTrashedArticles } from "@/lib/data/admin-content";
import { restoreArticle } from "@/lib/actions/content";
import { formatDateTime } from "@/lib/utils";
import StatusBadge from "@/components/admin/StatusBadge";
import DeleteActionForm from "@/components/admin/DeleteActionForm";
import { NotFoundScreen, UnconfiguredScreen, ForbiddenScreen } from "@/components/admin/AccessDenied";

export const metadata = { title: "Corbeille des articles" };

/**
 * Corbeille des articles (migration 0035, demande direction 07/11) :
 * un article « supprimé » est placé en corbeille 30 jours, restaurable
 * par admin/editor, puis purgé durement chaque nuit (pg_cron). Cette
 * page est la SEULE à lister les lignes supprimées.
 */
export default async function AdminArticlesCorbeillePage() {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) {
    if (guard.denied === "unauthenticated") redirect("/admin/login");
    if (guard.denied === "unconfigured") return <UnconfiguredScreen />;
    return <ForbiddenScreen />;
  }

  const trashed = await getTrashedArticles();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold sm:text-3xl">
            <Trash2 className="h-6 w-6 text-guinea-red" aria-hidden="true" />
            Corbeille des articles
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Les articles supprimés restent ici 30 jours, restaurables — puis
            sont purgés automatiquement chaque nuit. Rien n&apos;est immédiatement
            perdu.
          </p>
        </div>
        <Link
          href="/admin/articles"
          className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-bold text-neutral-600 transition-colors hover:text-neutral-900 dark:border-white/10 dark:text-neutral-300"
        >
          ← Retour aux articles
        </Link>
      </header>

      {trashed.length === 0 ? (
        <NotFoundScreen what="La corbeille est vide" />
      ) : (
        <ul className="flex flex-col gap-3">
          {trashed.map((article) => (
            <li
              key={article.id}
              className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-surface p-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10 dark:bg-night-800"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={article.status} />
                </div>
                <p className="mt-1.5 truncate font-display text-base font-bold">
                  {article.title}
                </p>
                <p className="mt-0.5 text-xs text-neutral-400">
                  {article.author_name ?? "Auteur inconnu"} · supprimé le{" "}
                  {formatDateTime(article.deleted_at)}
                  {article.deleted_by ? ` par ${article.deleted_by}` : ""}
                  {article.published_at
                    ? ` · publié le ${formatDateTime(article.published_at)}`
                    : ""}
                   · purge automatique 30 jours après la suppression
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <DeleteActionForm
                  tone="green"
                  action={restoreArticle}
                  hiddenFields={{ id: article.id }}
                  buttonLabel="Restaurer"
                  pendingLabel="Restauration…"
                  confirmLabel={`Restaurer « ${article.title} » dans la liste d'articles ? Il réapparaîtra immédiatement (public ou rédaction selon son statut).`}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
