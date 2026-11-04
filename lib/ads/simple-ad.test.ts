import { describe, expect, it } from "vitest";
import {
  DEFAULT_DURATION_KEY,
  SIMPLE_DURATIONS,
  SIMPLIZED_AD_FORMATS,
  autoPubliciteName,
  compatiblePlacements,
  computeAdPeriod,
  durationOf,
  extendPeriod,
  matchAdvertiserByNormalized,
  normalizedAdvertiserName,
  resolvePlacements,
} from "./simple-ad";

/**
 * Tests du noyau de l'interface simplifiée — horloge simulée, aucune base.
 * La compatibilité des emplacements ci-dessous reflète les DONNÉES réelles
 * seedées en 0025 (contrôle lecture seule du 04/11/2026) : c'est un
 * échantillon, l'action serveur lit toujours la table réelle.
 */
const PLACEMENTS = [
  { code: "home_top_banner", allowed_formats: ["banner", "promo_strip"], is_active: true },
  { code: "home_inline", allowed_formats: ["card"], is_active: true },
  { code: "news_feed_inline", allowed_formats: ["card"], is_active: true },
  { code: "article_inline", allowed_formats: ["card", "banner"], is_active: true },
  { code: "article_bottom", allowed_formats: ["banner"], is_active: true },
  { code: "videos_inline", allowed_formats: ["card"], is_active: true },
  { code: "home_promo_strip", allowed_formats: ["promo_strip"], is_active: true },
  { code: "home_partners", allowed_formats: ["banner"], is_active: true },
];

const NOW = "2026-11-04T14:00:00.000Z";

describe("interface simplifiée — durées", () => {
  it("8 durées proposées, 7 jours par défaut, « libre » sans heures", () => {
    expect(SIMPLE_DURATIONS).toHaveLength(8);
    expect(DEFAULT_DURATION_KEY).toBe("7j");
    expect(durationOf("7j")?.hours).toBe(168);
    expect(durationOf("libre")?.hours).toBeNull();
    expect(durationOf("inconnue")).toBeNull();
  });

  it("7 jours : début = maintenant (horloge SERVEUR), fin = +168 h exactes", () => {
    const p = computeAdPeriod("7j", null, null, NOW);
    expect(p).toEqual({ start_at: NOW, end_at: "2026-11-11T14:00:00.000Z" });
  });

  it("24 heures : fin = +24 h ; 90 jours = +2160 h", () => {
    expect(computeAdPeriod("24h", null, null, NOW)).toEqual({
      start_at: NOW, end_at: "2026-11-05T14:00:00.000Z",
    });
    expect(computeAdPeriod("90j", null, null, NOW)).toEqual({
      start_at: NOW, end_at: "2027-02-02T14:00:00.000Z",
    });
  });

  it("durée préréglée + début personnalisé FUTUR = programmée (fin = début + durée)", () => {
    const p = computeAdPeriod("3j", "2026-12-01T08:00:00.000Z", null, NOW);
    expect(p).toEqual({
      start_at: "2026-12-01T08:00:00.000Z",
      end_at: "2026-12-04T08:00:00.000Z",
    });
  });

  it("durée personnalisée sans date = refusée ; dates croisées = refusées", () => {
    expect(computeAdPeriod("libre", null, null, NOW)).toHaveProperty("error");
    expect(computeAdPeriod("libre", "2026-11-05T10:00", null, NOW)).toHaveProperty("error");
    const crossed = computeAdPeriod("libre", "2026-11-05T10:00", "2026-11-05T09:00", NOW);
    expect(crossed).toHaveProperty("error");
  });

  it("durée personnalisée cohérente → ISO UTC canonique", () => {
    const p = computeAdPeriod("libre", "2026-11-05T10:00", "2026-11-06T10:00", NOW);
    expect(p).toEqual({ start_at: "2026-11-05T10:00:00.000Z", end_at: "2026-11-06T10:00:00.000Z" });
  });

  it("durée inconnue → erreur explicite (jamais de période inventée)", () => {
    expect(computeAdPeriod("100%", null, null, NOW)).toHaveProperty("error");
  });
});

