import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Persistance de la mémoire conversationnelle (0033). CLIENT SESSION sous
 * RLS — jamais service_role : l'isolations des conversations est garantie
 * par la RLS owner (`owner_user_id = auth.uid()`) EN DERNIER RESSORT, et
 * chaque accès porte un filtre EXPLICITE sur le propriétaire (défense en
 * profondeur — jamais un user_id transmis par le navigateur).
 */

export const CONVERSATIONS_LIST_LIMIT = 30;
export const MESSAGES_LOAD_LIMIT = 200;

export interface AiConversationRow {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface AiMessageRow {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

/** Liste des conversations du connecté (les plus récentes d'abord). */
export async function listConversations(
  ownerUserId: string
): Promise<AiConversationRow[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("ai_conversations")
    .select("id, title, created_at, updated_at")
    .eq("owner_user_id", ownerUserId)
    .order("updated_at", { ascending: false })
    .limit(CONVERSATIONS_LIST_LIMIT);

  if (error) {
    console.error("[data/ai-conversations] listConversations :", error.message);
    return [];
  }
  return (data ?? []) as AiConversationRow[];
}

/** La conversation appartient-elle AU CONNECTÉ (jamais un id client cru) ? */
export async function ownsConversation(
  ownerUserId: string,
  conversationId: string
): Promise<boolean> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return false;

  const { data } = await supabase
    .from("ai_conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("owner_user_id", ownerUserId)
    .limit(1)
    .maybeSingle();
  return data !== null;
}

export async function createConversation(
  ownerUserId: string,
  title: string
): Promise<AiConversationRow | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("ai_conversations")
    .insert({ owner_user_id: ownerUserId, title })
    .select("id, title, created_at, updated_at")
    .single();
  if (error) {
    console.error("[data/ai-conversations] createConversation :", error.message);
    return null;
  }
  return data as AiConversationRow;
}

/** Messages COMPLETS d'une conversation du connecté (ordre chronologique). */
export async function getConversationMessages(
  ownerUserId: string,
  conversationId: string
): Promise<AiMessageRow[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];
  if (!(await ownsConversation(ownerUserId, conversationId))) return [];

  const { data, error } = await supabase
    .from("ai_messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(MESSAGES_LOAD_LIMIT);

  if (error) {
    console.error("[data/ai-conversations] getConversationMessages :", error.message);
    return [];
  }
  return (data ?? []) as AiMessageRow[];
}

export async function appendMessage(
  ownerUserId: string,
  conversationId: string,
  role: "user" | "assistant",
  content: string
): Promise<boolean> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return false;
  if (!(await ownsConversation(ownerUserId, conversationId))) return false;

  const { error } = await supabase
    .from("ai_messages")
    .insert({ conversation_id: conversationId, role, content });
  if (error) {
    console.error("[data/ai-conversations] appendMessage :", error.message);
    return false;
  }
  return true;
}

/** Bump du tri (le touch_updated_at SQL fait le travail réel). */
export async function touchConversation(
  ownerUserId: string,
  conversationId: string
): Promise<void> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return;
  await supabase
    .from("ai_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .eq("owner_user_id", ownerUserId);
}

export { renameConversation, deleteConversation };

/** Renommage — propriétaire explicite (RLS en dernier ressort). */
async function renameConversation(
  ownerUserId: string,
  conversationId: string,
  title: string
): Promise<boolean> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return false;
  const clean = title.trim().slice(0, 200);
  if (clean.length === 0) return false;
  const { error } = await supabase
    .from("ai_conversations")
    .update({ title: clean })
    .eq("id", conversationId)
    .eq("owner_user_id", ownerUserId);
  if (error) {
    console.error("[data/ai-conversations] renameConversation :", error.message);
    return false;
  }
  return true;
}

/** Suppression EFFECTIVE (cascade SQL : messages + journal, aucune corbeille). */
async function deleteConversation(
  ownerUserId: string,
  conversationId: string
): Promise<boolean> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return false;
  const { error } = await supabase
    .from("ai_conversations")
    .delete()
    .eq("id", conversationId)
    .eq("owner_user_id", ownerUserId);
  if (error) {
    console.error("[data/ai-conversations] deleteConversation :", error.message);
    return false;
  }
  return true;
}

/** Mémoire contextuelle durable de l'utilisateur ("" si absente). */
export async function getMemory(ownerUserId: string): Promise<string> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return "";
  const { data } = await supabase
    .from("ai_memories")
    .select("content")
    .eq("user_id", ownerUserId)
    .maybeSingle<{ content: string }>();
  return data?.content ?? "";
}

export async function upsertMemory(
  ownerUserId: string,
  content: string
): Promise<boolean> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return false;
  const { error } = await supabase.from("ai_memories").upsert(
    { user_id: ownerUserId, content },
    { onConflict: "user_id" }
  );
  if (error) {
    console.error("[data/ai-conversations] upsertMemory :", error.message);
    return false;
  }
  return true;
}
