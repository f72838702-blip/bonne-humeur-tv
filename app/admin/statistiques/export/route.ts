import { requireRole } from "@/lib/auth/session";
import {
  computeCountries,
  computeDailySeries,
  computeGrid,
  computeTopArticles,
  computeByField,
  DOW_LABELS,
} from "@/lib/analytics/aggregate";
import {
  BROWSER_LABELS,
  DEVICE_LABELS,
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

/**
 * Export CSV des statistiques de la période — ADMIN UNIQUEMENT (guard
 * requireRole + RLS 0029). Données anonymes uniquement (aucune donnée
 * personnelle : sessions et pages vues agrégées).
 */

export async function GET(request: Request): Promise<Response> {
  const guard = await requireRole(["admin"]);
  if ("denied" in guard) {
    return new Response("Accès réservé aux administrateurs.", { status: 403 });
  }

  const url = new URL(request.url);
  const presetParam = url.searchParams.get("periode") ?? "7d";
  const preset = PERIOD_PRESETS.includes(presetParam as never)
    ? presetParam
    : presetParam === "custom"
      ? "custom"
      : "7d";
  const range = resolvePeriodRange(
    preset,
    url.searchParams.get("du") ?? undefined,
    url.searchParams.get("au") ?? undefined
  );

  const [rows, meta] = await Promise.all([fetchPeriodRows(range), fetchArticleMeta()]);
  if (rows === null) {
    // Cap atteint : pas de chiffre tronqué — export par tranches plus courtes.
    return new Response("Période trop volumineuse : exportez par tranches plus courtes.", {
      status: 413,
    });
  }

  const prevRows = (await fetchPeriodRows(previousRange(range))) ?? [];
  const daily = computeDailySeries(rows);
  const top = computeTopArticles(rows, meta);
  const countries = computeCountries(rows);
  const sources = computeByField(rows, (r) => r.referrer_class, Object.keys(REFERRER_LABELS) as ReferrerClass[]);
  const devices = computeByField(rows, (r) => r.device, ["mobile", "desktop", "tablet"] as Device[]);
  const browsers = computeByField(rows, (r) => r.browser, Object.keys(BROWSER_LABELS) as Browser[]);
  const grid = computeGrid(rows).cells;

  const escape = (v: string | number | null) => {
    const s = String(v ?? "");
    return /[",;\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  const lines: string[] = [];
  lines.push(`Statistiques Bonne Humeur TV — du ${range.from.toISOString()} au ${range.to.toISOString()}`);
  lines.push("");
  lines.push("ÉVOLUTION JOURNALIÈRE");
  lines.push("Date;Sessions estimées;Pages vues;Engagement visible total");
  for (const p of daily) {
    lines.push(`${p.day};${p.sessions};${p.views};${formatDuration(p.engagedMs)}`);
  }
  lines.push("");
  lines.push("ARTICLES LES PLUS LUS");
  lines.push("Titre;Lectures;Lecteurs uniques;Engagement moyen;Lectures engagées;Taux lecture engagée;Publié le");
  for (const a of top) {
    lines.push(
      [a.title, a.views, a.sessions, a.avgEngagedMs === null ? "donnée insuffisante" : formatDuration(a.avgEngagedMs), a.engagedReads, a.engagedReadRate === null ? "" : `${a.engagedReadRate}%`, a.publishedAt].map(escape).join(";")
    );
  }
  lines.push("");
  lines.push("PAYS");
  lines.push("Code;Pays;Pages vues;Part");
  for (const c of countries) {
    lines.push(
      [c.iso2 || "Inconnu", c.iso2 ? "" : "—", c.views, `${c.pct}%`].map(escape).join(";")
    );
  }
  lines.push("");
  lines.push("SOURCES DE TRAFIC");
  lines.push("Source;Pages vues;Part");
  for (const s of sources) {
    lines.push([REFERRER_LABELS[s.key], s.views, `${s.pct}%`].map(escape).join(";"));
  }
  lines.push("");
  lines.push("APPAREILS");
  lines.push("Appareil;Pages vues;Part");
  for (const s of devices) {
    lines.push([DEVICE_LABELS[s.key], s.views, `${s.pct}%`].map(escape).join(";"));
  }
  lines.push("");
  lines.push("NAVIGATEURS");
  lines.push("Navigateur;Pages vues;Part");
  for (const s of browsers) {
    lines.push([BROWSER_LABELS[s.key], s.views, `${s.pct}%`].map(escape).join(";"));
  }
  lines.push("");
  lines.push("JOURS × HEURES (heure de Conakry, GMT+0)");
  lines.push("Jour;Heure;Pages vues");
  for (const c of [...grid].sort((a, b) => b.views - a.views)) {
    lines.push(`${DOW_LABELS[c.dow]};${c.hour} h;${c.views}`);
  }

  const csv = "﻿" + lines.join("\r\n"); // BOM UTF-8 (Excel accents)
  const date = range.from.toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="statistiques-${date}.csv"`,
      "cache-control": "no-store",
    },
  });
}