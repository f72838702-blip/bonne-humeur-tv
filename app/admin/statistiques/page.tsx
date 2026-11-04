import { redirect } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { ForbiddenScreen, UnconfiguredScreen } from "@/components/admin/AccessDenied";
import RefreshButton from "@/components/admin/RefreshButton";
import {
  CountryRanking,
  CountryMap,
  HeatGrid,
  ReferrerBars,
  StatCard,
  TopArticlesTable,
  VisitsLineChart,
  EmptyChart,
} from "@/components/admin/stats/charts";
import {
  bestPublishSlots,
  computeCountries,
  computeDailySeries,
  computeGrid,
  computeTopArticles,
  computeTotals,
  computeByField,
  DOW_LABELS,
  type AnalyticsRow,
} from "@/lib/analytics/aggregate";
import {
  BROWSER_LABELS,
  DEVICE_LABELS,
  PERIOD_LABELS,
  PERIOD_PRESETS,
  REFERRER_LABELS,
  formatDuration,
  previousRange,
  resolvePeriodRange,
  type Browser,
  type Device,
  type ReferrerClass,
} from "@/lib/analytics/classes";
import { fetchArticleMeta, fetchPeriodRows } from "@/lib/analytics/queries";
import { formatDateTime } from "@/lib/utils";

/**
 * Tableau de bord d'audience — ADMIN UNIQUEMENT (RLS 0029 : les lignes
 * brutes ne sortent que sous policy admin-select). Toutes les métriques
 * sont ESTIMÉES et affichées honnêtement : aucune donnée fictive, « Inconnu »
 * quand la région n'est pas disponible, « pas de comparaison » quand la
 * période précédente n'a pas de données.
 */

export const metadata = { title: "Statistiques" };

const PRESETS: { key: string; label: string }[] = [
  ...PERIOD_PRESETS.map((k) => ({ key: k, label: PERIOD_LABELS[k] ?? k })),
];

