import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ReplyRequestType } from "@/lib/replies-core";
import type { RequestReply } from "@/lib/types";

/**
 * Historique des réponses (0028). Lecture staff (RLS), écriture par
 * l'action serveur d'envoi — ADMIN uniquement (RLS admin en dernier
 * ressort). Aucun e-mail du visiteur n'est modifiable ici.
 */

/** Historique complet (faible volume) — regroupé côté noyau pur. */
export async function getReplyHistory(): Promise<RequestReply[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("request_replies")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) {
    console.error("[data/replies] getReplyHistory :", error.message);
    return [];
  }
  return (data ?? []) as RequestReply[];
}

/** Lit le parent côté serveur : le destinataire provient UNIQUEMENT de la base. */
export async function getRequestRecipient(params: {
  type: ReplyRequestType;
  id: string;
}): Promise<{ ok: boolean; email?: string; subject?: string | null; error?: string }> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_not_configured" };

  const table = params.type === "partnership" ? "partnership_requests" : "contact_messages";
  const { data, error } = await supabase
    .from(table)
    .select("email, subject")
    .eq("id", params.id)
    .limit(1)
    .maybeSingle<{ email: string; subject: string | null }>();

  if (error) {
    console.error("[data/replies] getRequestRecipient :", error.message);
    return { ok: false, error: error.message };
  }
  if (!data?.email) return { ok: false, error: "not_found" };
  return { ok: true, email: data.email, subject: data.subject ?? null };
}

export async function insertSentReply(params: {
  type: ReplyRequestType;
  requestId: string;
  recipientEmail: string;
  body: string;
  senderProfileId: string | null;
  providerMessageId: string | null;
}): Promise<boolean> {
  return insertReply({ ...params, status: "sent", error: null });
}

/** Tentative échouée : conservée dans l'historique (traçabilité), sans jamais valider l'envoi. */
export async function insertFailedReply(params: {
  type: ReplyRequestType;
  requestId: string;
  recipientEmail: string;
  body: string;
  senderProfileId: string | null;
  error: string;
}): Promise<boolean> {
  return insertReply({ ...params, status: "failed", providerMessageId: null });
}

async function insertReply(params: {
  type: ReplyRequestType;
  requestId: string;
  recipientEmail: string;
  body: string;
  senderProfileId: string | null;
  status: "sent" | "failed";
  error: string | null;
  providerMessageId: string | null;
}): Promise<boolean> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return false;

  const row = {
    [params.type === "partnership" ? "partnership_request_id" : "contact_message_id"]:
      params.requestId,
    recipient_email: params.recipientEmail,
    body: params.body,
    sender_profile_id: params.senderProfileId,
    status: params.status,
    error: params.error,
    provider_message_id: params.providerMessageId,
  };

  const { error } = await supabase.from("request_replies").insert(row);
  if (error) {
    console.error("[data/replies] insertReply :", error.message);
    return false;
  }
  return true;
}