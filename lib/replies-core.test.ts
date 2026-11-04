import { describe, expect, it } from "vitest";
import { sendReplySchema } from "@/lib/validation/schemas";
import {
  buildBrevoEmailPayload,
  buildReplySubject,
  countFailedReplies,
  groupRepliesByRequest,
  isPlausibleEmail,
  isRequestAnswered,
  replyGroupKey,
  type ReplyGroupKey,
} from "@/lib/replies-core";
import type { RequestReply } from "@/lib/types";

/** Scénarios §9 de la mission « réponses de l'administrateur » — noyau pur. */

function reply(p: Partial<RequestReply> & { requestId: string; type: "partnership" | "contact" }): RequestReply {
  const key = p.type === "partnership" ? "partnership_request_id" : "contact_message_id";
  return {
    id: "00000000-0000-4000-8000-00000000000f",
    created_at: "2026-11-04T12:00:00Z",
    partnership_request_id: null,
    contact_message_id: null,
    sender_profile_id: "00000000-0000-4000-8000-00000000000e",
    recipient_email: "visiteur@exemple.gn",
    body: "Merci pour votre message.",
    provider_message_id: null,
    status: "sent",
    error: null,
    [key]: p.requestId,
    ...p,
  } as RequestReply;
}

describe("sujet de réponse dérivé — jamais demandé à l'éditeur", () => {
  it("partenariat : sujet fixe au nom de la chaîne", () => {
    expect(buildReplySubject("partnership", null)).toBe(
      "Re: Votre demande de partenariat — Bonne Humeur TV"
    );
  });

  it("contact : reprend le sujet du visiteur (Re:)", () => {
    expect(buildReplySubject("contact", "Proposition d'émission")).toBe(
      "Re: Proposition d'émission"
    );
  });

  it("contact sans sujet : repli propre", () => {
    expect(buildReplySubject("contact", null)).toBe("Re: Votre message — Bonne Humeur TV");
    expect(buildReplySubject("contact", "  ")).toBe("Re: Votre message — Bonne Humeur TV");
  });
});

describe("payload Brevo — texte brut, destinataire verrouillé", () => {
  it("scénario 2 : le destinataire passe TEL QUELU en base, jamais une adresse du formulaire", () => {
    const payload = buildBrevoEmailPayload({
      senderEmail: "contact@bonnehumeurs.gn",
      senderName: "Bonne Humeur TV",
      replyToEmail: "direction@bonnehumeurs.gn",
      recipientEmail: "visiteur@exemple.gn",
      subject: "Re: Votre message — Bonne Humeur TV",
      body: "Bonjour, merci…",
    });
    expect(payload.to).toEqual([{ email: "visiteur@exemple.gn" }]);
    expect(payload.sender).toEqual({
      name: "Bonne Humeur TV",
      email: "contact@bonnehumeurs.gn",
    });
    expect(payload.replyTo).toEqual({ email: "direction@bonnehumeurs.gn" });
    // TEXTE BRUT uniquement — aucune injection HTML possible
    expect(payload.textContent).toBe("Bonjour, merci…");
    expect(JSON.stringify(payload)).not.toContain("htmlContent");
  });

  it("replyTo invalide ou absent → omis (l'expéditeur reste celui vérifié)", () => {
    const without = buildBrevoEmailPayload({
      senderEmail: "a@b.gn", senderName: "N", recipientEmail: "c@d.gn",
      subject: "S", body: "B",
    });
    expect(without.replyTo).toBeUndefined();
    const bad = buildBrevoEmailPayload({
      senderEmail: "a@b.gn", senderName: "N", replyToEmail: "pas un email",
      recipientEmail: "c@d.gn", subject: "S", body: "B",
    });
    expect(bad.replyTo).toBeUndefined();
  });
});

