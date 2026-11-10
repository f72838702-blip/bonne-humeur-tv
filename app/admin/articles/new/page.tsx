import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { hasAnyPermission } from "@/lib/auth/permissions";
import { getCategories } from "@/lib/data/categories";
import ArticleForm from "@/components/admin/ArticleForm";
import { ForbiddenScreen, UnconfiguredScreen } from "@/components/admin/AccessDenied";

export const metadata = { title: "Nouvel article" };

export default async function NewArticlePage() {
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

  const categories = await getCategories();
  const role = guard.session.profile?.role ?? "reporter";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Rédiger un article</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Contenu réel uniquement — aucun article fictif ne sera publié.
          </p>
        </div>
        <Link
          href="/admin/articles"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-500 hover:text-guinea-red dark:text-neutral-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Articles
        </Link>
      </header>

      <div className="rounded-2xl border border-neutral-200 bg-surface p-6 dark:border-white/10 dark:bg-night-800">
        <ArticleForm categories={categories} role={role} />
      </div>
    </div>
  );
}