export default async function AdminStatisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string; du?: string; au?: string }>;
}) {
  const guard = await requireRole(["admin"]);
  if ("denied" in guard) {
    if (guard.denied === "unauthenticated") redirect("/admin/login");
    if (guard.denied === "unconfigured") return <UnconfiguredScreen />;
    return <ForbiddenScreen />;
  }

  const { periode, du, au } = await searchParams;
  const preset = PERIOD_PRESETS.includes(periode as never)
    ? (periode as string)
    : periode === "custom"
      ? "custom"
      : "7d";
  const range = resolvePeriodRange(preset, du, au);
  const previous = previousRange(range);

  const [rows, prevRows, articleMeta] = await Promise.all([
    fetchPeriodRows(range),
    fetchPeriodRows(previous),
    fetchArticleMeta(),
  ]);

  const queryTail = new URLSearchParams({ periode: preset, ...(du ? { du } : {}), ...(au ? { au } : {}) }).toString();
  const filterLink = (key: string) => {
    if (key === "custom") return `/admin/statistiques${queryTail ? `?${queryTail}` : ""}`;
    return `/admin/statistiques?periode=${key}`;
  };

  if (rows === null) {
    // Cap de sécurité atteint : refuse de présenter un chiffre tronqué.
    return (
      <div className="flex flex-col gap-6">
        <HeaderBlock preset={preset} />
        <p className="rounded-2xl border border-amber-300/40 bg-amber-50 px-4 py-6 text-sm text-amber-800 dark:bg-amber-400/10 dark:text-amber-300">
          Période trop volumineuse pour un calcul instantané (plus de 25 000 visites). Essayez une
          période plus courte ou demandez l&apos;export CSV, qui traite les données par lots.
        </p>
      </div>
    );
  }

  // Période précédente trop volumineuse → comparaison simplement indisponible
  // (computeTotals reçoit un lot vide → deltas null, jamais de chiffre inventé).
  const prevSafe: AnalyticsRow[] = prevRows ?? [];
  const totals = computeTotals(rows, prevSafe);
  const daily = computeDailySeries(rows);
  const prevDaily = computeDailySeries(prevSafe);
  const countries = computeCountries(rows);
  const top = computeTopArticles(rows, articleMeta);
  const sources = computeByField(rows, (r) => r.referrer_class, Object.keys(REFERRER_LABELS) as ReferrerClass[]);
  const devices = computeByField(rows, (r) => r.device, ["mobile", "desktop", "tablet"] as Device[]);
  const browsers = computeByField(rows, (r) => r.browser, Object.keys(BROWSER_LABELS) as Browser[]);
  const grid = computeGrid(rows);
  const slots = bestPublishSlots(grid.cells);

  const noData = rows.length === 0 && prevSafe.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <HeaderBlock preset={preset} />

      {/* Filtre de période — liens serveur (aucun JS client), s'applique à TOUT */}
      <nav className="flex flex-wrap items-center gap-2" aria-label="Période">
        {PRESETS.map((p) => (
          <a
            key={p.key}
            href={filterLink(p.key)}
            className={
              preset === p.key
                ? "rounded-full border border-guinea-red bg-guinea-red px-4 py-1.5 text-xs font-bold text-white"
                : "rounded-full border border-neutral-200 px-4 py-1.5 text-xs font-semibold text-neutral-600 hover:border-guinea-red/50 hover:text-guinea-red dark:border-white/10 dark:text-neutral-300"
            }
          >
            {p.label}
          </a>
        ))}
        <form action="/admin/statistiques" method="get" className="flex items-center gap-2">
          <input type="hidden" name="periode" value="custom" />
          <input
            type="date"
            name="du"
            defaultValue={du}
            className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs dark:border-white/10 dark:bg-night-900"
            aria-label="Du"
          />
          <input
            type="date"
            name="au"
            defaultValue={au}
            className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs dark:border-white/10 dark:bg-night-900"
            aria-label="Au"
          />
          <button
            type="submit"
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold hover:border-guinea-red/50 dark:border-white/10"
          >
            Appliquer
          </button>
        </form>
      </nav>

      {noData && (
        <p className="rounded-2xl border border-neutral-200 bg-white px-4 py-6 text-sm text-neutral-600 dark:border-white/10 dark:bg-night-800 dark:text-neutral-300">
          Aucune donnée disponible pour l&apos;instant. La collecte démarre après le déploiement de la
          migration 0029 et la navigation des visiteurs — ce message disparaît dès les premières
          visites. <strong>Aucun chiffre fictif n&apos;est jamais affiché.</strong>
        </p>
      )}

      {/* Cartes principales */}
      <section aria-label="Indicateurs principaux" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          label="Sessions estimées"
          value={String(totals.sessions)}
          delta={totals.deltas.sessions}
          hint="Des visites (identifiants aléatoires éphémères) — JAMAIS le nombre exact de personnes."
        />
        <StatCard
          label="Pages vues"
          value={String(totals.views)}
          delta={totals.deltas.views}
          hint="Nombre de pages ouvertes, toutes pages confondues."
        />
        <StatCard
          label="Durée d'engagement estimée"
          value={totals.avgEngagedMs === null ? "—" : formatDuration(totals.avgEngagedMs)}
          delta={totals.deltas.avgEngagedMs}
          hint="Temps réellement VISIBLE (onglet actif) — pas le temps de chargement."
        />
        <StatCard
          label="Lectures d'articles"
          value={String(totals.articleViews)}
          delta={totals.deltas.articleViews}
          hint="Ouvertures d'un article (le même lecteur peut revenir)."
        />
        <StatCard
          label="Lectures engagées"
          value={totals.engagedReadRate === null ? "—" : `${totals.engagedReadRate}%`}
          delta={totals.deltas.engagedReadRate}
          hint={`Part des pages où la visite est restée ≥ 30 s sur une page visible (${totals.engagedReads} page(s)).`}
        />
        <StatCard
          label="Pages abandonnées"
          value={String(totals.abandoned)}
          delta={null}
          hint="Quittées en moins de 10 s de visibilité — à comparer aux lectures engagées."
        />
      </section>

      {/* A. Évolution */}
      <ChartBlock title="Évolution des visites" expl="Ligne pleine = période choisie. Ligne en pointillés = période précédente (même longueur), pour comparer les tendances.">
        <VisitsLineChart points={daily} prevPoints={prevDaily} />
      </ChartBlock>

      {/* B. Pays */}
      <ChartBlock title="D'où viennent les visiteurs" expl="Pays détectés par Cloudflare (sans stocker d'adresse IP). « Inconnu » honnête quand le pays n'est pas disponible.">
        <CountryRanking stats={countries} />
        <CountryMap stats={countries} />
      </ChartBlock>

      {/* C. Articles */}
      <ChartBlock title="Articles les plus lus" expl="Cliquez sur un article pour sa fiche détaillée (lectures, temps d'engagement, taux de lecture engagée).">
        <TopArticlesTable stats={top} />
      </ChartBlock>

      {/* D. Sources */}
      <ChartBlock title="Comment les visiteurs arrivent" expl="Provenance détectée côté serveur depuis l'en-tête référent réel — WhatsApp apparaît dès qu'un lien en provenance de WhatsApp est signalé. Rien n'est jamais inventé.">
        <ReferrerBars stats={sources} />
      </ChartBlock>

      {/* E. Appareils + navigateurs */}
      <div className="grid gap-4 md:grid-cols-2">
        <ChartBlock title="Appareils utilisés" expl="Téléphones, ordinateurs ou tablettes — détectés depuis le navigateur utilisé.">
          <ReferrerBars stats={devices} />
        </ChartBlock>
        <ChartBlock title="Navigateurs principaux" expl="Répartition entre les navigateurs (donnée technique anonyme).">
          <ReferrerBars stats={browsers} />
        </ChartBlock>
      </div>

      {/* F. Jours × heures */}
      <ChartBlock
        title="Jours et heures de fréquentation"
        expl="Heure de Conakry (GMT+0) — les cases les plus foncées sont les plus visitées. Survolez une case pour le détail."
      >
        <HeatGrid cells={grid.cells} />
        {slots.length > 0 && (
          <p className="mt-3 rounded-xl bg-guinea-green/10 px-4 py-3 text-xs leading-relaxed text-guinea-green dark:text-guinea-green">
            <BarChart3 className="mr-1 inline h-3.5 w-3.5" />
            <strong>Pour publier un article :</strong>{" "}
            {slots
              .map((c) => `${DOW_LABELS[c.dow]} vers ${c.hour} h`)
              .join(", ")}{" "}
            — les créneaux les plus visités de la période.
          </p>
        )}
      </ChartBlock>

      <p className="text-[11px] text-neutral-400">
        Dernière actualisation : {formatDateTime(new Date().toISOString())}. Données anonymes
        (aucune adresse IP, aucun identifiant personnel, aucun cookie) — conformément à la
        page Confidentialité. La durée d&apos;engagement est <strong>estimée</strong> : elle mesure le
        temps de page visible, pas le temps de chargement.
      </p>
    </div>
  );
}

function HeaderBlock({ preset }: { preset: string }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Statistiques</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Audience du site — {PERIOD_LABELS[preset] ?? preset}. Réservé aux administrateurs.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <RefreshButton label="Actualiser" />
        <a
          href={`/admin/statistiques/export?${new URLSearchParams({ periode: preset }).toString()}`}
          className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-600 transition-colors hover:border-guinea-red/50 hover:text-guinea-red dark:border-white/10 dark:text-neutral-300"
        >
          Export CSV
        </a>
      </div>
    </header>
  );
}

function ChartBlock({
  title,
  expl,
  children,
}: {
  title: string;
  expl: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-white/10 dark:bg-night-800">
      <div>
        <h2 className="font-display text-lg font-bold">{title}</h2>
        <p className="mt-0.5 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">{expl}</p>
      </div>
      {children ?? <EmptyChart label="Aucune donnée." />}
    </section>
  );
}