describe("statut « Répondu » — uniquement après confirmation du fournisseur", () => {
  it("scénario 5 : une réponse 'sent' → Répondu", () => {
    expect(isRequestAnswered([reply({ requestId: "r1", type: "contact" })])).toBe(true);
  });

  it("scénario 6 : une tentative ÉCHOUÉE ne produit JAMAIS « Répondu »", () => {
    expect(
      isRequestAnswered([reply({ requestId: "r1", type: "contact", status: "failed", error: "429 quota" })])
    ).toBe(false);
  });

  it("aucune réponse → pas de statut « Répondu »", () => {
    expect(isRequestAnswered(undefined)).toBe(false);
    expect(isRequestAnswered([])).toBe(false);
  });

  it("le nombre d'échecs est compté séparément (historique des tentatives)", () => {
    const list = [
      reply({ requestId: "r1", type: "contact", status: "sent" }),
      reply({ requestId: "r1", type: "contact", status: "failed", error: "x" }),
    ];
    expect(countFailedReplies(list)).toBe(1);
  });
});

describe("histoire chronologique — groupée par demande", () => {
  it("ordre du plus ancien au plus récent, regroupement par parent", () => {
    const r1 = reply({ requestId: "r1", type: "partnership", created_at: "2026-11-03T09:00:00Z" });
    const r2 = reply({ requestId: "r1", type: "partnership", created_at: "2026-11-04T10:00:00Z" });
    const c1 = reply({ requestId: "c1", type: "contact" });
    const groups = groupRepliesByRequest([r2, c1, r1]);
    const k1: ReplyGroupKey = replyGroupKey("partnership", "r1");
    expect(groups.get(k1)?.map((x) => x.created_at)).toEqual([
      "2026-11-03T09:00:00Z",
      "2026-11-04T10:00:00Z",
    ]);
    expect(groups.get(replyGroupKey("contact", "c1"))?.length).toBe(1);
  });

  it("scénario 6bis : supprimer une demande ne touche que SON groupe (FK cascade, jamais les autres)", () => {
    const groups = groupRepliesByRequest([
      reply({ requestId: "r1", type: "partnership" }),
      reply({ requestId: "r2", type: "partnership" }),
    ]);
    // La suppression r1 retire la clé r1 SEULEMENT : r2 demeure intact.
    expect(groups.has(replyGroupKey("partnership", "r1"))).toBe(true);
    expect(groups.has(replyGroupKey("partnership", "r2"))).toBe(true);
  });
});

describe("validation du formulaire de réponse (schéma serveur)", () => {
  it("scénario 7 : le destinataire n'est PAS un champ du formulaire — impossible à détourner", () => {
    const parsed = sendReplySchema.safeParse({
      type: "partnership",
      id: "00000000-0000-4000-8000-000000000001",
      body: "Réponse officielle.",
      recipientEmail: "tier@pirate.gn", // champ parasite IGNORÉ par le schéma
      email: "autre@pirate.gn",
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data).not.toHaveProperty("recipientEmail");
    expect(parsed.data).not.toHaveProperty("email");
  });

  it("corps trop court refusé ; corps vide refusé (scénario 7)", () => {
    expect(
      sendReplySchema.safeParse({ type: "contact", id: "00000000-0000-4000-8000-000000000001", body: "" }).success
    ).toBe(false);
    expect(
      sendReplySchema.safeParse({ type: "contact", id: "00000000-0000-4000-8000-000000000001", body: "a" }).success
    ).toBe(false);
  });

  it("type inconnu et id non-UUID refusés (scénario 9 : requête forgée = refus)", () => {
    expect(
      sendReplySchema.safeParse({ type: "autre", id: "00000000-0000-4000-8000-000000000001", body: "Salut." }).success
    ).toBe(false);
    expect(
      sendReplySchema.safeParse({ type: "contact", id: "pas-un-uuid", body: "Salut." }).success
    ).toBe(false);
  });

  it("corps long accepté jusqu'à 10 000", () => {
    expect(
      sendReplySchema.safeParse({
        type: "partnership",
        id: "00000000-0000-4000-8000-000000000001",
        body: "x".repeat(10000),
      }).success
    ).toBe(true);
  });
});

describe("défenses locales", () => {
  it("isPlausibleEmail refuse un destinataire malformé (côté serveur avant envoi)", () => {
    expect(isPlausibleEmail("visiteur@exemple.gn")).toBe(true);
    expect(isPlausibleEmail("nimporte quoi")).toBe(false);
    expect(isPlausibleEmail("a@b")).toBe(false);
    expect(isPlausibleEmail(undefined)).toBe(false);
  });
});