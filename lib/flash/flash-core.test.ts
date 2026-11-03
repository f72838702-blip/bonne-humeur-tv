import { describe, expect, it } from "vitest";
import {
  classifyFlash,
  computeExpiry,
  DEFAULT_DURATION_MINUTES,
  DURATION_OPTIONS,
  expiryEvents,
  formatConakryTime,
  humanizeDuration,
  isAllowedDuration,
  parseConakryInput,
  remainingLabel,
} from "@/lib/flash/flash-core";

/** Horloge de référence des tests : réelle publication 14h30 UTC/Conakry. */
const PUBLIE_UTC = "2026-11-04T14:30:00.000Z";
const PUBLIE_PLUS_2H = "2026-11-04T16:30:00.000Z";

describe("DURATION_OPTIONS — menu déroulant", () => {
  it("propose exactement les 10 durées du cahier des charges", () => {
    expect(DURATION_OPTIONS.map((o) => o.minutes)).toEqual([
      15, 30, 45, 60, 120, 180, 360, 480, 720, 1440,
    ]);
    expect(DURATION_OPTIONS.map((o) => o.label)).toEqual([
      "15 minutes",
      "30 minutes",
      "30 minutes".replace("30", "45"),
      "1 heure",
      "2 heures",
      "3 heures",
      "6 heures",
      "8 heures",
      "12 heures",
      "24 heures",
    ]);
  });

  it("la valeur par défaut est 1 heure", () => {
    expect(DEFAULT_DURATION_MINUTES).toBe(60);
  });
});

describe("isAllowedDuration — contrôle serveur (§10 : durées interdites refusées)", () => {
  for (const minutes of [15, 30, 45, 60, 120, 180, 360, 480, 720, 1440]) {
    it(`accepte ${minutes} min`, () => {
      expect(isAllowedDuration(minutes)).toBe(true);
    });
  }
  it("refuse une durée fabriquée dans la requête", () => {
    for (const bad of [0, 10, 17, 90, 60.5, -30, 2000, 1441, "60", null, undefined, NaN]) {
      expect(isAllowedDuration(bad)).toBe(false);
    }
  });
});

describe("computeExpiry — formule date_fin = date_debut + durée (10 durées)", () => {
  it("calcul pour chacune des 10 durées autorisées", () => {
    const attendu: Record<number, string> = {
      15: "2026-11-04T14:45:00.000Z",
      30: "2026-11-04T15:00:00.000Z",
      45: "2026-11-04T15:15:00.000Z",
      60: "2026-11-04T15:30:00.000Z",
      120: "2026-11-04T16:30:00.000Z",
      180: "2026-11-04T17:30:00.000Z",
      360: "2026-11-04T20:30:00.000Z",
      480: "2026-11-04T22:30:00.000Z",
      720: "2026-11-05T02:30:00.000Z",
      1440: "2026-11-05T14:30:00.000Z",
    };
    for (const [minutes, expected] of Object.entries(attendu)) {
      expect(computeExpiry(PUBLIE_UTC, Number(minutes))).toBe(expected);
    }
  });

  it("exemple du cahier des charges : 14h30 + 2 heures = 16h30", () => {
    expect(computeExpiry(PUBLIE_UTC, 120)).toBe(PUBLIE_PLUS_2H);
  });

  it("refuse une durée hors liste et un début non parseable", () => {
    expect(computeExpiry(PUBLIE_UTC, 35)).toBeNull();
    expect(computeExpiry("pas-une-date", 60)).toBeNull();
  });
});

describe("parseConakryInput — saisie « Programmer » interprétée UTC+0", () => {
  it("convertit une saisie Conakry en ISO UTC", () => {
    expect(parseConakryInput("2026-11-05T09:00")).toBe("2026-11-05T09:00:00.000Z");
  });
  it("accepte le format avec secondes (truncation)", () => {
    expect(parseConakryInput("2026-11-05T09:00:17")).toBe("2026-11-05T09:00:00.000Z");
  });
  it("refuse les valeurs malformées", () => {
    for (const bad of ["", "05/11/2026 09:00", "2026-11-05", "T09:00", "2026-13-40T09:00"]) {
      expect(parseConakryInput(bad)).toBeNull();
    }
  });
  it("durée d'un flash programmé part de DÉBUT programmé, pas de l'enregistrement", () => {
    // programmé 09h00, durée 2 h → fin 11h00 (pas 11h30 depuis 09h30 réel)
    const start = parseConakryInput("2026-11-05T09:00");
    expect(start && computeExpiry(start, 120)).toBe("2026-11-05T11:00:00.000Z");
  });
});

