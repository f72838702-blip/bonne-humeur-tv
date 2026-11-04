import { describe, expect, it } from "vitest";
import {
  ABANDON_MS,
  ENGAGED_READ_MS,
  classifyBrowser,
  classifyDevice,
  classifyReferrer,
  capEngagement,
  countryFlag,
  countryName,
  formatDuration,
  isAbandoned,
  isBotUserAgent,
  isEngagedRead,
  percentDelta,
  previousRange,
  resolvePeriodRange,
  REFERRER_LABELS,
  toCountryIso2,
} from "@/lib/analytics/classes";
import {
  DOW_LABELS,
  bestPublishSlots,
  computeByField,
  computeCountries,
  computeDailySeries,
  computeGrid,
  computeTopArticles,
  computeTotals,
  type AnalyticsRow,
} from "@/lib/analytics/aggregate";

/**
 * Scénarios §12 de la mission Statistiques — noyau pur (classes + agrégats).
 * Chaque test prouve une règle d'honnêteté : aucun chiffre inventé,
 * aucun fusionnement de données absentes.
 */

let seq = 0;
function row(p: Partial<AnalyticsRow> & { session: string }): AnalyticsRow {
  seq += 1;
  return {
    created_at: p.created_at ?? "2026-11-04T10:00:00Z",
    session_id: p.session,
    event_id: `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`,
    path: p.path ?? "/",
    path_kind: p.path_kind ?? "other",
    article_id: p.article_id ?? null,
    device: p.device ?? "mobile",
    browser: p.browser ?? "chrome",
    country_iso2: p.country_iso2 ?? null,
    referrer_class: p.referrer_class ?? "direct",
    engaged_ms: p.engaged_ms ?? 0,
  };
}

