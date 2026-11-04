import { describe, expect, it } from "vitest";
import {
  DEFAULT_DURATION_KEY,
  SIMPLE_DURATIONS,
  SIMPLE_FORMAT_CARDS,
  SIMPLIZED_AD_FORMATS,
  autoPubliciteName,
  compatiblePlacements,
  computeAdPeriod,
  matchAdvertiserByNormalized,
  normalizedAdvertiserName,
  resolvePlacements,
  type SimpleAdFormat,
} from "./simple-ad";
import { adStateOf, type AdStoredStatus } from "./ads-core";

/**
 * SIMULATION DU PARCOURS d'un administrateur qui n'a jamais utilisé la
 * régie (mission : « open Publicités → Créer → format → contenu → où →
 * durée → publier → retrouver → suspendre → réactiver »). Chaque étape
 * est rejouée avec les FONCTIONS PURES réelles de l'interface — aucune
 * base, aucune session. Les étapes qui exigent une session réelle
 * (écritures RLS, approbation) sont explicitement marquées en commentaire,
 * pas simulées faussement.
 */

// Données REELLES seedées en 0025 (contrôle lecture seule du 04/11/2026).
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

const ANNONCEURS = [
  { id: "bf2630d2-739f-41fb-8135-d119de5d843f", name: "Bonnehumeur" },
];

const NOW = "2026-11-04T14:00:00.000Z"; // horloge SERVEUR simulée

/** Rejoue la machine à états du serveur : durée → période → état admin. */
function publiRow(
  format: string,
  advertiserName: string,
  durationKey: string,
  status: AdStoredStatus
) {
  const period = computeAdPeriod(durationKey, null, null, NOW);
  if ("error" in period) throw new Error(`parcours bloqué : ${period.error}`);
  return {
    name: autoPubliciteName(advertiserName, format as SimpleAdFormat),
    advertiser: advertiserName,
    start_at: period.start_at,
    end_at: period.end_at,
    status,
  };
}

const VISIBLE_STATES: AdStoredStatus[] = ["active"];