describe("classifyFlash — cycle de vie (horloge simulée)", () => {
  const DUREE_2H = PUBLIE_UTC; // début
  const FIN = PUBLIE_PLUS_2H; // fin 2 h plus tard

  it("inactive : brouillon/désactivé jamais public", () => {
    expect(classifyFlash(PUBLIE_UTC, false, null, null)).toBe("inactive");
    expect(classifyFlash(PUBLIE_PLUS_2H, false, DUREE_2H, FIN)).toBe("inactive");
  });
  it("scheduled : actif au début FUTUR — absent du site avant le début", () => {
    expect(classifyFlash(PUBLIE_UTC, true, "2026-11-04T18:00:00.000Z", null)).toBe("scheduled");
  });
  it("active : pendant la période", () => {
    expect(classifyFlash("2026-11-04T15:00:00.000Z", true, DUREE_2H, FIN)).toBe("active");
  });
  it("active_no_expiry : flash historique sans fin (comportement conservé)", () => {
    expect(classifyFlash(PUBLIE_UTC, true, null, null)).toBe("active_no_expiry");
  });
  it("expired : exactement à la seconde de fin et après", () => {
    expect(classifyFlash(FIN, true, DUREE_2H, FIN)).toBe("expired");
    expect(classifyFlash("2026-11-04T23:59:00.000Z", true, DUREE_2H, FIN)).toBe("expired");
  });
  it("limite exacte : la dernière milliseconde AVANT la fin est 'active'", () => {
    expect(classifyFlash("2026-11-04T16:29:59.999Z", true, DUREE_2H, FIN)).toBe("active");
  });
});

describe("formatConakryTime / formatConakryDateTime (UTC+0)", () => {
  it("affiche l'heure de Conakry attendue par le cahier des charges", () => {
    expect(formatConakryTime(PUBLIE_PLUS_2H)).toBe("16h30");
    expect(formatConakryTime(PUBLIE_UTC)).toBe("14h30");
  });
  it("retourne null pour une date invalide", () => {
    expect(formatConakryTime("invalide")).toBeNull();
  });
});

describe("remainingLabel — compte à rebours", () => {
  it("formats clairs", () => {
    expect(remainingLabel(PUBLIE_UTC, PUBLIE_PLUS_2H)).toBe("2 h restantes");
    expect(
      remainingLabel(PUBLIE_UTC, "2026-11-04T16:02:00.000Z")
    ).toBe("1 h 32 min restantes");
    expect(remainingLabel(PUBLIE_UTC, "2026-11-04T14:31:00.000Z")).toBe("1 min restante");
  });
  it("pas de compte à rebours négatif", () => {
    expect(remainingLabel(PUBLIE_PLUS_2H, PUBLIE_UTC)).toBeNull();
  });
});

describe("humanizeDuration — libellés du sélecteur et prévisualisation", () => {
  it("libellés français", () => {
    expect(humanizeDuration(45)).toBe("45 minutes");
    expect(humanizeDuration(60)).toBe("1 heure");
    expect(humanizeDuration(120)).toBe("2 heures");
    expect(humanizeDuration(1440)).toBe("24 heures");
  });
});

describe("expiryEvents — retrait côté navigateur (§8, zéro polling)", () => {
  const ITEMS = [
    { id: "a", end_at: PUBLIE_PLUS_2H },
    { id: "b", end_at: null }, // historique : jamais retiré
    { id: "c", end_at: "2026-11-10T00:00:00.000Z" },
  ];
  it("programme un retrait par flash à fin définie", () => {
    const now = Date.parse(PUBLIE_UTC);
    const events = expiryEvents(ITEMS, now);
    expect(events).toEqual([
      { id: "a", delayMs: 2 * 3_600_000 },
      { id: "c", delayMs: expect.any(Number) },
    ]);
    expect(events[1].delayMs).toBeLessThanOrEqual(2_147_483_647);
  });
  it("fin déjà passée → délai 0 (retrait immédiat au montage)", () => {
    const now = Date.parse("2026-11-04T17:00:00.000Z");
    expect(expiryEvents(ITEMS, now)).toContainEqual({ id: "a", delayMs: 0 });
  });
  it("échéance au-delà de la limite du setTimeout → non programmée (re-vérifiée par le serveur)", () => {
    const far = [{ id: "far", end_at: new Date(Date.parse(PUBLIE_UTC) + 3 * 365 * 86_400_000).toISOString() }];
    expect(expiryEvents(far, Date.parse(PUBLIE_UTC))).toEqual([]);
  });
});