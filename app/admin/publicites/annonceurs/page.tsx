import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { listAdvertisers } from "@/lib/data/ads";
import { deleteAdvertiserAction } from "@/lib/actions/ads";
import { AdvertiserForm } from "@/components/admin/AdsForms";
import { ForbiddenScreen, NotFoundScreen } from "@/components/admin/AccessDenied";
import DeleteActionForm from "@/components/admin/DeleteActionForm";

export const metadata = { title: "Annonceurs" };

export default async function AdminAdvertisersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) {
    if (guard.denied === "unauthenticated") redirect("/admin/login");
    return <ForbiddenScreen />;
  }
  const role = guard.session.profile?.role ?? "reporter";
  const { q } = await searchParams;

  const advertisers = await listAdvertisers({ q: q?.trim() || undefined });

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Annonceurs</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Coordonnées PRIVÉES (jamais publiques) : administrées par la
          régie, visibles en back-office uniquement.
        </p>
      </header>

      <section className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-white/10 dark:bg-night-800">
        <h2 className="mb-4 font-display text-base font-bold">Nouvel annonceur</h2>
        <AdvertiserForm />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-display text-lg font-bold">Annonceurs ({advertisers.length})</h2>
          <form className="flex gap-2" action="/admin/publicites/annonceurs">
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Rechercher…"
              className="w-48 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none dark:border-white/15 dark:bg-night-800"
            />
            <button type="submit" className="rounded-xl border border-neutral-300 px-4 text-sm font-semibold dark:border-white/15">
              Rechercher
            </button>
          </form>
        </div>

        {advertisers.length === 0 ? (
          <NotFoundScreen what="Aucun annonceur" />
        ) : (
          <div className="grid gap-3">
            {advertisers.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-night-800"
              >
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                    a.is_active ? "bg-guinea-green/15 text-guinea-green" : "bg-neutral-500/15 text-neutral-500"
                  }`}
                >
                  {a.is_active ? "Actif" : "Inactif"}
                </span>
                <Link href={`/admin/publicites/annonceurs/${a.id}`} className="min-w-0 flex-1 truncate text-sm font-bold hover:text-guinea-red">
                  {a.name}
                </Link>
                <span className="text-xs text-neutral-400">
                  {[a.sector, a.location].filter(Boolean).join(" · ") || "—"}
                </span>
                <Link
                  href={`/admin/publicites/annonceurs/${a.id}`}
                  className="rounded-xl border border-neutral-300 px-4 py-2 text-xs font-semibold hover:bg-neutral-100 dark:border-white/15 dark:hover:bg-white/10"
                >
                  Fiche
                </Link>
                {role === "admin" && (
                  <DeleteActionForm
                    action={deleteAdvertiserAction}
                    hiddenFields={{ id: a.id }}
                    confirmLabel={`Supprimer définitivement « ${a.name} » et toutes ses campagnes ? Préférez la désactivation pour l'historique.`}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}