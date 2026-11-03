import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { listPlacements } from "@/lib/data/ads";
import { AD_PLACEMENT_LABELS, type AdPlacementCode } from "@/lib/ads/ads-core";
import { PlacementForm } from "@/components/admin/AdsForms";
import { ForbiddenScreen, NotFoundScreen } from "@/components/admin/AccessDenied";

export const metadata = { title: "Emplacements publicitaires" };

/**
 * Configuration des 8 emplacements initiaux — codes STABLES branchés
 * dans les pages publiques ; on ne configure ici QUE l'étiquette, les
 * formats autorisés, les supports, la capacité et l'activation.
 */
export default async function AdminPlacementsPage() {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) {
    if (guard.denied === "unauthenticated") redirect("/admin/login");
    return <ForbiddenScreen />;
  }

  const placements = await listPlacements();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Emplacements</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Codes stables branchés dans les pages publiques. Désactiver un
          emplacement retire TOUTES ses zones du site public (aucune
          page à redéployer).
        </p>
      </header>

      {placements.length === 0 ? (
        <NotFoundScreen what="Emplacement" />
      ) : (
        placements.map((p) => (
          <section
            key={p.code}
            className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-white/10 dark:bg-night-800"
          >
            <header className="mb-3 flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-neutral-500/15 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase text-neutral-500">
                {p.code}
              </span>
              <h2 className="font-display text-sm font-bold">
                {AD_PLACEMENT_LABELS[p.code as AdPlacementCode] ?? p.label}
              </h2>
              <span
                className={`ml-auto rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                  p.is_active ? "bg-guinea-green/15 text-guinea-green" : "bg-neutral-500/15 text-neutral-500"
                }`}
              >
                {p.is_active ? "Actif" : "Désactivé"}
              </span>
            </header>
            <PlacementForm item={p} />
          </section>
        ))
      )}
    </div>
  );
}