import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { listPartners } from "@/lib/data/ads";
import { savePartnerAction, deletePartnerAction } from "@/lib/actions/ads";
import { PartnerForm } from "@/components/admin/AdsForms";
import { ForbiddenScreen, NotFoundScreen } from "@/components/admin/AccessDenied";
import DeleteActionForm from "@/components/admin/DeleteActionForm";

export const metadata = { title: "Partenaires officiels" };

export default async function AdminPartnersPage() {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) {
    if (guard.denied === "unauthenticated") redirect("/admin/login");
    return <ForbiddenScreen />;
  }

  if (guard.session.profile?.role === "editor" && !hasPermission(guard.session.profile, "publicite")) {
    return <ForbiddenScreen />;
  }
  const role = guard.session.profile?.role ?? "reporter";

  const partners = await listPartners();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Partenaires officiels</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Vitrine distincte du contenu journalistique (accueil uniquement).
          Les liens passent directement au site du partenaire (http/https
          contrôlé, rel nofollow) — aucun comptage de clic.
        </p>
      </header>

      <section className="rounded-2xl border border-neutral-200 bg-surface p-6 dark:border-white/10 dark:bg-night-800">
        <h2 className="mb-4 font-display text-base font-bold">Nouveau partenaire</h2>
        <PartnerForm />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold">Partenaires ({partners.length})</h2>
        {partners.length === 0 ? (
          <NotFoundScreen what="Partenaire" />
        ) : (
          partners.map((p) => (
            <div key={p.id} className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-surface p-4 dark:border-white/10 dark:bg-night-800">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${p.is_active ? "bg-guinea-green/15 text-guinea-green" : "bg-neutral-500/15 text-neutral-500"}`}>
                  {p.is_active ? "Actif" : "Inactif"}
                </span>
                <span className="font-bold">{p.name}</span>
                <span className="text-xs text-neutral-400">
                  ordre {p.sort_order}{p.visible_from ? ` · dès ${p.visible_from}` : ""}{p.visible_to ? ` · jusqu'au ${p.visible_to}` : ""}
                </span>
                {(role === "admin" || role === "super_admin") && (
                  <span className="ml-auto">
                    <DeleteActionForm action={deletePartnerAction} hiddenFields={{ id: p.id }} confirmLabel={`Supprimer « ${p.name} » de la vitrine ?`} />
                  </span>
                )}
              </div>
              <PartnerForm item={p} />
            </div>
          ))
        )}
      </section>
    </div>
  );
}