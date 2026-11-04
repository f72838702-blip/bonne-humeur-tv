import type { ReplyStatus, RequestReply } from "@/lib/types";

/**
 * Noyau PUR des réponses de l'administration (aucune I/O) :
 * sujet, payload Brevo, statut « Répondu », historique chronologique.
 * Testable sans base ni réseau (scénarios §9 de la mission).
 */

export type ReplyRequestType = "partnership" | "contact";

/** Sujet de l'e-mail dérivé de la demande — jamais demandé à l'éditeur. */
export function buildReplySubject(
  type: ReplyRequestType,
  originalSubject: string | null
): string {
  if (type === "contact") {
    const s = (originalSubject ?? "").trim();
    return s.length >= 2 ? `Re: ${s}` : "Re: Votre message — Bonne Humeur TV";
  }
  return "Re: Votre demande de partenariat — Bonne Humeur TV";
}

/** Adresse e-mail bien formée (la base ne stocke que des e-mails validés à l'INSERT, défense en profondeur). */
export function isPlausibleEmail(email: unknown): boolean {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export interface BrevoEmailPayload {
  sender: { name: string; email: string };
  to: { email: string }[];
  replyTo?: { email: string };
  subject: string;
  textContent: string;
}

/**
 * Payload Brevo API v3 (/v3/smtp/email) — TEXTE BRUT uniquement
 * (aucun HTML composé depuis l'éditeur → aucune injection possible).
 * Le destinataire est transmis tel qu'enregistré en base.
 */
export function buildBrevoEmailPayload(params: {
  senderEmail: string;
  senderName: string;
  replyToEmail?: string;
  recipientEmail: string;
  subject: string;
  body: string;
}): BrevoEmailPayload {
  const payload: BrevoEmailPayload = {
    sender: { name: params.senderName, email: params.senderEmail },
    to: [{ email: params.recipientEmail }],
    subject: params.subject,
    textContent: params.body,
  };
  if (params.replyToEmail && isPlausibleEmail(params.replyToEmail)) {
    payload.replyTo = { email: params.replyToEmail };
  }
  return payload;
}

/** « Répondu » dérivé de l'existence d'une réponse effectivement ACCEPTÉE par le fournisseur. */
export function isRequestAnswered(replies: RequestReply[] | undefined): boolean {
  return (replies ?? []).some((r) => r.status === "sent");
}

/** Réponse en échec enregistrée (historique des tentatives, sans double envoi déguisé). */
export function countFailedReplies(replies: RequestReply[] | undefined): number {
  return (replies ?? []).filter((r) => r.status === "failed").length;
}

export type ReplyGroupKey = `${ReplyRequestType}:${string}`;

/** Clé de regroupement historique ↔ demande. */
export function replyGroupKey(type: ReplyRequestType, id: string): ReplyGroupKey {
  return `${type}:${id}`;
}

/**
 * Regroupe les réponses par demande, triées PAR DEMANDE du plus ancien au
 * plus récent (historique chronologique lisible dans l'ordre écrit).
 */
export function groupRepliesByRequest(
  replies: RequestReply[]
): Map<ReplyGroupKey, RequestReply[]> {
  const groups = new Map<ReplyGroupKey, RequestReply[]>();
  const ordered = [...replies].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  for (const reply of ordered) {
    if (reply.partnership_request_id) {
      push(replyGroupKey("partnership", reply.partnership_request_id), reply, groups);
    } else if (reply.contact_message_id) {
      push(replyGroupKey("contact", reply.contact_message_id), reply, groups);
    }
  }
  return groups;
}

function push(
  key: ReplyGroupKey,
  reply: RequestReply,
  groups: Map<ReplyGroupKey, RequestReply[]>
): void {
  const list = groups.get(key);
  if (list) list.push(reply);
  else groups.set(key, [reply]);
}

/** Libellé d'état d'une ligne d'historique. */
export function replyStatusLabel(status: ReplyStatus): string {
  return status === "sent" ? "Envoyée" : "Échec";
}