describe("interface simplifiée — compatibilité format ↔ emplacements", () => {
  it("bannière → 2 emplacements SEULS compatibles (données réelles)", () => {
    expect(compatiblePlacements("banner", PLACEMENTS).map((p) => p.code)).toEqual([
      "home_top_banner", "article_inline", "article_bottom", "home_partners",
    ]);
  });

  it("promo_strip → bannière haute + bandeau promo", () => {
    expect(compatiblePlacements("promo_strip", PLACEMENTS).map((p) => p.code)).toEqual([
      "home_top_banner", "home_promo_strip",
    ]);
  });

  it("vidéo format : AUCUN emplacement compatible aujourd'hui (constat d'audit documenté)", () => {
    expect(compatiblePlacements("video", PLACEMENTS)).toEqual([]);
  });

  it("resolvePlacements : cochés hors compatibilité rejetés, défaut = tout le compatible", () => {
    expect(resolvePlacements("banner", ["home_top_banner", "videos_inline"], PLACEMENTS)).toEqual(["home_top_banner"]);
    expect(resolvePlacements("promo_strip", [], PLACEMENTS)).toEqual(["home_top_banner", "home_promo_strip"]);
    expect(resolvePlacements("video", ["videos_inline"], PLACEMENTS)).toEqual([]);
  });

  it("emplacement inactif JAMAIS proposé", () => {
    const withInactive = [
      { code: "x", allowed_formats: ["banner"], is_active: false },
      ...PLACEMENTS,
    ];
    expect(compatiblePlacements("banner", withInactive).map((p) => p.code)).not.toContain("x");
  });

  it("les 6 cartes simplifiées : 5 formats campagne + partenaire séparé", () => {
    expect(SIMPLIZED_AD_FORMATS).toEqual(["banner", "card", "video", "sponsor_article", "promo_strip", "partner"]);
  });
});

describe("interface simplifiée — annonceur sans doublon", () => {
  const list = [
    { id: "1", name: "Bonnehumeur" },
    { id: "2", name: "Société Kaloum & Fils" },
    { id: "3", name: "Épicerie Bellevue" },
  ];

  it("nom normalisé : accents, casse et espaces ignorés", () => {
    expect(normalizedAdvertiserName("  Épicerie   BELLEVUE ")).toBe("epicerie bellevue");
  });

  it("saisie proche identitaire → fiche existante RÉUTILISÉE (zéro doublon)", () => {
    expect(matchAdvertiserByNormalized("bonneHUMEUR", list)?.id).toBe("1");
    expect(matchAdvertiserByNormalized("Épicerie bellevue", list)?.id).toBe("3");
  });

  it("nom PROCHE mais différent → AUCUNE fusion (nouvel annonceur)", () => {
    expect(matchAdvertiserByNormalized("Bonnehumeur TV", list)).toBeNull();
    expect(matchAdvertiserByNormalized("Bonnehumeurs", list)).toBeNull();
  });

  it("liste vide ou nom vide → null (jamais de crash)", () => {
    expect(matchAdvertiserByNormalized("x", [])).toBeNull();
    expect(matchAdvertiserByNormalized("", list)).toBeNull();
  });
});

describe("interface simplifiée — prolongation", () => {
  it("diffusion en cours : la fin recule de N jours, le début reste", () => {
    const ext = extendPeriod({ start_at: "2026-11-01T08:00", end_at: "2026-11-11T08:00" }, 7, NOW);
    expect(ext.end_at).toBe("2026-11-18T08:00:00.000Z");
    expect(ext.start_at).toBe("2026-11-01T08:00");
  });

  it("expirée : repart DE MAINTENANT (jamais de fin dans le passé)", () => {
    const ext = extendPeriod({ start_at: "2026-10-01T08:00", end_at: "2026-10-10T08:00" }, 3, NOW);
    expect(ext.end_at).toBe("2026-11-07T14:00:00.000Z");
  });

  it("campagne sans fin : ancrée sur maintenant", () => {
    expect(extendPeriod({ start_at: null, end_at: null }, 1, NOW).end_at).toBe("2026-11-05T14:00:00.000Z");
  });
});

describe("interface simplifiée — nom automatique", () => {
  it("« Entreprise · Format » quand l'admin n'invente rien", () => {
    expect(autoPubliciteName("Bonnehumeur", "banner")).toBe("Bonnehumeur · Bannière publicitaire");
    expect(autoPubliciteName("Sotulub", "partner")).toBe("Sotulub · Logo partenaire");
  });
});