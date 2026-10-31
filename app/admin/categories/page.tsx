import { redirect } from "next/navigation";
import { FolderTree } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { getCategories } from "@/lib/data/categories";
import { deleteCategory } from "@/lib/actions/content";
import CategoryForm from "@/components/admin/CategoryForm";
import DeleteActionForm from "@/components/admin/DeleteActionForm";
import { ForbiddenScreen, NotFoundScreen, UnconfiguredScreen } from "@/components/admin/AccessDenied";

export const metadata = { title: "Catégories" };

export default async function AdminCategoriesPage() {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) {
    if (guard.denied === "unauthenticated") redirect("/admin/login");
    if (guard.denied === "unconfigured") return <UnconfiguredScreen />;
    return <ForbiddenScreen />;
  }

  const categories = await getCategories();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Catégories</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Rubriques du site public. Ce sont des structures éditoriales : une
          rubrique sans contenu reste vide — aucun article fictif n’est créé.
        </p>
      </header>

      <section className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-white/10 dark:bg-night-800">
        <h2 className="mb-4 flex items-center gap-2 font-display text-base font-bold">
          <FolderTree className="h-4 w-4 text-guinea-red" />
          Nouvelle rubrique
        </h2>
        <CategoryForm />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold">
          Rubriques existantes ({categories.length})
        </h2>

        {categories.length === 0 ? (
          <NotFoundScreen what="Aucune catégorie" />
        ) : (
          categories.map((c) => (
            <details
              key={c.id}
              className="rounded-2xl border border-neutral-200 bg-white dark:border-white/10 dark:bg-night-800"
            >
              <summary className="flex cursor-pointer flex-wrap items-center gap-3 p-4">
                <span className="text-xs font-bold uppercase tracking-wide text-guinea-green">
                  /{c.slug}
                </span>
                <span className="min-w-0 flex-1 truncate font-display text-base font-bold">
                  {c.name}
                </span>
                {c.description && (
                  <span className="hidden max-w-xs truncate text-xs text-neutral-400 sm:block">
                    {c.description}
                  </span>
                )}
              </summary>
              <div className="border-t border-neutral-200 p-4 dark:border-white/10">
                <CategoryForm category={c} />
                <div className="mt-4 border-t border-neutral-200 pt-3 dark:border-white/10">
                  <DeleteActionForm
                    action={deleteCategory}
                    hiddenFields={{ id: c.id }}
                    confirmLabel={`Supprimer « ${c.name} » ? Action irréversible — impossible si des articles ou vidéos l'utilisent encore.`}
                  />
                </div>
              </div>
            </details>
          ))
        )}
      </section>
    </div>
  );
}