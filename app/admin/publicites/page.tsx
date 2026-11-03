import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { getAdsDashboardCounters } from "@/lib/data/ads";
import { AD_STATUS_LABELS, AD_STATE_LABELS, IMPRESSION_RULE } from "@/lib/ads/ads-core";
import { ForbiddenScreen } from "@/components/admin/AccessDenied";

export const metadata = { title: "Publicités" };

/**
 * Tableau de bord de la régie — compteurs RÉELS de la base (jamais de
 * chiffre décoratif ni d'estimation) + règles honnêtes d'affichage.
 */
export default async function AdminPublicitesPage() {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) {
    if (guard.denied === "unauthenticated") redirect("/admin/login");
    return <ForbiddenScreen />;
  }
  const role = guard.session.profile?.role ?? "reporter";

  const counters = await getAdsDashboardCounters();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Publicités</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Régie interne : annonceurs, campagnes, créations, emplacements,
          règlements et statistiques — données 100 % réelles.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Annonceurs" value={counters.advertisers} hint={`${counters.advertisersActive} actifs`} />
        <StatCard label="Campagnes" value={counters.campaignsTotal} hint={Object.entries(counters.campaignsByStatus).map(([s, n]) => `${AD_STATUS_LABELS[s as keyof typeof AD_STATUS_LABELS]} : ${n}`).join(" · ") || "aucune"} />
        <StatCard label="Créations à valider" value={counters.creativesPending} hint="brouillons en attente de décision" />
        <StatCard label="Impressions cumulées" value={counters.impressionsTotal} hint={`${counters.clicksTotal} clics enregistrés`} />
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-white/10 dark:bg-night-800">
        <h2 className="font-display text-base font-bold">Règle d&apos;impression (définition unique, affichée à l&apos;annonceur)</h2>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{IMPRESSION_RULE}</p>
        <p className="mt-3 text-xs font-semibold text-guinea-red">
          Les statistiques de cette régie sont INDICATIVES et ne peuvent
          fonder une facturation au clic ou au mille (CPM/CPC) — première
          version, sans mesure certifiée d&apos;audience.
        </p>
      </section>

      <section className="flex flex-wrap gap-3">
        <Link href="/admin/publicites/campagnes" className="rounded-xl bg-guinea-red px-5 py-2.5 text-sm font-bold text-white hover:bg-guinea-red/90">Campagnes</Link>
        <Link href="/admin/publicites/annonceurs" className="rounded-xl border border-neutral-300 px-5 py-2.5 text-sm font-bold hover:bg-neutral-100 dark:border-white/15 dark:hover:bg-white/10">Annonceurs</Link>
        <Link href="/admin/publicites/emplacements" className="rounded-xl border border-neutral-300 px-5 py-2.5 text-sm font-bold hover:bg-neutral-100 dark:border-white/15 dark:hover:bg-white/10">Emplacements</Link>
        <Link href="/admin/publicites/partenaires" className="rounded-xl border border-neutral-300 px-5 py-2.5 text-sm font-bold hover:bg-neutral-100 dark:border-white/15 dark:hover:bg-white/10">Partenaires</Link>
        <Link href="/admin/publicites/statistiques" className="rounded-xl border border-neutral-300 px-5 py-2.5 text-sm font-bold hover:bg-neutral-100 dark:border-white/15 dark:hover:bg-white/10">Statistiques</Link>
        {role === "admin" && (
          <Link href="/admin/publicites/paiements" className="rounded-xl border border-neutral-300 px-5 py-2.5 text-sm font-bold hover:bg-neutral-100 dark:border-white/15 dark:hover:bg-white/10">Règlements</Link>
        )}
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-6 text-sm dark:border-white/10 dark:bg-night-800">
        <h2 className="font-display text-base font-bold">États d&apos;une campagne</h2>
        <p className="mt-2 text-neutral-600 dark:text-neutral-300">
          {Object.values(AD_STATE_LABELS).map((label: string) => label).join(" · ")}.
          Aucune campagne sans période complète ne peut diffuser (fail-closed),
          même activée.
        </p>
      </section>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-white/10 dark:bg-night-800">
      <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">{label}</p>
      <p className="mt-1 font-display text-3xl font-extrabold">{value}</p>
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{hint}</p>
    </div>
  );
}