describe("scénario 12-9 : trafic automatisé exclu de la collecte", () => {
  it("robots, crawlers, outils de monitoring → refusés", () => {
    expect(isBotUserAgent("Googlebot/2.1 (+http://www.google.com/bot.html)")).toBe(true);
    expect(isBotUserAgent("curl/8.4.0")).toBe(true);
    expect(isBotUserAgent("python-requests/2.31")).toBe(true);
    expect(isBotUserAgent("facebookexternalhit/1.1")).toBe(true);
    expect(isBotUserAgent("HeadlessChrome/120.0.0.0")).toBe(true);
    expect(isBotUserAgent("Uptime-Kuma/1.23 monitor")).toBe(true);
  });

  it("navigateurs réels → acceptés ; UA vide/trop court → refusé", () => {
    expect(isBotUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Mobile Safari")).toBe(false);
    expect(isBotUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36")).toBe(false);
    expect(isBotUserAgent(null)).toBe(true);
    expect(isBotUserAgent("")).toBe(true);
    expect(isBotUserAgent("Mozilla")).toBe(true); // trop court pour être crédible
  });
});

describe("scénarios 12-1/2/3/8 : appareils et navigateurs classés côté serveur", () => {
  it("mobile / desktop / tablette depuis l'User-Agent réel", () => {
    expect(classifyDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile Safari")).toBe("mobile");
    expect(classifyDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0")).toBe("desktop");
    expect(classifyDevice("Mozilla/5.0 (iPad; CPU OS 17_0) Safari")).toBe("tablet");
    expect(classifyDevice("Mozilla/5.0 (Linux; Android 9; SHIELD Tablet K1) Chrome/110")).toBe("tablet");
    // Android sans mention tablette → mobile (heurétique simple, documentée)
    expect(classifyDevice("Mozilla/5.0 (Linux; Android 13; SM-A536E) Chrome/120 Mobile")).toBe("mobile");
  });

  it("Edge/Opéra/Samsung reconnus AVANT Chrome (leur UA contient 'Chrome')", () => {
    expect(classifyBrowser("Mozilla/5.0 Windows Chrome/120.0 Edg/120.0")).toBe("edge");
    expect(classifyBrowser("Mozilla/5.0 OPR/85.0 Opera")).toBe("opera");
    expect(classifyBrowser("Mozilla/5.0 SamsungBrowser/24.0 Chrome/110")).toBe("samsung");
    expect(classifyBrowser("Mozilla/5.0 Windows Firefox/119.0")).toBe("firefox");
    expect(classifyBrowser("Mozilla/5.0 iPhone CriOS/119.0 Mobile")).toBe("chrome");
    expect(classifyBrowser("Mozilla/5.0 Macintosh Safari/17.0")).toBe("safari");
    expect(classifyBrowser("NavigateurExotique/1.0")).toBe("other");
  });
});

describe("scénarios 12-11/12 : pays — absent → Inconnu, jamais inventé", () => {
  it("valeur absente ou mal formée → null (bucket Inconnu à part)", () => {
    expect(toCountryIso2(null)).toBeNull();
    expect(toCountryIso2(undefined)).toBeNull();
    expect(toCountryIso2("T1")).toBeNull();
    expect(toCountryIso2("g n")).toBeNull();
    expect(toCountryIso2("gn")).toBe("GN"); // bien formé mais casse libre
  });

  it("multi-pays agrégés séparément, Inconnu en fin de liste, jamais fusionné", () => {
    expect(countryFlag("GN")).toBe("🇬🇳");
    expect(countryFlag("FR")).toBe("🇫🇷");
    expect(countryFlag("12")).toBe("🏳️");
    const rows = [
      row({ session: "s1", country_iso2: "GN" }),
      row({ session: "s2", country_iso2: "GN" }),
      row({ session: "s3", country_iso2: "FR" }),
      row({ session: "s4", country_iso2: null }),
    ];
    const list = computeCountries(rows);
    expect(list.find((c) => c.iso2 === "GN")).toMatchObject({ views: 2, pct: 50 });
    expect(list.find((c) => c.iso2 === "FR")).toMatchObject({ views: 1, pct: 25 });
    expect(list[list.length - 1]).toMatchObject({ iso2: "", views: 1, pct: 25 }); // Inconnu en fin
    expect(countryName("GN")).toBe("Guinée");
    expect(countryName("ZZ")).toBe("ZZ"); // code brut — nom jamais inventé
  });
});

describe("scénarios 12-4/5/6/7 : engagement = temps VISIBLE uniquement", () => {
  it("départ immédiat (< 10 s) = abandonné, jamais une lecture engagée", () => {
    expect(isAbandoned(5_000)).toBe(true);
    expect(isAbandoned(0)).toBe(false); // 0 = pas encore mesuré, pas « abandonné »
    expect(isEngagedRead(5_000)).toBe(false);
  });

  it("arrière-plan : le non-visible n'entre pas — serveur plafonne 24 h, refuse négatif/NaN", () => {
    expect(capEngagement(200_000)).toBe(200_000);
    expect(capEngagement(100_000_000)).toBe(86_400_000);
    expect(capEngagement(-5)).toBe(0);
    expect(capEngagement(NaN)).toBe(0);
    expect(capEngagement(Infinity)).toBe(0);
  });

  it("seuil de lecture engagée : exactement ≥ 30 s de page visible", () => {
    expect(isEngagedRead(30_000)).toBe(true);
    expect(isEngagedRead(29_999)).toBe(false);
    expect(ENGAGED_READ_MS).toBe(30_000);
    expect(ABANDON_MS).toBe(10_000);
  });

  it("durée affichée « estimée » et humanisée", () => {
    expect(formatDuration(0)).toBe("0 s");
    expect(formatDuration(45_000)).toBe("45 s");
    expect(formatDuration(90_000)).toBe("1 min 30 s");
    expect(formatDuration(3_600_000)).toBe("1 h");
    expect(formatDuration(NaN)).toBe("0 s");
  });
});

describe("totaux — sessions ≠ pages vues ; comparaisons honnêtes", () => {
  it("scénario 12-15 : aucune donnée → zéros réels, moyennes refusées (null), aucune invention", () => {
    const t = computeTotals([], []);
    expect(t.sessions).toBe(0);
    expect(t.views).toBe(0);
    expect(t.avgEngagedMs).toBeNull();
    expect(t.engagedReadRate).toBeNull();
    expect(t.abandoned).toBe(0);
    expect(t.deltas.views).toBe(0); // 0 vs 0 = stable — la comparaison existe
  });

  it("un lecteur de 2 pages = 1 session + 2 pages vues", () => {
    const t = computeTotals(
      [row({ session: "s1" }), row({ session: "s1" }), row({ session: "s2" })],
      []
    );
    expect(t.sessions).toBe(2);
    expect(t.views).toBe(3);
  });

  it("variation % : base précédente à 0 → null (pas de +∞ ni de faux poucentage)", () => {
    expect(percentDelta(5, 0)).toBeNull();
    expect(percentDelta(0, 0)).toBe(0);
    expect(percentDelta(0, 10)).toBe(-100);
    expect(percentDelta(15, 10)).toBe(50);
    expect(percentDelta(10, 20)).toBe(-50);
  });

  it("période précédente : même durée, accolée juste avant la période", () => {
    const range = resolvePeriodRange("7d");
    const prev = previousRange(range);
    const span = range.to.getTime() - range.from.getTime();
    expect(Math.abs(prev.to.getTime() - range.from.getTime())).toBeLessThan(2_000);
    expect(Math.abs(prev.to.getTime() - prev.from.getTime() - span)).toBeLessThan(2_000);
  });

  it("série journalière : sessions dédoublonnées PAR JOUR (1 session sur 2 jours = 1 + 1)", () => {
    const series = computeDailySeries([
      row({ session: "s1", created_at: "2026-11-01T08:00:00Z" }),
      row({ session: "s1", created_at: "2026-11-01T09:00:00Z" }),
      row({ session: "s1", created_at: "2026-11-02T10:00:00Z" }),
      row({ session: "s2", created_at: "2026-11-02T08:00:00Z" }),
    ]);
    expect(series).toHaveLength(2);
    expect(series[0]).toMatchObject({ day: "2026-11-01", views: 2, sessions: 1 });
    expect(series[1]).toMatchObject({ day: "2026-11-02", views: 2, sessions: 2 });
  });
});

describe("articles les plus lis (scénarios 12-5 lecture longue & 12-14 absence)", () => {
  const meta = new Map([
    ["a1", { title: "Reportage Conakry", published_at: "2026-11-01T08:00:00Z" }],
  ]);

  it("classement : lectures, sessions uniques, engagement moyen, lectures engagées", () => {
    const top = computeTopArticles(
      [
        row({ session: "s1", path: "/actualites/reportage", path_kind: "article", article_id: "a1", engaged_ms: 120_000 }),
        row({ session: "s1", path: "/actualites/reportage", path_kind: "article", article_id: "a1", engaged_ms: 45_000 }),
        row({ session: "s2", path: "/actualites/reportage", path_kind: "article", article_id: "a1", engaged_ms: 5_000 }),
      ],
      meta
    );
    expect(top).toHaveLength(1);
    expect(top[0]).toMatchObject({
      articleId: "a1",
      views: 3,
      sessions: 2, // s1 deux fois, s2 une fois
      engagedReads: 2, // 120 s et 45 s ≥ 30 s ; 5 s non
      engagedReadRate: 67,
    });
    // Moyenne sur les lectures ayant déjà un temps mesuré (> 0), abandon inclus.
    expect(top[0].avgEngagedMs).toBe(Math.round((120_000 + 45_000 + 5_000) / 3));
  });

  it("article retiré : agrégat conservé avec libellé neutre — titre jamais inventé", () => {
    const top = computeTopArticles(
      [row({ session: "s1", path: "/actualites/x", path_kind: "article", article_id: "zz" })],
      meta
    );
    expect(top[0].title).toBe("(article retiré ou indisponible)");
    expect(top[0].publishedAt).toBeNull();
  });

  it("pages hors articles : aucun faux article", () => {
    expect(computeTopArticles([row({ session: "s1", path: "/" })], meta)).toHaveLength(0);
  });
});

describe("provenance (scénario 12-10) : WhatsApp / Facebook / moteurs / direct", () => {
  it("réseaux sociaux reconnus par hôte réel", () => {
    expect(classifyReferrer("https://wa.me/22460000000")).toBe("whatsapp");
    expect(classifyReferrer("https://chat.whatsapp.com/AbC")).toBe("whatsapp");
    expect(classifyReferrer("https://lm.facebook.com/l.php?u=x")).toBe("facebook");
    expect(classifyReferrer("https://m.facebook.com/")).toBe("facebook");
    expect(classifyReferrer("https://www.instagram.com/")).toBe("instagram");
    expect(classifyReferrer("https://t.co/abc")).toBe("twitter");
    expect(classifyReferrer("https://youtu.be/x")).toBe("youtube");
  });

  it("moteurs → search ; sites externes → external ; rien → direct ; invalide → unknown", () => {
    expect(classifyReferrer("https://www.google.com/search?q=x")).toBe("search");
    expect(classifyReferrer("https://www.google.com.gn/")).toBe("search");
    expect(classifyReferrer("https://duckduckgo.com/")).toBe("search");
    expect(classifyReferrer("https://example.org/article")).toBe("external");
    expect(classifyReferrer(null)).toBe("direct");
    expect(classifyReferrer(undefined)).toBe("direct");
    expect(classifyReferrer("")).toBe("direct");
    expect(classifyReferrer("pas une url")).toBe("unknown");
  });

  it("répartition des sources : comptage et parts exacts, tri décroissant", () => {
    const list = computeByField(
      [
        row({ session: "s1", referrer_class: "whatsapp" }),
        row({ session: "s2", referrer_class: "whatsapp" }),
        row({ session: "s3", referrer_class: "direct" }),
      ],
      (r) => r.referrer_class,
      Object.keys(REFERRER_LABELS)
    );
    expect(list).toEqual([
      { key: "whatsapp", views: 2, pct: 67 },
      { key: "direct", views: 1, pct: 33 },
    ]);
  });
});

describe("grille jours × heures — heure de Conakry (GMT+0) sans conversion", () => {
  it("jeudi 10 h UTC = jeudi 10 h Conakry ; conseils = cases ≥ 3 vues, top 3", () => {
    const rows = [
      row({ session: "s1", created_at: "2026-11-05T10:00:00Z" }), // jeudi
      row({ session: "s2", created_at: "2026-11-05T10:30:00Z" }),
      row({ session: "s3", created_at: "2026-11-05T10:45:00Z" }),
      row({ session: "s4", created_at: "2026-11-02T22:00:00Z" }), // lundi
      row({ session: "s5", created_at: "2026-11-08T22:00:00Z" }), // dimanche
    ];
    const grid = computeGrid(rows);
    expect(grid.views).toBe(5);
    expect(grid.cells.find((c) => c.dow === 3 && c.hour === 10)?.views).toBe(3);
    expect(grid.cells.find((c) => c.dow === 6 && c.hour === 22)?.views).toBe(1);
    const slots = bestPublishSlots(grid.cells);
    expect(slots).toHaveLength(1); // seule case ≥ 3 vues
    expect(slots[0]).toMatchObject({ dow: 3, hour: 10, views: 3 });
    expect(DOW_LABELS[3]).toBe("Jeudi");
  });
});

describe("filtre de période : presets, custom, repli honnête", () => {
  it("bornes correctes pour chaque preset", () => {
    const t = resolvePeriodRange("today");
    expect(t.from.getTime()).toBeLessThanOrEqual(t.to.getTime());

    const y = resolvePeriodRange("yesterday");
    expect(y.to.getTime() - y.from.getTime()).toBe(24 * 3_600_000 - 1);
    expect(y.to.getTime()).toBeLessThanOrEqual(Date.now());

    const w = resolvePeriodRange("7d");
    expect(w.to.getTime()).toBeLessThanOrEqual(Date.now());
    expect(Date.now() - w.from.getTime()).toBeLessThanOrEqual(7 * 24 * 3_600_000 + 2_000);

    // preset inconnu → repli aujourd'hui (jamais de bornes absurdes)
    const bad = resolvePeriodRange("hack");
    expect(bad.to.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("custom valide : du/au inclusifs (au = fin de journée) ; invalide → aujourd'hui", () => {
    const c = resolvePeriodRange("custom", "2026-11-01", "2026-11-03");
    expect(c.from.toISOString().slice(0, 10)).toBe("2026-11-01");
    expect(c.to.toISOString().slice(0, 10)).toBe("2026-11-03");
    expect(c.to.toISOString().slice(11, 19)).toBe("23:59:59");

    // bornes inversées → refus → repli honnête : aujourd'hui seulement
    const inv = resolvePeriodRange("custom", "2026-11-10", "2026-11-01");
    expect(inv.to.getTime() - inv.from.getTime()).toBeLessThan(24 * 3_600_000);

    // formats illégaux → repli aujourd'hui
    const junk = resolvePeriodRange("custom", "01/11/2026", "2026-11-03");
    expect(junk.to.getTime() - junk.from.getTime()).toBeLessThan(24 * 3_600_000);
  });
});
