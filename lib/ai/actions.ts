"use server";

import { requireRole } from "@/lib/auth/session";
import { hasAnyPermission } from "@/lib/auth/permissions";
import {
  createConversation,
  deleteConversation,
  getConversationMessages,
  listConversations,
  ownsConversation,
  renameConversation,
  type AiConversationRow,
  type AiMessageRow,
} from "@/lib/data/ai-conversations";

/**
 * Actions serveur de la mémoire conversationnelle admin (0033) — appelées
 * par le composant client AiAssistant. Garde serveur requireRole
 * (["admin","editor"]) sur CHAQUE action + filtre propriétaire explicite +
 * RLS owner en dernier ressort (l'identité vient de la session, JAMAIS du
 * navigateur). Mission 0036 : un éditeur doit posséder une permission
 * article (assistant de RÉDACTION) — admin/super_admin passent toujours.
 * Aucune de ces actions ne touche au chatbot public.
 */

/** L'éditeur connecté a-t-il accès à l'assistant de rédaction ? */
async function aiDenied(guard: { session: { userId: string; profile: { role: string } | null } }): Promise<boolean> {
  const profile = guard.session.profile;
  return profile?.role === "editor" && !hasAnyPermission(profile, ["articles", "articles_tous", "articles_publier"]);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function listConversationsAction(): Promise<
  AiConversationRow[]
> {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) return [];
  if (await aiDenied(guard)) return [];
  return listConversations(guard.session.userId);
}

export async function getConversationMessagesAction(
  conversationId: string
): Promise<AiMessageRow[]> {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) return [];
  if (await aiDenied(guard)) return [];
  if (!UUID_RE.test(conversationId)) return [];
  if (!(await ownsConversation(guard.session.userId, conversationId))) return [];
  return getConversationMessages(guard.session.userId, conversationId);
}

/** Crée la conversation (serveur seul — titre dérivé du message). */
export async function startConversationAction(
  firstMessage: string
): Promise<AiConversationRow | null> {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) return null;
  if (await aiDenied(guard)) return null;
  const title = firstMessage.trim().slice(0, 60);
  if (title.length === 0) return null;
  return createConversation(guard.session.userId, title);
}

export async function renameConversationAction(
  conversationId: string,
  title: string
): Promise<boolean> {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) return false;
  if (await aiDenied(guard)) return false;
  if (!UUID_RE.test(conversationId)) return false;
  if (!(await ownsConversation(guard.session.userId, conversationId))) return false;
  return renameConversation(guard.session.userId, conversationId, title);
}

export async function deleteConversationAction(
  conversationId: string
): Promise<boolean> {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) return false;
  if (await aiDenied(guard)) return false;
  if (!UUID_RE.test(conversationId)) return false;
  if (!(await ownsConversation(guard.session.userId, conversationId))) return false;
  return deleteConversation(guard.session.userId, conversationId);
}
