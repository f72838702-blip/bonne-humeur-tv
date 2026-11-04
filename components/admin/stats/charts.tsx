import {
  BROWSER_LABELS,
  DEVICE_LABELS,
  REFERRER_LABELS,
  countryFlag,
  countryName,
  formatDuration,
} from "@/lib/analytics/classes";
import {
  DOW_LABELS,
  type ArticleStat,
  type CountryStat,
  type DailyPoint,
  type HeatCell,
  type SimpleStat,
} from "@/lib/analytics/aggregate";
import { formatDateTime } from "@/lib/utils";

/**
 * Graphiques SVG MAISON (aucune dépendance, rendus serveur — zéro JS client,
 * rapide sur mobile). Chaque titre porte une explication courte, chaque
 * marque a une infobulle <title>. Aucun chiffre fictif : les états vides
 * sont des messages honnêtes.
 */

const RED = "var(--bhtv-chart, #cc0000)";

function Trend({ delta }: { delta: number | null }) {
  if (delta === null) {
    return <span className="text-[10px] font-semibold text-neutral-400">— pas de comparaison</span>;
  }
  if (delta === 0) return <span className="text-[10px] font-semibold text-neutral-500">= stable</span>;
  const up = delta > 0;
  return (
    <span className={`text-[10px] font-extrabold ${up ? "text-guinea-green" : "text-guinea-red"}`}>
      {up ? "↗ +" : "↘ "}
      {delta}% vs période précédente
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
  delta,
}: {
  label: string;
  value: string;
  hint: string;
  delta: number | null;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-night-800">
      <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {label}
      </p>
      <p className="font-display text-3xl font-extrabold tabular-nums">{value}</p>
      <Trend delta={delta} />
      <p className="text-[10px] leading-snug text-neutral-400">{hint}</p>
    </div>
  );
}

/** A. Courbe d'évolution — sessions + pages vues par jour (+ pointsillés période précédente). */
export function VisitsLineChart({
  points,
  prevPoints,
}: {
  points: DailyPoint[];
  prevPoints: DailyPoint[];
}) {
  if (points.length === 0) {
    return <EmptyChart label="Aucune visite enregistrée sur cette période (la collecte démarre après le déploiement)." />;
  }
  const W = 640;
  const H = 220;
  const pad = { l: 34, r: 8, t: 10, b: 22 };
  const all = [...points.map((p) => p.views), ...prevPoints.map((p) => p.views)];
  const maxV = Math.max(3, ...all);
  const n = Math.max(points.length, prevPoints.length);
  const x = (i: number) => pad.l + (n <= 1 ? 0 : ((W - pad.l - pad.r) * i) / (n - 1));
  const y = (v: number) => H - pad.b - (H - pad.t - pad.b) * (v / maxV);
  const path = (list: DailyPoint[], offset: number) =>
    list
      .map((p, i) => `${i === 0 ? "M" : "L"}${x(i + offset).toFixed(1)},${y(p.views).toFixed(1)}`)
      .join(" ");

  const labelsStep = Math.max(1, Math.ceil(points.length / 8));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Évolution des visites">
      <line x1={pad.l} y1={H - pad.b} x2={W - pad.r} y2={H - pad.b} className="stroke-neutral-300 dark:stroke-white/20" />
      <text x={4} y={pad.t + 4} className="fill-neutral-400 text-[9px]">{maxV}</text>
      <text x={4} y={H - pad.b - 2} className="fill-neutral-400 text-[9px]">0</text>
      {prevPoints.length > 0 && (
        <path d={path(prevPoints, 0)} fill="none" strokeWidth="1.5" strokeDasharray="4 3" className="stroke-neutral-400" />
      )}
      <path d={path(points, 0)} fill="none" strokeWidth="2.5" stroke={RED} />
      {points.map((p, i) => (
        <circle key={p.day} cx={x(i)} cy={y(p.views)} r="3" fill={RED}>
          <title>{`${p.day} — ${p.views} pages vues, ${p.sessions} session(s)`}</title>
        </circle>
      ))}
      {points.map((p, i) =>
        i % labelsStep === 0 ? (
          <text key={`l${p.day}`} x={x(i)} y={H - 6} textAnchor="middle" className="fill-neutral-400 text-[8px]">
            {p.day.slice(8, 10)}/{p.day.slice(5, 7)}
          </text>
        ) : null
      )}
    </svg>
  );
}