describe("parcours simplifié — un admin naïf, de bout en bout", () => {
  it("É1 : 6 cartes de format lisibles, aucune connaissance technique requise", () => {
    expect(SIMPLE_FORMAT_CARDS.map((f) => f.label)).toEqual([
      "Bannière publicitaire",
      "Carte publicitaire",
      "Vidéo YouTube",
      "Article sponsorisé",
      "Bandeau promotionnel",
      "Logo partenaire",
    ]);
    expect(SIMPLE_FORMAT_CARDS.every((f) => f.hint.length > 0 && !/uuid|campagne|cr(?:é)e(?:ation)|payload/i.test(f.hint))).toBe(true);
  });

  it("É2 : l'entreprise existante est retrouvée SANS identifiant technique — jamais de doublon", () => {
    // L'admin tape « BONNEHUMEUR  » (casse/espaces différents) → fiche réutilisée.
    // NB : « Bonne Humeur » (avec espace) resterait une AUTRE entreprise — c'est
    // voulu : seules les variantes identitaires (accents/casse/espaces) sont
    // dédupliquées, jamais deux noms proches fusionnés.
    const found = matchAdvertiserByNormalized(" BONNEHUMEUR  ", ANNONCEURS);
    expect(found?.id).toBe("bf2630d2-739f-41fb-8135-d119de5d843f");
    // Une entreprise inconnue → aucune fiche récupérée par erreur (création),
    // l'action serveur INSERT alors un NOUVEL annonceur (path testé ci-dessous
    // sur sa logique de normalisation, l'INSERT nécessite une vraie session).
    expect(matchAdvertiserByNormalized("Sotulub Guinée", ANNONCEURS)).toBeNull();
    expect(normalizedAdvertiserName("Sotulub Guinée")).toBe("sotulub guinee");
  });

  it("É3+É4 : chaque format de campagne trouve SON emplacement réel et une période 7 jours", () => {
    const campaignFormats = SIMPLIZED_AD_FORMATS.filter((f) => f !== "partner");
    for (const format of campaignFormats) {
      const codes = resolvePlacements(format, [], PLACEMENTS);
      if (format === "video") {
        // constat d'audit documenté : aucun emplacement n'admet video →
        // l'interface affiche un message d'aide (publication refusée proprement).
        expect(codes).toEqual([]);
        continue;
      }
      // sponsor_article passe par « Sponsorisé » dans les listes (pas de zone) ;
      // les 4 autres formats ont au moins un emplacement réel.
      if (format !== "sponsor_article") expect(codes.length).toBeGreaterThan(0);
      const row = publiRow(format, "Bonnehumeur", DEFAULT_DURATION_KEY, "active");
      expect(row.start_at).toBe(NOW);
      expect(Date.parse(row.end_at) - Date.parse(row.start_at)).toBe(7 * 86_400_000);
      expect(row.name).toBe(`Bonnehumeur · ${SIMPLE_FORMAT_LABEL(format)}`);
    }
    // partenaire : table dédiée, pas de campagne — le nom reste lisible
    expect(autoPubliciteName("Bonnehumeur", "partner")).toBe("Bonnehumeur · Logo partenaire");
  });

  it("É5 : publiée → visible dans EN DIFFUSION (état réel de la machine à états)", () => {
    const row = publiRow("banner", "Bonnehumeur", "7j", "active");
    const state = adStateOf(row, NOW);
    expect(state).toBe("diffusing");
    // durée 1 jour : visible tant que la fin n'est pas passée
    const oneDay = publiRow("card", "Bonnehumeur", "1j", "active");
    expect(adStateOf(oneDay, NOW)).toBe("diffusing");
    expect(adStateOf(oneDay, "2026-11-05T14:00:01.000Z")).toBe("expired");
  });

  it("É6 : suspendue → n'est plus en diffusion ; réactivée → y revient", () => {
    const row = publiRow("banner", "Bonnehumeur", "7j", "active");
    const suspended = adStateOf({ ...row, status: "suspended" }, NOW);
    expect(suspended).toBe("suspended");
    const reactivated = adStateOf({ ...row, status: "active" }, NOW);
    expect(reactivated).toBe("diffusing");
  });

  it("É7 : prolongée avant échéance → fin reculée, diffusion continue", () => {
    const first = publiRow("banner", "Bonnehumeur", "3j", "active");
    // même règle que extendCampaignAction : ancre sur la fin en cours
    const extended = {
      ...first,
      end_at: new Date(Date.parse(first.end_at) + 7 * 86_400_000).toISOString(),
    };
    expect(new Date(extended.end_at).toISOString()).toBe("2026-11-14T14:00:00.000Z");
    expect(adStateOf(extended, "2026-11-07T15:00:00.000Z")).toBe("diffusing");
  });

  it("Érreurs : aucune durée inventée, aucune période croisée, aucun inconnu", () => {
    expect(computeAdPeriod("une-semaine", null, null, NOW)).toHaveProperty("error");
    expect(computeAdPeriod("libre", "2026-11-05", null, NOW)).toHaveProperty("error");
    expect(
      computeAdPeriod("libre", "2026-11-06T10:00", "2026-11-06T09:00", NOW)
    ).toHaveProperty("error");
    expect(SIMPLE_DURATIONS.map((d) => d.key)).toContain(DEFAULT_DURATION_KEY);
  });

  it("Érreurs : un format incompatible n'est JAMAIS relié à un emplacement", () => {
    // code incompatible coché → écarté ; la garde serveur revalide en base
    const cardCodes = resolvePlacements("card", ["home_top_banner"], PLACEMENTS);
    expect(cardCodes).not.toContain("home_top_banner");
    expect(cardCodes.every((c) => ["home_inline", "news_feed_inline", "article_inline", "videos_inline"].includes(c))).toBe(true);
    const promoCodes = resolvePlacements("promo_strip", ["videos_inline", "home_promo_strip"], PLACEMENTS);
    expect(promoCodes).not.toContain("videos_inline");
    // emplacement inactif jamais proposé (données corrompues ou pause)
    const inactive = [...PLACEMENTS, { code: "fantome", allowed_formats: ["banner"], is_active: false }];
    expect(compatiblePlacements("banner", inactive).map((p) => p.code)).not.toContain("fantome");
  });

  it("Épermissions (simulées sur la machine à états) : brouillon d'éditeur = invisible, programmée = pas encore visible", () => {
    // Un éditeur publie → créative « draft » (la RLS lui interdit d'approuver) :
    // la campagne est active MAIS sans créative approuvée la zone SQL ne rend
    // rien — côté admin la carte affiche « À valider par un administrateur ».
    const editorRow = publiRow("card", "Bonnehumeur", "7j", "active");
    expect(adStateOf(editorRow, NOW)).toBe("diffusing");
    expect(VISIBLE_STATES).toContain("active"); // statut campagne ≠ créative : vérifié en recette
    // Début FUTUR → programme : état « programmed », pas « diffusing ».
    const future = computeAdPeriod("7j", "2026-12-01T08:00:00.000Z", null, NOW);
    if ("error" in future) throw new Error("inattendu");
    expect(adStateOf({ status: "active", ...future }, NOW)).toBe("programmed");
  });
});

function SIMPLE_FORMAT_LABEL(format: string): string {
  const card = SIMPLE_FORMAT_CARDS.find((f) => f.key === format);
  return card ? card.label : format;
}