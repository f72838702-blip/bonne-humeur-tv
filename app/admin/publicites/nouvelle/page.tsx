import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { listAdvertisers, listPlacements } from "@/lib/data/ads";
import { getPublishedArticles } from "@/lib/data/articles";
import { ForbiddenScreen } from "@/components/admin/AccessDenied";
import NouvellePubliciteForm from "@/components/admin/NouvellePubliciteForm";
import { SIMPLE_DURATIONS, SIMPLE_FORMAT_CARDS, SIMPLE_PLACEMENT_LABELS } from "@/lib/ads/simple-ad";

export const metadata = { title: "Nouvelle publicité" };

/**
 * UNE PUBLICITÉ = UN FORMULAIRE = UNE PUBLICATION.
 * La page charge les données RÉELLES (annonceurs, emplacements et leurs
 * formats autorisés, articles publiés) ; la relation annonceur → campagne
 * → création → liaisons → approbation → activation se fait ENTÈREMENT
 * côté serveur (publishSimpleAdAction), sans jamais contourner la RLS.
 */
export default async function NouvellePublicitePage() {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) {
    if (guard.denied === "unauthenticated") redirect("/admin/login");
    return <ForbiddenScreen />;
  }
  const role = (guard.session.profile?.role ?? "reporter") as "admin" | "editor";

  const [advertisers, placements, articles] = await Promise.all([
    listAdvertisers(),
    listPlacements(),
    getPublishedArticles({ perPage: 200 }),
  ]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <Link href="/admin/publicites" className="text-xs font-semibold text-guinea-red hover:underline">← Publicités</Link>
        <h1 className="mt-1 font-display text-2xl font-extrabold sm:text-3xl">Nouvelle publicité</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Six étapes simples. À la publication, tout est créé automatiquement
          (entreprise, diffusion, visuel, emplacements) — vous ne manipulez
          jamais les termes techniques.
        </p>
      </header>

      <NouvellePubliciteForm
        role={role}
        advertisers={advertisers.map((a) => ({ id: a.id, name: a.name, is_active: a.is_active }))}
        placements={placements.map((p) => ({
          code: p.code,
          label: SIMPLE_PLACEMENT_LABELS[p.code] ?? p.label,
          allowed_formats: p.allowed_formats,
          is_active: p.is_active,
        }))}
        articles={articles.items
          .filter((a) => a.status === "published")
          .map((a) => ({ id: a.id, title: a.title }))}
        formats={SIMPLE_FORMAT_CARDS}
        durations={SIMPLE_DURATIONS.map((d) => ({ key: d.key, label: d.label }))}
      />
    </div>
  );
}