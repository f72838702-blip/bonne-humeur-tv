import { describe, expect, it } from "vitest";
import {
  AD_FORMATS,
  AD_PLACEMENT_CODES,
  adStateOf,
  allowedTransitions,
  canTransition,
  campaignPeriodError,
  computedCtr,
  csvEscape,
  fingerprintOf,
  formatConakryReadable,
  isSafeAdUrl,
  isPubliclyDiffused,
  paymentStateOf,
  PAYMENT_STATE_LABELS,
  rotateAds,
  toCampaignRow,
  toCsv,
} from "./ads-core";
import { parseConakryInput } from "@/lib/flash/flash-core";

/** Horloge simulée — aucun appel réel à l'horloge dans le noyau. */
const NOW = "2026-11-05T10:00:00.000Z";

describe("régie — noyau pur", () => {
  it("les 9 emplacements du cahier des charges existent (8 seedés 0025 + footer 0038)", () => {
    expect([...AD_PLACEMENT_CODES]).toEqual([
      "home_top_banner",
      "home_inline",
      "news_feed_inline",
      "article_inline",
      "article_bottom",
      "videos_inline",
      "home_promo_strip",
      "home_partners",
      "footer",
    ]);
  });

  it("les 5 formats de créations existent (logos partenaires = table dédiée)", () => {
    expect([...AD_FORMATS]).toEqual([
      "banner",
      "sponsor_article",
      "video",
      "card",
      "promo_strip",
    ]);
  });

  // ─── État effectif : horloge serveur, périodes exactes ───
  it("une campagne active dans la période est en diffusion", () => {
    expect(
      adStateOf(
        { status: "active", start_at: "2026-11-05T08:00:00Z", end_at: "2026-11-20T20:00:00Z" },
        NOW
      )
    ).toBe("diffusing");
  });

  it("active + début futur = programmée (jamais stockée)", () => {
    expect(
      adStateOf(
        { status: "active", start_at: "2026-11-10T08:00:00Z", end_at: "2026-11-20T20:00:00Z" },
        NOW
      )
    ).toBe("programmed");
  });

  it("une campagne expirée ne diffusera JAMAIS (borne exacte : fin incluse)", () => {
    expect(
      adStateOf(
        { status: "active", start_at: "2026-11-01T00:00:00Z", end_at: NOW },
        NOW
      )
    ).toBe("expired");
    expect(
      adStateOf(
        { status: "active", start_at: "2026-11-01T00:00:00Z", end_at: "2026-11-05T09:59:59.999Z" },
        NOW
      )
    ).toBe("expired");
  });

  it("fail-closed : campagne active sans dates = impossible à diffuser", () => {
    const state = adStateOf({ status: "active", start_at: null, end_at: null }, NOW);
    expect(state).toBe("paused");
    expect(isPubliclyDiffused(state)).toBe(false);
  });

  it("les autres statuts rendent leur état stocké, jamais la diffusion", () => {
    for (const status of ["draft", "pending", "suspended", "completed", "cancelled", "refused"] as const) {
      const state = adStateOf(
        { status, start_at: "2020-01-01T00:00:00Z", end_at: "2030-01-01T00:00:00Z" },
        NOW
      );
      expect(state).toBe(status);
      expect(isPubliclyDiffused(state)).toBe(false);
    }
  });

  // ─── Transitions : machine à états + rôles ───
  it("brouillon → attente → active ; refus/annulation réservés ADMIN", () => {
    expect(canTransition("draft", "pending", "editor")).toBe(true);
    expect(canTransition("pending", "active", "editor")).toBe(true);
    expect(canTransition("pending", "refused", "editor")).toBe(false);
    expect(canTransition("pending", "refused", "admin")).toBe(true);
    expect(canTransition("active", "suspended", "editor")).toBe(true);
    expect(canTransition("suspended", "active", "editor")).toBe(true);
    expect(canTransition("completed", "draft", "admin")).toBe(true);
    expect(canTransition("refused", "draft", "admin")).toBe(true);
    expect(canTransition("draft", "active", "admin")).toBe(false);
    expect(canTransition("draft", "cancelled", "admin")).toBe(false);
  });

  it("l'éditeur ne voit jamais les cibles réservées admin", () => {
    const pending = allowedTransitions("pending", "editor");
    expect(pending).toContain("active");
    expect(pending).not.toContain("refused");
  });

  // ─── URLs : open redirect / XSS / protocoles ───
  it("URLs http(s) acceptées", () => {
    expect(isSafeAdUrl("https://exemple.com/offre")).toBe(true);
    expect(isSafeAdUrl("http://exemple.com")).toBe(true);
  });

  it("javascript:, data:, file:, blob: et URL sans hôte refusées", () => {
    expect(isSafeAdUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeAdUrl("data:image/png;base64,AAAA")).toBe(false);
    expect(isSafeAdUrl("file:///etc/passwd")).toBe(false);
    expect(isSafeAdUrl("blob:https://x/y")).toBe(false);
    expect(isSafeAdUrl("ftp://exemple.com")).toBe(false);
    expect(isSafeAdUrl("https://user:pass@exemple.com")).toBe(false);
    expect(isSafeAdUrl("")).toBe(false);
    expect(isSafeAdUrl("exemple.com")).toBe(false); // pas d'URL absolue
    expect(isSafeAdUrl(null)).toBe(false);
    expect(isSafeAdUrl(42)).toBe(false);
  });

  // ─── Rotation pondérée : déterministe, jamais monopolisée, poids modulé ───
  it("même fenêtre de temps = même sélection (déterministe)", () => {
    const candidates = [
      { key: "c1", priority: 50, weight: 1 },
      { key: "c2", priority: 50, weight: 1 },
      { key: "c3", priority: 50, weight: 1 },
    ];
    const a = rotateAds(candidates, 1, 1_700_000_000_000);
    const b = rotateAds(candidates, 1, 1_700_000_000_000);
    expect(a.map((c) => c.key)).toEqual(b.map((c) => c.key));
  });

  it("rotation : sur 40 fenêtres successives, chaque candidat apparaît", () => {
    const candidates = [
      { key: "a", priority: 50, weight: 1 },
      { key: "b", priority: 50, weight: 1 },
    ];
    const seen = new Set<string>();
    const start = 1_700_000_000_000;
    for (let i = 0; i < 40; i++) {
      const picked = rotateAds(candidates, 1, start + i * 300_000);
      if (picked[0]) seen.add(picked[0].key);
    }
    expect(seen).toEqual(new Set(["a", "b"]));
  });

  it("une seule candidate est toujours retenue (l'emplacement n'est pas vide)", () => {
    const picked = rotateAds([{ key: "x", priority: 10, weight: 1 }], 3, 1_000);
    expect(picked.map((c) => c.key)).toEqual(["x"]);
  });

  it("rotateAds trie la priorité d'abord : priorité 100 devant 10", () => {
    const picked = rotateAds(
      [
        { key: "faible", priority: 10, weight: 10 },
        { key: "forte", priority: 100, weight: 1 },
      ],
      1,
      1_700_000_000_000
    );
    expect(picked[0].key).toBe("forte");
  });

  it("poids 0 est traité comme 1 (jamais 0 créations d'un emplacement)", () => {
    const picked = rotateAds(
      [{ key: "w0", priority: 50, weight: 0 }, { key: "w1", priority: 50, weight: 1 }],
      2,
      1_700_000_000_000
    );
    expect(picked.map((c) => c.key)).toContain("w0");
  });

  // ─── CTR : formule exacte du cahier des charges ───
  it("CTR = clics / impressions × 100 (arrondi 1 décimale)", () => {
    expect(computedCtr(5, 100)).toBe(5);
    expect(computedCtr(1, 3)).toBe(33.3);
    expect(computedCtr(0, 0)).toBe(null);
    expect(computedCtr(0, 500)).toBe(0);
  });

  // ─── Règlements : forfaits uniquement ───
  it("paiement : non payé / partiel / payé / retard", () => {
    const late = paymentStateOf({
      amount: 500000,
      paidSum: 0,
      contract_end_at: "2026-10-01T00:00:00Z",
      nowIso: NOW,
    });
    expect(late).toBe("late");
    expect(paymentStateOf({ amount: 500000, paidSum: 0, contract_end_at: null, nowIso: NOW })).toBe("unpaid");
    expect(
      paymentStateOf({
        amount: 500000,
        paidSum: 200000,
        contract_end_at: "2027-01-01T00:00:00Z",
        nowIso: NOW,
      })
    ).toBe("partial");
    expect(
      paymentStateOf({
        amount: 500000,
        paidSum: 500000,
        contract_end_at: "2026-10-01T00:00:00Z",
        nowIso: NOW,
      })
    ).toBe("paid");
    expect(Object.keys(PAYMENT_STATE_LABELS)).toHaveLength(4);
  });

  // ─── CSV ───
  it("CSV échappe les virgules, guillemets et retours ligne", () => {
    const csv = toCsv(["campagne", "montant", "note"], [
      ["Campagne «, » a", 150000, "ligne1\nligne2"],
      ["B", 50000, 'ok "guillemets"'],
    ]);
    expect(csv).toContain('"Campagne «, » a"');
    expect(csv).toContain('"ligne1\nligne2"');
    expect(csv).toContain('"ok ""guillemets"""');
    expect(csv.split("\r\n").length).toBeGreaterThanOrEqual(3);
  });

  it("empreinte journalière : sans IP brute, bornée", () => {
    const fp = fingerprintOf(["e3b0c44298fc1c149afbf4c8996fb92427ae41e4", "ua-hash", "c1", "2026-11-05"]);
    expect(fp).not.toContain(" ");
    expect(fp.length).toBeLessThanOrEqual(200);
  });

  // ─── Période de campagne (les 4 cas de la direction) ───
  it("formatConakryReadable rend « jj/mm/aaaa à hh:mm »", () => {
    expect(formatConakryReadable("2026-11-04T10:00:00.000Z")).toBe("04/11/2026 à 10:00");
    expect(formatConakryReadable("2026-11-05T00:01:00.000Z")).toBe("05/11/2026 à 00:01");
    expect(formatConakryReadable("pas-iso")).toBe("pas-iso");
  });

  it("période : fin 12:00 > début 10:00 accepté", () => {
    expect(campaignPeriodError("2026-11-04T10:00:00.000Z", "2026-11-04T12:00:00.000Z")).toBeNull();
  });

  it("période : fin = début + 24 h acceptée", () => {
    expect(campaignPeriodError("2026-11-04T10:00:00.000Z", "2026-11-05T10:00:00.000Z")).toBeNull();
  });

  it("période : dates égales refusées avec message AFFICHANT les deux timestamps", () => {
    const err = campaignPeriodError("2026-11-04T10:00:00.000Z", "2026-11-04T10:00:00.000Z");
    expect(err).toContain("04/11/2026 à 10:00");
    expect(err?.match(/04\/11\/2026 à 10:00/g)).toHaveLength(2);
    expect(err).toContain("l'heure");
  });

  it("période : fin avant début refusée avec message précis", () => {
    const err = campaignPeriodError("2026-11-04T12:00:00.000Z", "2026-11-04T10:00:00.000Z");
    expect(err).toContain("04/11/2026 à 10:00");
    expect(err).toContain("04/11/2026 à 12:00");
  });

  it("période : passage de minuit et secondes parasites acceptés", () => {
    expect(campaignPeriodError("2026-11-04T23:59:00.000Z", "2026-11-05T00:01:00.000Z")).toBeNull();
  });

  it("période : champ manquant (début OU fin absent) = période facultative, jamais erreur", () => {
    expect(campaignPeriodError(null, "2026-11-05T10:00:00.000Z")).toBeNull();
    expect(campaignPeriodError("2026-11-04T10:00:00.000Z", null)).toBeNull();
    expect(campaignPeriodError(null, null)).toBeNull();
  });

  it("période : valeurs illisibles = message de reformulation", () => {
    expect(campaignPeriodError("n'importe quoi", "2026-11-05T10:00:00.000Z")).toContain("illisible");
    expect(campaignPeriodError("n'importe quoi", "n'importe quoi aussi")).toContain("illisible");
  });

  // ─── Conversions Conakry (UTC+0, une seule normalisation) ───
  it("parseConakryInput : datetime-local → ISO UTC, une seule fois", () => {
    expect(parseConakryInput("2026-11-04T10:00")).toBe("2026-11-04T10:00:00.000Z");
    expect(parseConakryInput("2026-11-04T10:00:30")).toBe("2026-11-04T10:00:00.000Z");
    expect(parseConakryInput(" 2026-11-04T10:00 ")).toBe("2026-11-04T10:00:00.000Z");
    expect(parseConakryInput("2026-11-4T10:00")).toBeNull();
    expect(parseConakryInput("04/11/2026 10:00")).toBeNull();
    expect(parseConakryInput("")).toBeNull();
  });

  // ─── Liste blanche du row de campagne (colonne fantôme `placements`) ───
  it("toCampaignRow garde chaque colonne RÉELLE de ad_campaigns (0025)", () => {
    const row = toCampaignRow({
      advertiser_id: "a-uuid",
      name: "Campagne",
      reference: "BHTV-2026-ABC123",
      start_at: "2026-11-04T10:00:00.000Z",
      end_at: "2026-11-05T10:00:00.000Z",
      billing_type: "forfait",
      amount: 500000,
      currency: "GNF",
      priority: 50,
      status: "draft",
      created_by: "u-uuid",
    });
    expect(Object.keys(row).sort()).toEqual([
      "advertiser_id", "amount", "billing_type", "created_by", "currency",
      "end_at", "name", "priority", "reference", "start_at", "status",
    ]);
  });

  it("toCampaignRow JAMAIS la colonne fantôme `placements` ni id/created_at/updated_at", () => {
    const row = toCampaignRow({
      id: "c-uuid",
      placements: ["home_top_banner"],
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      reference: "BHTV-2026-X",
    });
    expect(row.placements).toBeUndefined();
    expect(row.id).toBeUndefined();
    expect(row.created_at).toBeUndefined();
    expect(row.updated_at).toBeUndefined();
    expect(row).toEqual({ reference: "BHTV-2026-X" });
  });

  it("toCampaignRow : colonnes contrat conservées quand le formulaire les apporte", () => {
    const row = toCampaignRow({ contract_signed_at: "2026-11-01", contract_terms: "régie manuelle" });
    expect(row).toEqual({ contract_signed_at: "2026-11-01", contract_terms: "régie manuelle" });
  });

  it("csvEscape neutralise les préfixes de FORMULE (audit M4 : = + @ tab)", () => {
    expect(csvEscape("=HYPERLINK(...)")).toBe(" =HYPERLINK(...)");
    // contient « , » → guillemets d'échappement, espace de neutralisation conservé
    expect(csvEscape("=HYPERLINK('http://x','cliquez')")).toBe('" =HYPERLINK(\'http://x\',\'cliquez\')"');
    expect(csvEscape("+1+cmd")).toBe(" +1+cmd");
    expect(csvEscape("@SUM(1)")).toBe(" @SUM(1)");
    expect(csvEscape("\t=cmd")).toBe(" \t=cmd");
  });

  it("csvEscape préserve les montants négatifs et les valeurs normales", () => {
    expect(csvEscape("-12 000 GNF")).toBe("-12 000 GNF");
    expect(csvEscape("Mariama Sy")).toBe("Mariama Sy");
    expect(csvEscape("150")).toBe("150");
  });
});