export function EmptyChart({ label }: { label: string }) {
  return (
    <p className="rounded-xl bg-neutral-100 px-4 py-6 text-center text-xs text-neutral-500 dark:bg-white/5 dark:text-neutral-400">
      {label}
    </p>
  );
}

/** B. Pays : drapeau + nom + part — « Inconnu » distinct en dernier. */
export function CountryRanking({ stats }: { stats: CountryStat[] }) {
  if (stats.length === 0) {
    return <EmptyChart label="Aucun pays enregistré sur la période." />;
  }
  const max = Math.max(...stats.map((s) => s.views));
  return (
    <ul className="flex flex-col gap-2">
      {stats.map((s) => (
        <li key={s.iso2 || "unknown"} className="flex items-center gap-2 text-xs">
          <span className="w-6 text-center text-sm">{s.iso2 ? countryFlag(s.iso2) : "🌍"}</span>
          <span className="w-32 shrink-0 truncate font-semibold">
            {s.iso2 ? countryName(s.iso2) : "Inconnu"}
          </span>
          <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-neutral-100 dark:bg-white/10">
            <span
              className="block h-full rounded-full"
              style={{ width: `${max ? Math.round((s.views / max) * 100) : 0}%`, background: RED }}
            />
          </span>
          <span className="w-24 shrink-0 text-right tabular-nums text-neutral-500 dark:text-neutral-400">
            {s.views} · {s.pct}%
          </span>
        </li>
      ))}
    </ul>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Bbis. Carte du monde schématique (SVG maison, projection équirectangulaire)
// — continents simplifiés en silhouettes neutres + un point par pays AYANT
// des visites, positionné sur son centroïde réel (ISO-2 → lat/lon connus).
// Un pays détecté mais sans centroïde connu reste dans le classement et n'est
// jamais positionné au hasard : rien n'est inventé.
// ─────────────────────────────────────────────────────────────────────────

const MAP_W = 720;
const MAP_H = 300;
const LAT_TOP = 83; // coupe au nord (aucune visite en Antarctique et au pôle)

/** x/y équirectangulaires : lon −180→180 / lat −60→+83. */
function project(lon: number, lat: number): [number, number] {
  return [(lon + 180) * 2, (LAT_TOP - lat) * 2];
}

const CONTINENTS: [number, number][][] = [
  [[-168,65],[-165,60],[-153,57],[-135,57],[-130,52],[-125,48],[-122,37],[-117,32],[-105,23],[-96,16],[-88,21],[-83,23],[-81,25],[-75,35],[-70,42],[-65,45],[-60,47],[-55,52],[-64,60],[-78,62],[-85,70],[-100,70],[-125,70],[-155,71]],
  [[-77,7],[-72,11],[-62,10],[-52,5],[-44,-3],[-35,-6],[-39,-13],[-41,-22],[-48,-28],[-58,-34],[-62,-41],[-65,-47],[-68,-52],[-71,-54],[-73,-44],[-71,-33],[-70,-18],[-77,-12],[-81,-6],[-80,0]],
  [[-9,43],[-9,37],[-6,36],[-2,36],[5,40],[12,44],[15,38],[19,40],[27,36],[36,36],[35,30],[34,28],[39,21],[52,17],[57,25],[66,25],[72,20],[77,8],[80,13],[87,21],[92,21],[95,16],[100,13],[103,1],[105,10],[108,21],[117,23],[122,30],[122,39],[128,42],[130,43],[135,48],[142,53],[150,59],[158,52],[160,60],[170,66],[180,68],[170,72],[150,73],[130,73],[110,74],[90,75],[70,73],[60,71],[45,68],[35,70],[30,72],[25,71],[15,64],[10,59],[4,52],[0,49],[-2,48]],
  [[-17,15],[-17,21],[-13,28],[-6,33],[-2,35],[10,37],[20,32],[25,32],[32,31],[35,24],[43,12],[51,12],[46,4],[41,-2],[40,-10],[35,-18],[32,-26],[27,-33],[19,-34],[13,-23],[12,-6],[9,4],[4,6],[-8,5],[-13,9]],
  [[114,-22],[113,-26],[116,-32],[122,-34],[129,-32],[135,-35],[140,-38],[147,-39],[150,-35],[153,-28],[146,-19],[142,-11],[136,-12],[131,-11],[126,-14],[122,-17]],
  [[-45,60],[-50,64],[-55,68],[-52,73],[-45,77],[-35,80],[-25,78],[-22,72],[-30,68],[-40,63]],
  [[44,-16],[48,-14],[50,-17],[47,-25],[44,-22]],
  [[-5,50],[1,51],[0,53],[-2,56],[-6,58],[-8,55]],
  [[130,31],[135,34],[140,36],[142,41],[145,44],[140,38],[135,33]],
  [[95,5],[105,-6],[120,-9],[135,-5],[141,-3],[130,0],[115,2],[100,4]],
  [[172,-41],[175,-40],[174,-36],[170,-44]],
];

/** Centroïdes approximatifs (ISO-2 → [lon, lat]) — positions réelles, pas des placements esthétiques. */
const CENTROIDS: Record<string, [number, number]> = {
  GN: [-11, 10.5], CI: [-5.5, 7.5], SN: [-14.5, 14.5], ML: [-3.5, 17], BF: [-1.5, 12.5],
  SL: [-11.8, 8.5], LR: [-9.5, 6.5], GH: [-1, 8], NG: [8, 9.5], TG: [1, 8.6], BJ: [2.3, 9.3],
  CM: [12.7, 5.7], MA: [-6.8, 32], DZ: [2.6, 28], TN: [9.5, 34],
  FR: [2.3, 46.6], BE: [4.5, 50.6], DE: [10.4, 51.2], GB: [-1.5, 52.5], ES: [-3.7, 40.4],
  PT: [-8, 39.5], IT: [12.8, 42.8],
  US: [-98, 39], CA: [-106, 56],
};

/** Carte du monde : les pays avec visites en points proportionnels. */
export function CountryMap({ stats }: { stats: CountryStat[] }) {
  const dots = stats
    .filter((s) => s.iso2 && CENTROIDS[s.iso2])
    .map((s) => ({ ...s, lon: CENTROIDS[s.iso2][0], lat: CENTROIDS[s.iso2][1] }));
  const skipped = stats.filter((s) => s.iso2 && !CENTROIDS[s.iso2]).length;
  const max = Math.max(1, ...dots.map((d) => d.views));

  const legend =
    dots.length === 0
      ? "Aucun pays localisable avec des visites sur la période — voir le classement à drapeaux ci-dessus."
      : "Taille du point = pages vues du pays. Les contours sont schématiques, les positions réelles.";

  return (
    <div className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        className="w-full"
        role="img"
        aria-label="Carte du monde de l'audience (schématique)"
      >
        {CONTINENTS.map((poly, i) => (
          <path
            key={i}
            d={poly.map(([lon, lat], j) => {
              const [x, y] = project(lon, lat);
              return `${j === 0 ? "M" : "L"}${x.toFixed(0)},${y.toFixed(0)}`;
            }).join(" ") + " Z"}
            className="fill-neutral-200/70 dark:fill-white/10"
          />
        ))}
        {dots.map((d) => {
          const [cx, cy] = project(d.lon, d.lat);
          const r = 3 + 9 * Math.sqrt(d.views / max);
          return (
            <circle key={d.iso2} cx={cx} cy={cy} r={r.toFixed(1)} fill={RED} fillOpacity="0.85">
              <title>{`${countryName(d.iso2)} — ${d.views} page(s) vue(s), ${d.pct}%`}</title>
            </circle>
          );
        })}
      </svg>
      <p className="text-[10px] text-neutral-400">
        {legend}
        {skipped > 0 &&
          " Pays localisation indisponible (absents de la carte mais comptés dans le classement) : " + skipped + "."}
      </p>
    </div>
  );
}

/** D. Sources de trafic / E. Appareils & navigateurs — barres horizontales. */
export function ReferrerBars<T extends string>({ stats }: { stats: SimpleStat<T>[] }) {
  if (stats.length === 0) return <EmptyChart label="Aucune provenance identifiée (accès directs seulement)." />;
  const max = Math.max(...stats.map((s) => s.views));
  return (
    <ul className="flex flex-col gap-2">
      {stats.map((s) => {
        const label =
          (REFERRER_LABELS as Record<string, string>)[s.key] ??
          (DEVICE_LABELS as Record<string, string>)[s.key] ??
          (BROWSER_LABELS as Record<string, string>)[s.key] ??
          s.key;
        return (
          <li key={s.key} className="flex items-center gap-2 text-xs">
            <span className="w-32 shrink-0 truncate font-semibold">{label}</span>
            <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-neutral-100 dark:bg-white/10">
              <span
                className="block h-full rounded-full"
                style={{ width: `${max ? Math.round((s.views / max) * 100) : 0}%`, background: RED }}
              />
            </span>
            <span className="w-24 shrink-0 text-right tabular-nums text-neutral-500 dark:text-neutral-400">
              {s.views} · {s.pct}%
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** C. Tableau des articles les plus lus (cliquable vers la fiche détaillée). */
export function TopArticlesTable({ stats }: { stats: ArticleStat[] }) {
  if (stats.length === 0) return <EmptyChart label="Aucun article consulté sur la période." />;
  return (
    <ul className="flex flex-col gap-3">
      {stats.slice(0, 10).map((a, rank) => (
        <li key={a.articleId}>
          <a
            href={`/admin/statistiques/articles/${a.articleId}`}
            className="flex flex-col gap-1 rounded-xl border border-neutral-200 bg-white p-3 transition-colors hover:border-guinea-red/40 dark:border-white/10 dark:bg-night-800"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-guinea-red/10 px-2 py-0.5 text-[10px] font-extrabold text-guinea-red">
                {rank + 1}
              </span>
              <span className="flex-1 text-sm font-bold">{a.title}</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-neutral-500 dark:text-neutral-400">
              <span className="tabular-nums">{a.views} lecture(s)</span>
              <span className="tabular-nums">{a.sessions} lecteur(s) unique(s)</span>
              <span className="tabular-nums">
                engagement moyen : {a.avgEngagedMs === null ? "donnée insuffisante" : formatDuration(a.avgEngagedMs)}
              </span>
              <span className="tabular-nums">lecture engagée : {a.engagedReadRate === null ? "—" : `${a.engagedReadRate}%`}</span>
              {a.publishedAt && <span>publié le {formatDateTime(a.publishedAt)}</span>}
            </div>
          </a>
        </li>
      ))}
    </ul>
  );
}

/** F. Grille jours × heures (UTC = heure de Conakry) + conseils de publication. */
export function HeatGrid({ cells }: { cells: HeatCell[] }) {
  if (cells.length === 0) return <EmptyChart label="Aucune visite pour cette grille (pas assez de données)." />;
  const max = Math.max(...cells.map((c) => c.views));
  const bySlot = new Map<string, number>();
  for (const c of cells) bySlot.set(`${c.dow}:${c.hour}`, c.views);
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[560px] text-[9px]" aria-label="Fréquentation par jour et heure">
        <thead>
          <tr>
            <th className="p-0.5" />
            {Array.from({ length: 24 }, (_, h) => (
              <th key={h} className="p-0.5 font-medium text-neutral-400">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DOW_LABELS.map((day, dow) => (
            <tr key={day}>
              <td className="pr-2 text-right font-semibold text-neutral-500 dark:text-neutral-400">{day}</td>
              {Array.from({ length: 24 }, (_, h) => {
                const v = bySlot.get(`${dow}:${h}`);
                const intensity = v ? Math.max(0.08, v / max) : 0;
                return (
                  <td key={h} className="p-0.5">
                    <div
                      className="h-4 rounded-[3px]"
                      style={v ? { background: RED, opacity: intensity } : undefined}
                      title={v ? `${day} ${h} h — ${v} page(s) vue(s)` : `${day} ${h} h — rien`}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}