import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { ForbiddenScreen, NotFoundScreen, UnconfiguredScreen } from "@/components/admin/AccessDenied";
import RefreshButton from "@/components/admin/RefreshButton";
import { StatCard, EmptyChart } from "@/components/admin/stats/charts";
import {
  computeDailySeries,
  computeTotals,
  type AnalyticsRow,
} from "@/lib/analytics/aggregate";
import {
  ENGAGED_READ_MS,
  formatDuration,
  previousRange,
  resolvePeriodRange,
} from "@/lib/analytics/classes";
import { fetchArticleMeta, fetchPeriodRows } from "@/lib/analytics/queries";
import { formatDateTime } from "@/lib/utils";

/**
 * Statistiques détaillées d'UN article (admin) — les mêmes définitions
 * honnêtes que le tableau de bord : lectures, sessions uniques, engagement
 * moyen des pages visibles, taux de lecture engagée (≥ 30 s).
 */

export const metadata = { title: "Article — Statistiques" };

const PERIODS: { key: string; label: string }[] = [
  { key: "7d", label: "7 derniers jours" },
  { key: "30d", label: "30 derniers jours" },
  { key: "90d", label: "90 derniers jours" },
];

export default async function ArticleStatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ periode?: string }>;
}) {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) {
    if (guard.denied === "unauthenticated") redirect("/admin/login");
    if (guard.denied === "unconfigured") return <UnconfiguredScreen />;
    return <ForbiddenScreen />;
  }

  if (guard.session.profile?.role === "editor" && !hasPermission(guard.session.profile, "consultation")) {
    return <ForbiddenScreen />;
  }

  const { id } = await params;
  const { periode } = await searchParams;
  const preset = PERIODS.some((p) => p.key === periode) ? (periode as string) : "30d";
  const range = resolvePeriodRange(preset);
  const previous = previousRange(range);

  const [rows, prevRows, meta] = await Promise.all([
    fetchPeriodRows(range),
    fetchPeriodRows(previous),
    fetchArticleMeta(),
  ]);

  if (rows === null) {
    return (
      <div className="flex flex-col gap-6">
        <p className="rounded-2xl border border-amber-300/40 bg-amber-50 px-4 py-6 text-sm text-amber-800 dark:bg-amber-400/10 dark:text-amber-300">
          Période trop volumineuse pour un calcul instantané — réduisez la période.
        </p>
      </div>
    );
  }

  const article = meta.get(id);
  if (!article) return <NotFoundScreen what="Article introuvable dans l'historique de ce site" />;

  const own: AnalyticsRow[] = rows.filter((r) => r.article_id === id);
  const ownPrev = (prevRows ?? []).filter((r) => r.article_id === id);
  const totals = computeTotals(own, ownPrev);
  const daily = computeDailySeries(own);

  return (
    <div className="flex flex-col gap-6">
      <a
        href="/admin/statistiques"
        className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-500 hover:text-guinea-red dark:text-neutral-400"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Retour aux statistiques
      </a>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-extrabold sm:text-3xl">{article.title}</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {article.published_at
              ? `Publié le ${formatDateTime(article.published_at)} · `
              : ""}
            Fiche d&apos;audience de l&apos;article — données anonymes, estimées.
          </p>
        </div>
        <RefreshButton label="Actualiser" />
      </header>

      <nav className="flex gap-2 overflow-x-auto pb-0.5" aria-label="Période">
        {PERIODS.map((p) => (
          <a
            key={p.key}
            href={`/admin/statistiques/articles/${id}?periode=${p.key}`}
            className={
              preset === p.key
                ? "shrink-0 whitespace-nowrap rounded-full border border-guinea-red bg-guinea-red px-3.5 py-2 text-[11px] font-bold text-white sm:px-4 sm:py-1.5 sm:text-xs"
                : "shrink-0 whitespace-nowrap rounded-full border border-neutral-200 px-3.5 py-2 text-[11px] font-semibold text-neutral-600 transition-colors hover:border-guinea-red/50 hover:text-guinea-red sm:px-4 sm:py-1.5 sm:text-xs dark:border-white/10 dark:text-neutral-300"
            }
          >
            {p.label}
          </a>
        ))}
      </nav>

      {own.length === 0 && (
        <p className="rounded-2xl border border-neutral-200 bg-surface px-4 py-6 text-sm text-neutral-600 dark:border-white/10 dark:bg-night-800 dark:text-neutral-300">
          Aucune lecture de cet article enregistrée sur la période — la collecte est active depuis
          le 04/11/2026 et aucun visiteur n&apos;a ouvert cet article ici encore.
        </p>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          label="Lectures (ouvertures)"
          value={String(totals.views)}
          delta={totals.deltas.views}
          hint="Chaque ouverture de l'article, retours inclus."
        />
        <StatCard
          label="Lecteurs uniques (sessions)"
          value={String(totals.sessions)}
          delta={totals.deltas.sessions}
          hint="Sessions distinctes — une estimation honnête, jamais des personnes nommées."
        />
        <StatCard
          label="Engagement moyen"
          value={totals.avgEngagedMs === null ? "—" : formatDuration(totals.avgEngagedMs)}
          delta={totals.deltas.avgEngagedMs}
          hint="Temps visible (onglet actif) par lecture."
        />
        <StatCard
          label="Taux de lecture engagée"
          value={totals.engagedReadRate === null ? "—" : `${totals.engagedReadRate}%`}
          delta={totals.deltas.engagedReadRate}
          hint={`Part des lectures de ≥ 30 s de page visible (${totals.engagedReads} lecture(s)).`}
        />
        <StatCard
          label="Lectures abandonnées"
          value={String(totals.abandoned)}
          delta={null}
          hint="Quittées en moins de 10 s — article peut-être mal accroché (titre, visuel, début du texte)."
        />
        <StatCard
          label="Seuil de lecture engagée"
          value="30 s"
          delta={null}
          hint={`Règle fixe : ≥ ${ENGAGED_READ_MS / 1000} secondes de page visible. Affichée pour rester transparente.`}
        />
      </section>

      {own.length > 0 && (
        <section className="rounded-2xl border border-neutral-200 bg-surface p-5 dark:border-white/10 dark:bg-night-800">
          <h2 className="font-display text-lg font-bold">Évolution des lectures</h2>
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            Pages vues de CET article par jour.
          </p>
          {(() => {
            if (daily.length === 0) return <EmptyChart label="Aucune lecture sur la période." />;
            return (
              <ul className="mt-3 flex flex-col gap-1.5">
                {daily.map((p) => (
                  <li key={p.day} className="flex items-center gap-2 text-xs">
                    <span className="w-20 shrink-0 tabular-nums text-neutral-500 dark:text-neutral-400">{p.day}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100 dark:bg-white/10">
                      <span
                        className="block h-full rounded-full bg-guinea-red"
                        style={{ width: `${Math.round((p.views / Math.max(...daily.map((d) => d.views))) * 100)}%` }}
                      />
                    </span>
                    <span className="w-16 shrink-0 text-right tabular-nums">{p.views}</span>
                  </li>
                ))}
              </ul>
            );
          })()}
        </section>
      )}
    </div>
  );
}