import { describe, expect, it } from "vitest";
import {
  countUnreadContacts,
  countUnseenPartnerships,
  idsToMarkRead,
  idsToMarkSeen,
} from "@/lib/requests-core";
import type { ContactMessage, PartnershipRequest } from "@/lib/types";

/** Scénarios §7 de la mission « onglet Demandes » — noyau pur. */

function partnership(p: Partial<PartnershipRequest>): PartnershipRequest {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    created_at: "2026-11-04T10:00:00Z",
    contact_name: "Contact",
    organisation: "Organisation",
    fonction: null,
    email: "c@exemple.gn",
    phone: null,
    service: "couverture",
    message: "Message",
    budget: null,
    timeline: null,
    status: "new",
    admin_note: null,
    processed_at: null,
    seen_at: p.seen_at ?? null,
    ...p,
  } as PartnershipRequest;
}

function contact(c: Partial<ContactMessage>): ContactMessage {
  return {
    id: "00000000-0000-4000-8000-000000000002",
    created_at: "2026-11-04T10:00:00Z",
    name: "Nouveau message",
    email: "n@exemple.gn",
    phone: null,
    subject: "Sujet",
    message: "Contenu du message du visiteur.",
    status: "new",
    admin_note: null,
    processed_at: null,
    read_at: c.read_at ?? null,
    ...c,
  } as ContactMessage;
}

describe("notifications utiles — jamais répétitives", () => {
  it("scénario 1 : un NOUVEAU partenariat (seen_at NULL) = 1 notification", () => {
    expect(countUnseenPartnerships([partnership({})])).toBe(1);
  });

  it("scénario 2 : la demande consultée (seen_at posé) n'est PLUS comptée", () => {
    const list = [
      partnership({ id: "00000000-0000-4000-8000-00000000000a" }),
      partnership({
        id: "00000000-0000-4000-8000-00000000000b",
        seen_at: "2026-11-04T10:05:00Z",
      }),
    ];
    expect(countUnseenPartnerships(list)).toBe(1);
  });

  it("scénario 2bis : TOUTES consultées → 0 notification (ni à l'actualisation ni à la reconnexion)", () => {
    const list = [
      partnership({ id: "00000000-0000-4000-8000-00000000000a", seen_at: "2026-11-04T10:05:00Z" }),
      partnership({ id: "00000000-0000-4000-8000-00000000000b", seen_at: "2026-11-04T10:06:00Z" }),
    ];
    expect(countUnseenPartnerships(list)).toBe(0);
  });

  it("scénario 3 : nouveau message = compteur non lu 1 ; scénario 4 : lu = compteur 0", () => {
    const list = [
      contact({ id: "00000000-0000-4000-8000-00000000000a" }),
      contact({ id: "00000000-0000-4000-8000-00000000000b", read_at: "2026-11-04T10:06:00Z" }),
    ];
    expect(countUnreadContacts(list)).toBe(1);
    expect(countUnreadContacts([contact({ read_at: "2026-11-04T11:00:00Z" })])).toBe(0);
  });

  it("les ANCIENNES demandes déjà consultées ne re-notifient jamais (état persistant)", () => {
    const anciennesPartenariats = [
      partnership({ id: "00000000-0000-4000-8000-00000000000a", seen_at: "2026-10-20T08:00:00Z", status: "treated" }),
    ];
    const anciensMessages = [
      contact({ id: "00000000-0000-4000-8000-00000000000b", read_at: "2026-10-20T08:00:00Z", status: "treated" }),
    ];
    expect(countUnseenPartnerships(anciennesPartenariats)).toBe(0);
    expect(countUnreadContacts(anciensMessages)).toBe(0);
  });
});

describe("marquage au rendu — uniquement les jamais consultés", () => {
  it("idsToMarkSeen : seuls les seen_at NULL sont envoyés à la base", () => {
    const a = "00000000-0000-4000-8000-00000000000a";
    const b = "00000000-0000-4000-8000-00000000000b";
    const ids = idsToMarkSeen([
      partnership({ id: a }),
      partnership({ id: b, seen_at: "2026-11-04T10:05:00Z" }),
    ]);
    expect(ids).toEqual([a]); // l'élément déjà vu n'est JAMAIS réécrit
  });

  it("idsToMarkRead : seuls les read_at NULL — aucun horodatage écrasé", () => {
    const a = "00000000-0000-4000-8000-00000000000a";
    const b = "00000000-0000-4000-8000-00000000000b";
    const ids = idsToMarkRead([
      contact({ id: a }),
      contact({ id: b, read_at: "2026-11-04T10:05:00Z" }),
    ]);
    expect(ids).toEqual([a]);
  });

  it("rien de neuf → liste vide → AUCUNE requête d'écriture", () => {
    expect(idsToMarkSeen([partnership({ seen_at: "2026-11-04T10:05:00Z" })])).toEqual([]);
    expect(idsToMarkRead([contact({ read_at: "2026-11-04T10:05:00Z" })])).toEqual([]);
  });
});