import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { getAdvertiser, getAdvertiserCampaigns } from "@/lib/data/ads";
import { adStateOf } from "@/lib/ads/ads-core";
import { AdvertiserForm } from "@/components/admin/AdsForms";
import { ForbiddenScreen, NotFoundScreen } from "@/components/admin/AccessDenied";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Fiche annonceur" };

export default async function AdminAdvertiserPage({ params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) {
    if (guard.denied === "unauthenticated") redirect("/admin/login");
    return <ForbiddenScreen />;
  }

  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();

  const advertiser = await getAdvertiser(id);
  if (!advertiser) {
    return <NotFoundScreen what="Annonceur introuvable" />;
  }
  const campaigns = await getAdvertiserCampaigns(id);
  const nowIso = new Date().toISOString();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/publicites/annonceurs" className="text-xs font-semibold text-guinea-red hover:underline">
            ← Annonceurs
          </Link>
          <h1 className="font-display text-2xl font-extrabold sm:text-3xl">{advertiser.name}</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {[advertiser.legal_name, advertiser.sector, advertiser.location].filter(Boolean).join(" · ") || "Aucun détail enregistré"}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase ${advertiser.is_active ? "bg-guinea-green/15 text-guinea-green" : "bg-neutral-500/15 text-neutral-500"}`}>
          {advertiser.is_active ? "Annonceur actif" : "Annonceur inactif"}
        </span>
      </header>

      <section className="rounded-2xl border border-neutral-200 bg-surface p-6 dark:border-white/10 dark:bg-night-800">
        <h2 className="mb-4 font-display text-base font-bold">Modifier</h2>
        <AdvertiserForm item={advertiser} />
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold">Campagnes ({campaigns.length})</h2>
        {campaigns.length === 0 ? (
          <NotFoundScreen what="Aucune campagne" />
        ) : (
          <div className="grid gap-3">
            {campaigns.map((c) => (
              <Link
                key={c.id}
                href={`/admin/publicites/campagnes/${c.id}`}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-neutral-200 bg-surface p-4 text-sm hover:border-guinea-red/40 dark:border-white/10 dark:bg-night-800"
              >
                <span className="font-bold">{c.name}</span>
                <span className="rounded-full bg-neutral-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase text-neutral-500">
                  {adStateOf({ status: c.status, start_at: c.start_at, end_at: c.end_at }, nowIso)}
                </span>
                <span className="text-xs text-neutral-400">créée le {formatDate(c.created_at)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}