/**
 * Agrégation PUR des statistiques (aucune requête) : à partir de la liste
 * brute de lignes page_view (déjà restreinte RLS à l'admin CONNECTÉ), calcule
 * toutes les métriques affichées. Comptage honnête : chaque fonction gère
 * les cas « aucune donnée » / « comparaison impossible » → valeurs null,
 * jamais de chiffre inventé.
 */

import {
  ABANDON_MS,
  ENGAGED_READ_MS,
  percentDelta,
  type Browser,
  type Device,
  type ReferrerClass,
} from "./classes";

export interface AnalyticsRow {
  created_at: string;
  session_id: string;
  event_id: string;
  path: string;
  path_kind: "article" | "other";
  article_id: string | null;
  device: Device;
  browser: Browser;
  country_iso2: string | null;
  referrer_class: ReferrerClass;
  engaged_ms: number;
}

export interface Totals {
  sessions: number;
  views: number;
  avgEngagedMs: number | null;
  articleViews: number;
  engagedReads: number;
  engagedReadRate: number | null;
  abandoned: number;
  deltas: {
    sessions: number | null;
    views: number | null;
    avgEngagedMs: number | null;
    articleViews: number | null;
    engagedReadRate: number | null;
  };
}

/** Sessions distinctes = identifiants éphémères aléatoires (jamais des personnes). */
function distinctSessions(rows: AnalyticsRow[]): number {
  return new Set(rows.map((r) => r.session_id)).size;
}

function totalsOf(rows: AnalyticsRow[]): Totals {
  const views = rows.length;
  const articleViews = rows.filter((r) => r.path_kind === "article").length;
  const engagedReads = rows.filter((r) => r.engaged_ms >= ENGAGED_READ_MS).length;
  const abandoned = rows.filter((r) => r.engaged_ms > 0 && r.engaged_ms < ABANDON_MS).length;
  const withEngagement = rows.filter((r) => r.engaged_ms > 0);
  const avgEngagedMs =
    withEngagement.length === 0
      ? null
      : Math.round(withEngagement.reduce((s, r) => s + r.engaged_ms, 0) / withEngagement.length);
  return {
    sessions: distinctSessions(rows),
    views,
    avgEngagedMs,
    articleViews,
    engagedReads,
    engagedReadRate: views === 0 ? null : Math.round((engagedReads / views) * 100),
    abandoned,
    deltas: {
      sessions: null, views: null, avgEngagedMs: null,
      articleViews: null, engagedReadRate: null,
    },
  };
}

export function computeTotals(rows: AnalyticsRow[], prevRows: AnalyticsRow[]): Totals {
  const cur = totalsOf(rows);
  const prev = totalsOf(prevRows);
  return {
    ...cur,
    deltas: {
      sessions: percentDelta(cur.sessions, prev.sessions),
      views: percentDelta(cur.views, prev.views),
      avgEngagedMs: cur.avgEngagedMs !== null ? percentDelta(cur.avgEngagedMs, prev.avgEngagedMs ?? 0) : null,
      articleViews:
        cur.articleViews === 0 && prev.articleViews === 0
          ? null
          : percentDelta(cur.articleViews, prev.articleViews),
      engagedReadRate:
        cur.engagedReadRate !== null && prev.engagedReadRate !== null
          ? percentDelta(cur.engagedReadRate, prev.engagedReadRate)
          : null,
    },
  };
}

export interface DailyPoint {
  day: string; // YYYY-MM-DD (UTC = heure de Conakry, GMT+0)
  sessions: number;
  views: number;
  engagedMs: number;
}

function dayKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function computeDailySeries(rows: AnalyticsRow[]): DailyPoint[] {
  const map = new Map<string, DailyPoint>();
  const perDay = new Map<string, Set<string>>();
  for (const row of rows) {
    const key = dayKey(new Date(row.created_at));
    let point = map.get(key);
    if (!point) {
      point = { day: key, sessions: 0, views: 0, engagedMs: 0 };
      map.set(key, point);
    }
    point.views += 1;
    point.engagedMs += row.engaged_ms;
    // Sessions uniques PAR JOUR (une même session sur 2 jours = 1 par jour).
    let set = perDay.get(key);
    if (!set) { set = new Set(); perDay.set(key, set); }
    set.add(row.session_id);
  }
  for (const [key, set] of perDay) {
    const point = map.get(key);
    if (point) point.sessions = set.size;
  }
  return [...map.values()].sort((a, b) => (a.day < b.day ? -1 : 1));
}

