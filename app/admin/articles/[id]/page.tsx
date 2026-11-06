import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { getCategories } from "@/lib/data/categories";
import { getStaffArticleById } from "@/lib/data/admin-content";
import ArticleForm from "@/components/admin/ArticleForm";
import { ForbiddenScreen, NotFoundScreen, UnconfiguredScreen } from "@/components/admin/AccessDenied";

export const metadata = { title: "Modifier l'article" };

export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const guard = await requireRole(["admin", "editor", "reporter"]);
  if ("denied" in guard) {
    if (guard.denied === "unauthenticated") redirect("/admin/login");
    if (guard.denied === "unconfigured") return <UnconfiguredScreen />;
    return <ForbiddenScreen />;
  }

  const { id } = await params;
  // UUID invalide → refus neutre immédiat (aucune requête base inutile).
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    notFound();
  }

  const [article, categories] = await Promise.all([
    getStaffArticleById(id),
    getCategories(),
  ]);

  // Null = inexistant OU hors périmètre RLS (autre auteur pour un reporter,
  // autre école de rédaction…) → même écran neutre, sans oracle.
  if (!article) return <NotFoundScreen what="Article" />;

  const role = guard.session.profile?.role ?? "reporter";
  const isStaff = role === "admin" || role === "editor";
  const isPublished = article.status === "published" && article.published_at;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-extrabold sm:text-3xl">
            {article.title}
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Dernière mise à jour : {new Date(article.updated_at).toLocaleString("fr-FR")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isPublished && (
            <Link
              href={`/actualites/${article.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 px-4 py-2 text-xs font-bold text-neutral-600 hover:border-guinea-red/50 hover:text-guinea-red dark:border-white/10 dark:text-neutral-300"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Voir en ligne
            </Link>
          )}
          <Link
            href="/admin/articles"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-500 hover:text-guinea-red dark:text-neutral-400"
          >
            <ArrowLeft className="h-4 w-4" />
            Articles
          </Link>
        </div>
      </header>

      <div className="rounded-2xl border border-neutral-200 bg-surface p-6 dark:border-white/10 dark:bg-night-800">
        <ArticleForm categories={categories} role={role} article={article} />
      </div>

      {isStaff && article.tags && article.tags.length > 0 && (
        <p className="text-xs text-neutral-400">
          Tags actuels : {article.tags.map((t) => t.name).join(", ")}
        </p>
      )}
    </div>
  );
}