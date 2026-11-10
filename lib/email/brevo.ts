import { buildBrevoEmailPayload, isPlausibleEmail } from "@/lib/replies-core";

/**
 * Envoi d'e-mails côté SERVEUR via l'API HTTP Brevo (plan gratuit).
 * Les clés vivent dans les variables d'environnement du Worker — jamais
 * dans le dépôt, jamais exposées au navigateur. L'envoi est en TEXTE BRUT
 * (textContent) : rien de composé en HTML depuis l'éditeur.
 */

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

export function isBrevoConfigured(): boolean {
  return (
    (process.env.BREVO_API_KEY ?? "").length > 0 &&
    (process.env.BREVO_SENDER_EMAIL ?? "").length > 0
  );
}

export type SendEmailResult =
  | { ok: true; messageId: string | null }
  | { ok: false; error: string };

/**
 * Envoie l'e-mail et ne valide l'envoi QUE si Brevo répond 2xx avec un
 * identifiant de message — sinon { ok:false } (la réponse ne doit jamais
 * s'afficher « envoyée » sans confirmation du fournisseur).
 */
export async function sendEmailViaBrevo(params: {
  recipientEmail: string;
  subject: string;
  body: string;
}): Promise<SendEmailResult> {
  const apiKey = process.env.BREVO_API_KEY ?? "";
  const senderEmail = process.env.BREVO_SENDER_EMAIL ?? "";
  const senderName = process.env.BREVO_SENDER_NAME || "Bonne Humeur Média";
  // Par défaut, les réponses des visiteurs arrivent sur la boîte de
  // l'expéditeur (la demande a été envoyée à partir d'elle).
  const replyToEmail = process.env.BREVO_REPLY_TO_EMAIL || senderEmail;

  if (!apiKey || !senderEmail) return { ok: false, error: "brevo_not_configured" };
  if (!isPlausibleEmail(params.recipientEmail)) return { ok: false, error: "invalid_recipient" };

  const payload = buildBrevoEmailPayload({
    senderEmail,
    senderName,
    replyToEmail,
    recipientEmail: params.recipientEmail,
    subject: params.subject,
    body: params.body,
  });

  let res: Response;
  try {
    res = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return { ok: false, error: "reseau indisponible (délai ou connexion dépassé)" };
  }

  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    return { ok: false, error: `${res.status} — ${detail || "refus du fournisseur"}` };
  }

  const data = (await res.json().catch(() => ({}))) as { messageId?: unknown };
  return {
    ok: true,
    messageId: typeof data.messageId === "string" ? data.messageId : null,
  };
}