import StudioEditor from "@/components/design/StudioEditor";
import { requireRole } from "@/lib/auth/session";
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
 * l'apparence SANS code. Session admin/éditeur exigée (garde serveur) :
 *  • éditeur : éditer le brouillon, prévisualiser ;
 *  • admin (seul) : PUBLIER et RESTAURER une version.
 * Aucun design en brouillon ne touche le site public : le brouillon vit
 * dans sa table (un par rédacteur), la publication est validée par le
 * schéma fermé puis revalidatePath("/", "layout").
 */
export const revalidate = 0;

export const metadata = { title: "Studio de design — Administration" };

export default async function StudioPage() {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-surface p-8 text-center dark:border-white/10 dark:bg-night-800">
        <h1 className="font-display text-xl font-extrabold text-neutral-900 dark:text-neutral-50">
          Studio de design
        </h1>
        <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
          {guard.denied === "unconfigured"
            ? "Base de données non configurée — le Studio sera disponible après connexion à Supabase."
            : guard.denied === "unauthenticated"
              ? "Connectez-vous à l'administration pour accéder au Studio de design."
              : "Le Studio est réservé aux administrateurs et éditeurs."}
        </p>
      </div>
    );
  }

  const canPublish = guard.session.profile?.role === "admin";
  const [published, draft, history, categories] = await Promise.all([
    getPublishedDesignCached(),
    getDraftForUser(guard.session.userId),
    canPublish ? getDesignHistory() : Promise.resolve([]),
    getCategories(),
  ]);

  const initial: DesignConfig = draft.config ?? published.config ?? DEFAULT_DESIGN;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-neutral-900 dark:text-neutral-50">
          Studio de design
        </h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Personnalisez l’apparence du site — prévisualisez, puis publiez.{" "}
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
