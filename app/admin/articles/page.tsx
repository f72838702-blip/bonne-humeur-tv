import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, Plus, Trash2 } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { hasAnyPermission } from "@/lib/auth/permissions";
import { getStaffArticles } from "@/lib/data/admin-content";
import { deleteArticle, publishArticle } from "@/lib/actions/content";
import { formatDateTime } from "@/lib/utils";
import type { ContentStatus } from "@/lib/types";
import StatusBadge from "@/components/admin/StatusBadge";
import DeleteActionForm from "@/components/admin/DeleteActionForm";
import { ForbiddenScreen, NotFoundScreen, UnconfiguredScreen } from "@/components/admin/AccessDenied";

export const metadata = { title: "Articles" };

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Tous" },
  { value: "draft", label: "Brouillons" },
  { value: "review", label: "À valider" },
  { value: "scheduled", label: "Programmés" },
  { value: "published", label: "Publiés" },
  { value: "archived", label: "Archivés" },
];

export default async function AdminArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string }>;
}) {
  const guard = await requireRole(["admin", "editor", "reporter"]);
  if ("denied" in guard) {
    if (guard.denied === "unauthenticated") redirect("/admin/login");
    if (guard.denied === "unconfigured") return <UnconfiguredScreen />;
    return <ForbiddenScreen />;
  }

  if (
    guard.session.profile?.role === "editor" &&
    !hasAnyPermission(guard.session.profile, ["articles", "articles_tous", "articles_publier"])
  ) {
    return <ForbiddenScreen />;
  }

  const { statut } = await searchParams;
  const status = (statut as ContentStatus | undefined) ?? undefined;
  const articles = await getStaffArticles(status);

  const role = guard.session.profile?.role ?? "reporter";
  const isStaff =
    role === "admin" || role === "super_admin" || role === "editor";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Articles</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {isStaff
              ? "Tous les contenus de la rédaction, tous statuts."
              : "Vos articles — un éditeur les valide avant publication."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Corbeille (migration 0035) : suppression réversible 30 jours. */}
          <Link
            href="/admin/articles/corbeille"
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-bold text-neutral-600 transition-colors hover:text-neutral-900 dark:border-white/10 dark:text-neutral-300"
          >
            <Trash2 className="h-4 w-4" />
            Corbeille
          </Link>
          <Link
            href="/admin/articles/new"
            className="inline-flex items-center gap-2 rounded-xl bg-guinea-red px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-guinea-red/90"
          >
            <Plus className="h-4 w-4" />
            Rédiger un article
          </Link>
        </div>
      </header>

      {/* Filtres par statut (pilotés par l'URL) */}
      <nav className="flex flex-wrap gap-2" aria-label="Filtrer par statut">
        {STATUS_FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value ? `/admin/articles?statut=${f.value}` : "/admin/articles"}
            className={
              (statut ?? "") === f.value
                ? "rounded-full border border-guinea-red bg-guinea-red px-4 py-1.5 text-xs font-bold text-white"
                : "rounded-full border border-neutral-200 px-4 py-1.5 text-xs font-semibold text-neutral-600 transition-colors hover:border-guinea-red/50 hover:text-guinea-red dark:border-white/10 dark:text-neutral-300"
            }
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {articles.length === 0 ? (
        <NotFoundScreen what="Aucun article" />
      ) : (
        <ul className="flex flex-col gap-3">
          {articles.map((article) => (
            <li
              key={article.id}
              className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-surface p-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10 dark:bg-night-800"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={article.status} />
                  {article.categories && (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-guinea-green">
                      {article.categories.name}
                    </span>
                  )}
                  {article.is_featured && (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-guinea-yellow">
                      À la une
                    </span>
                  )}
                </div>
                <Link
                  href={`/admin/articles/${article.id}`}
                  className="mt-1.5 block truncate font-display text-base font-bold hover:text-guinea-red"
                >
                  {article.title}
                </Link>
                <p className="mt-0.5 text-xs text-neutral-400">
                  {article.author_name ?? "Auteur inconnu"} · maj {formatDateTime(article.updated_at)}
                  {article.published_at ? ` · publié le ${formatDateTime(article.published_at)}` : ""}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/admin/articles/${article.id}`}
                  className="rounded-lg px-3 py-1.5 text-xs font-bold text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-white/10"
                >
                  <FileText className="mr-1 inline h-3.5 w-3.5" />
                  Modifier
                </Link>
                {/* Publication rapide (staff uniquement) — brouillons et articles à valider. */}
                {isStaff && (article.status === "draft" || article.status === "review") && (
                  <DeleteActionForm
                    tone="green"
                    action={publishArticle}
                    hiddenFields={{ id: article.id }}
                    buttonLabel="Publier"
                    pendingLabel="Publication…"
                    confirmLabel={`Publier « ${article.title} » sur le site public ? Il sera visible immédiatement sur /actualites.`}
                  />
                )}
                {isStaff && (
                  <DeleteActionForm
                    action={deleteArticle}
                    hiddenFields={{ id: article.id }}
                    confirmLabel={`Placer « ${article.title} » dans la corbeille ? Il sera invisible du site mais RESTAURABLE pendant 30 jours (Corbeille, en haut à droite).`}
                    pendingLabel="Corbeille…"
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}