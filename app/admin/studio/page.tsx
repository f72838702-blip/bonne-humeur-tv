import StudioEditor from "@/components/design/StudioEditor";
import { isSuperAdmin, getSessionInfo } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import {
  getPublishedDesignCached,
  getDraftForUser,
  getDesignHistory,
} from "@/lib/design/data";
import { DEFAULT_DESIGN } from "@/lib/design/default";
import { getCategories } from "@/lib/data/categories";
import type { DesignConfig } from "@/lib/design/schema";

/**
 * STUDIO DE DESIGN (onglet administration) — la direction personnalise
 * l'apparence SANS code. Réservé au SUPER ADMINISTRATEUR (garde serveur) :
 *  • édition du brouillon, prévisualisation, publication, restauration.
 * Aucun design en brouillon ne touche le site public : le brouillon vit
 * dans sa table (un par rédacteur), la publication est validée par le
 * schéma fermé puis revalidatePath("/", "layout").
 */
export const revalidate = 0;

export const metadata = { title: "Studio de design — Administration" };

export default async function StudioPage() {
  const ok = await isSuperAdmin();
  if (!ok) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-surface p-8 text-center dark:border-white/10 dark:bg-night-800">
        <h1 className="font-display text-xl font-extrabold text-neutral-900 dark:text-neutral-50">
          Studio de design
        </h1>
        <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
          Le Studio est réservé au Super Administrateur — connectez-vous à
          l&apos;administration (la base de données doit être configurée).
        </p>
      </div>
    );
  }

  const session = await getSessionInfo();
  if (!session) redirect("/admin/login");

  const canPublish =
    session.profile?.role === "admin" || session.profile?.role === "super_admin";
  const [published, draft, history, categories] = await Promise.all([
    getPublishedDesignCached(),
    getDraftForUser(session.userId),
    canPublish ? getDesignHistory() : Promise.resolve([]),
    getCategories(),
  ]);

  const initial: DesignConfig = draft.config ?? published.config ?? DEFAULT_DESIGN;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-neutral-900 dark:text-neutral-50">
          Personnalisez l’apparence de votre site
        </h1>
        <p className="mt-1 text-sm font-medium text-neutral-600 dark:text-neutral-200">
          Choisissez un design, visualisez-le et publiez-le en quelques clics.
        </p>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          {published.updatedAt
            ? `Design publié pour la dernière fois le ${new Date(published.updatedAt).toLocaleString("fr-FR")}.`
            : "Aucun design personnalisé publié — le socle par défaut s'applique."}
        </p>
      </div>

      <StudioEditor
        initial={initial}
        publishedConfig={published.config}
        draftUpdatedAt={draft.updatedAt}
        canPublish={canPublish}
        history={history.map((h) => ({
          id: h.id,
          note: h.note,
          createdAt: h.createdAt,
        }))}
        categories={categories.map((c) => ({ slug: c.slug, name: c.name }))}
      />
    </div>
  );
}