export interface CountryStat {
  iso2: string;
  name: string;
  views: number;
  pct: number;
}

export function computeCountries(rows: AnalyticsRow[]): CountryStat[] {
  const known = new Map<string, number>();
  let unknown = 0;
  for (const row of rows) {
    if (row.country_iso2) known.set(row.country_iso2, (known.get(row.country_iso2) ?? 0) + 1);
    else unknown += 1;
  }
  const total = rows.length;
  if (total === 0) return [];
  const list: CountryStat[] = [...known.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([iso2, views]) => ({ iso2, name: "", views, pct: Math.round((views / total) * 100) }));
  if (unknown > 0) {
    list.push({ iso2: "", name: "", views: unknown, pct: Math.round((unknown / total) * 100) });
    // Le bucket « Inconnu » reste à la FIN (jamais fusionné avec un pays).
  }
  return list;
}

export interface ArticleStat {
  articleId: string;
  title: string;
  publishedAt: string | null;
  views: number;
  sessions: number;
  avgEngagedMs: number | null;
  engagedReads: number;
  engagedReadRate: number | null;
}

export function computeTopArticles(
  rows: AnalyticsRow[],
  articleMeta: Map<string, { title: string; published_at: string | null }>
): ArticleStat[] {
  const byArticle = new Map<string, AnalyticsRow[]>();
  for (const row of rows) {
    if (row.path_kind !== "article" || !row.article_id) continue;
    const list = byArticle.get(row.article_id);
    if (list) list.push(row);
    else byArticle.set(row.article_id, [row]);
  }
  const stats: ArticleStat[] = [];
  for (const [articleId, list] of byArticle) {
    const meta = articleMeta.get(articleId);
    // Sans métadonnée (article supprimé) : la ligne reste agrégée MAIS
    // affichée avec un libellé neutre — jamais un titre inventé.
    const withEngagement = list.filter((r) => r.engaged_ms > 0);
    const engagedReads = list.filter((r) => r.engaged_ms >= ENGAGED_READ_MS).length;
    stats.push({
      articleId,
      title: meta?.title ?? "(article retiré ou indisponible)",
      publishedAt: meta?.published_at ?? null,
      views: list.length,
      sessions: new Set(list.map((r) => r.session_id)).size,
      avgEngagedMs:
        withEngagement.length === 0
          ? null
          : Math.round(withEngagement.reduce((s, r) => s + r.engaged_ms, 0) / withEngagement.length),
      engagedReads,
      engagedReadRate:
        list.length === 0 ? null : Math.round((engagedReads / list.length) * 100),
    });
  }
  return stats.sort((a, b) => b.views - a.views);
}

export interface SimpleStat<K extends string> {
  key: K;
  views: number;
  pct: number;
}

export function computeByField<K extends string>(
  rows: AnalyticsRow[],
  pick: (row: AnalyticsRow) => K,
  order: Iterable<K>
): SimpleStat<K>[] {
  const counts = new Map<K, number>();
  for (const row of rows) {
    const key = pick(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const total = rows.length;
  const ordered = [...order]
    .filter((k) => counts.has(k))
    .map((k) => ({ key: k, views: counts.get(k) as number, pct: total ? Math.round(((counts.get(k) as number) / total) * 100) : 0 }));
  ordered.sort((a, b) => b.views - a.views);
  return ordered;
}

export interface HeatCell {
  dow: number; // 0 = lundi … 6 = dimanche
  hour: number; // 0-23 (UTC = Conakry)
  views: number;
}

/** Grille 7×24 : jours où le site est le plus visité × heures. */
export function computeGrid(rows: AnalyticsRow[]): { cells: HeatCell[]; views: number } {
  const map = new Map<string, number>();
  for (const row of rows) {
    const d = new Date(row.created_at);
    // UTC = heure de Conakry (GMT+0) : aucun décalage à corriger.
    const dow = (d.getUTCDay() + 6) % 7; // lundi = 0
    const hour = d.getUTCHours();
    const key = `${dow}:${hour}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  const cells: HeatCell[] = [...map.entries()].map(([key, views]) => {
    const [dow, hour] = key.split(":").map(Number);
    return { dow, hour, views };
  });
  return { cells, views: rows.length };
}

/** Conseils « meilleures périodes de publier » : les 3 cases les plus élevées. */
export function bestPublishSlots(cells: HeatCell[], minViews = 3): HeatCell[] {
  return [...cells].filter((c) => c.views >= minViews).sort((a, b) => b.views - a.views).slice(0, 3);
}

export const DOW_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
