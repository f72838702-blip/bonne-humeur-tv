import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { listDailyStats } from "@/lib/data/ads";
import { computedCtr, IMPRESSION_RULE } from "@/lib/ads/ads-core";
import { ForbiddenScreen, NotFoundScreen } from "@/components/admin/AccessDenied";

export const metadata = { title: "Statistiques publicitaires" };

/**
 * Statistiques réelles dédupliquées, agrégées par campagne et par jour.
 * JAMAIS une ligne par impression (table daily uniquement) — chiffres
 * indicatifs, non certifiés (bandeau permanent).
 */
export default async function AdminAdsStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) {
    if (guard.denied === "unauthenticated") redirect("/admin/login");
    return <ForbiddenScreen />;
  }

  const { from, to } = await searchParams;
  const dateOk = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  const rows = await listDailyStats({ from: dateOk(from), to: dateOk(to) });

  // Agrégation par campagne EN MÉMOIRE (jamais de compteur en ligne de plus).
  interface Agg { name: string; reference: string | null; impressions: number; clicks: number; }
  const perCampaign = new Map<string, Agg>();
  let impressions = 0;
  let clicks = 0;
  for (const row of rows) {
    const campaignId = row.ad_creatives?.campaign_id;
    if (!campaignId) continue;
    const name = row.ad_creatives?.ad_campaigns?.name ?? "campagne supprimée";
    const entry = perCampaign.get(campaignId) ?? { name, reference: row.ad_creatives?.ad_campaigns?.reference ?? null, impressions: 0, clicks: 0 };
    entry.impressions += Number(row.impressions);
    entry.clicks += Number(row.clicks);
    perCampaign.set(campaignId, entry);
    impressions += Number(row.impressions);
    clicks += Number(row.clicks);
  }
  const ctr = computedCtr(clicks, impressions);
  const agg = [...perCampaign.entries()].sort((a, b) => b[1].impressions - a[1].impressions);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Statistiques</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{IMPRESSION_RULE}</p>
      </header>

      <section className="rounded-2xl border border-guinea-red/40 bg-guinea-red/5 p-5 text-sm">
        <p className="font-bold text-guinea-red">Chiffres indicatifs : ils ne fondent PAS une facturation CPM/CPC et ne sont pas une audience certifiée.</p>
      </section>

      <form className="flex flex-wrap items-end gap-3" action="/admin/publicites/statistiques">
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase text-neutral-500 dark:text-neutral-400" htmlFor="st-from">Du</label>
          <input id="st-from" name="from" type="date" defaultValue={from ?? ""} className="rounded-xl border border-neutral-300 px-3 py-2 text-sm dark:border-white/15 dark:bg-night-800" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase text-neutral-500 dark:text-neutral-400" htmlFor="st-to">Au</label>
          <input id="st-to" name="to" type="date" defaultValue={to ?? ""} className="rounded-xl border border-neutral-300 px-3 py-2 text-sm dark:border-white/15 dark:bg-night-800" />
        </div>
        <button type="submit" className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold dark:border-white/15">Filtrer</button>
      </form>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-neutral-200 bg-surface p-5 dark:border-white/10 dark:bg-night-800">
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">Impressions (période)</p>
          <p className="mt-1 font-display text-3xl font-extrabold">{impressions}</p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-surface p-5 dark:border-white/10 dark:bg-night-800">
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">Clics (période)</p>
          <p className="mt-1 font-display text-3xl font-extrabold">{clicks}</p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-surface p-5 dark:border-white/10 dark:bg-night-800">
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">CTR</p>
          <p className="mt-1 font-display text-3xl font-extrabold">{ctr === null ? "—" : `${ctr} %`}</p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold">Par campagne ({agg.length})</h2>
        {agg.length === 0 ? (
          <NotFoundScreen what="Statistique" />
        ) : (
          <div className="grid gap-3">
            {agg.map(([campaignId, entry]) => {
              const entryCtr = computedCtr(entry.clicks, entry.impressions);
              return (
                <Link
                  key={campaignId}
                  href={`/admin/publicites/campagnes/${campaignId}`}
                  className="flex flex-wrap items-center gap-3 rounded-2xl border border-neutral-200 bg-surface p-4 text-sm hover:border-guinea-red/40 dark:border-white/10 dark:bg-night-800"
                >
                  <span className="min-w-0 flex-1 truncate font-bold">{entry.name}</span>
                  <span className="text-xs text-neutral-400">{entry.reference}</span>
                  <span className="text-xs">{entry.impressions} impressions</span>
                  <span className="text-xs">{entry.clicks} clics</span>
                  <span className="text-xs font-bold">{entryCtr === null ? "—" : `${entryCtr} %`}</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}