import { generateAi, type AiMessage } from "@/lib/ai/client";
import {
  ADMIN_OUTPUT_MAX_TOKENS,
  ADMIN_MSG_MAX_CHARS,
  ADMIN_USER_MAX_REQUESTS,
  ADMIN_USER_WINDOW_SECONDS,
  DAILY_WINDOW_SECONDS,
  ADMIN_DAILY_MAX_REQUESTS,
  QUOTA_ADMIN_MESSAGE,
  checkAiQuota,
} from "@/lib/ai/quotas";

import {
  appendMessage,
  createConversation,
  getConversationMessages,
  getMemory,
  ownsConversation,
  touchConversation,
  upsertMemory,
} from "@/lib/data/ai-conversations";
import {
  buildMemoryUpdateMessages,
  clampMemoryText,
  countExchanges,
  deriveConversationTitle,
  memoryContextBlock,
  recentContextHistory,
  shouldSummarize,
} from "@/lib/ai/memory-core";
import { buildAdminMessages } from "@/lib/ai/prompts";
import { requireRole } from "@/lib/auth/session";
import { hasAnyPermission } from "@/lib/auth/permissions";

/**
 * Endpoint de l'assistant IA PRIVÉ — rédaction (direction §3/§7 + mémoire
 * conversationnelle 06/11).
 *
 * • Accès : rôles admin/editor UNIQUEMENT (garde serveur requireRole) —
 *   un visiteur anonyme reçoit 401/403 ; mission 0036 : un éditeur doit
 *   posséder une permission article (assistant de rédaction).
 * • PERSISTANCE (migration 0033) : la conversation est créée/lue CÔTÉ
 *   SERVEUR à partir de la session (jamais un user_id du navigateur) ;
 *   message utilisateur + réponse enregistrés ; derniers échanges + mémoire
 *   contextuelle durable injectés au modèle (déchets = rien : l'histoire
 *   entière n'est JAMAIS transmise).
 * • REpli de persistance : si la base refuse l'écriture, l'assistant
 *   continue en ÉPHÉMÈRE (aucun message perdu côté réponse ; conversationId
 *   absent → l'UI reste locale) — jamais d'écran bloqué.
 * • Mémoire : mise à jour périodique par le modèle (shouldSummarize) à
 *   partir de SEULS échanges réels ; échec = silencieux (mémoire inchangée).
 * • Quota CENTRALISÉ inchangé : checkAiQuota("admin") AVANT toute écriture.
 * • L'assistant NE PUBLIE JAMAIS : saveArticle (statique brouillon) reste
 *   la seule voie — aucune donnée n'est publiée automatiquement.
 */

export const runtime = "nodejs";

interface AdminBody {
  message?: string;
  /** Id de conversation DÉJÀ VÉRIFIÉ propriétaire côté serveur (optionnel). */
  conversationId?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request): Promise<Response> {
  // 1) Garde de rôle — jamais seulement l'UI.
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) {
    return Response.json(
      { ok: false, reason: guard.denied, message: "Accès réservé à la rédaction connectée." },
      { status: guard.denied === "unconfigured" ? 503 : 403 }
    );
  }
  // 1 bis) Permission 0036 : l'assistant est un outil de RÉDACTION.
  const profile = guard.session.profile;
  if (
    profile?.role === "editor" &&
    !hasAnyPermission(profile, ["articles", "articles_tous", "articles_publier"])
  ) {
    return Response.json(
      { ok: false, reason: "forbidden", message: "Accès réservé à la rédaction avec permission « Articles »." },
      { status: 403 }
    );
  }

  // 2) Charge utile stricte et bornée.
  let body: AdminBody;
  try {
    body = (await request.json()) as AdminBody;
  } catch {
    return Response.json({ ok: false, message: "Requête invalide." }, { status: 400 });
  }
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (message.length === 0) {
    return Response.json({ ok: false, message: "La demande est vide." }, { status: 400 });
  }
  if (message.length > ADMIN_MSG_MAX_CHARS) {
    return Response.json(
      { ok: false, message: `Demande trop longue (maximum ${ADMIN_MSG_MAX_CHARS} caractères).` },
      { status: 413 }
    );
  }

  // 3) Quota par utilisateur (identifiant = email de session, jamais l'ID brut).
  const identifier = guard.session.email ?? guard.session.userId;
  const quota = await checkAiQuota("admin", identifier);
  if (quota === "limited") {
    return Response.json(
      { ok: false, message: QUOTA_ADMIN_MESSAGE, code: "quota" },
      { status: 429 }
    );
  }

  // 4) Conversation ACTIVE — résolue côté serveur, jamais un id client cru.
  const askedId =
    typeof body.conversationId === "string" && UUID_RE.test(body.conversationId)
      ? body.conversationId
      : null;
  let conversationId: string | null = null;
  if (askedId) {
    if (
      !(await ownsConversation(guard.session.userId, askedId))
    ) {
      return Response.json(
        { ok: false, message: "Conversation introuvable." },
        { status: 404 }
      );
    }
    conversationId = askedId;
  } else {
    const created = await createConversation(
      guard.session.userId,
      deriveConversationTitle(message)
    );
    if (created) conversationId = created.id;
    // Sinon : mode éphémère gracieux (persistance indisponible).
  }

  // 5) Historique réel enregistré (borne : 200 derniers messages).
  const priorLines = conversationId
    ? (await getConversationMessages(guard.session.userId, conversationId)).map(
        (m) => ({ role: m.role, content: m.content })
      )
    : [];
  const exchangeCount = countExchanges(priorLines);

  // 6) Enregistrement DURABLE du message utilisateur (avant génération —
  //    un échec de génération ne doit pas perdre la demande).
  if (conversationId) {
    await appendMessage(guard.session.userId, conversationId, "user", message);
  }

  // 7) Contexte de travail : derniers échanges + mémoire durable (DONNÉE).
  const memory = await getMemory(guard.session.userId);
  const history: AiMessage[] = recentContextHistory(priorLines).map((m) => ({
    role: m.role,
    content: m.content,
  }));
  const messages = buildAdminMessages(message, history, memoryContextBlock(memory));

  // 8) Génération (couche d'abstraction, repli Mistral sur échec définitif —
  //    jamais après timeout, E2).
  const result = await generateAi(messages, { maxTokens: ADMIN_OUTPUT_MAX_TOKENS });
  if (!result.ok) {
    return Response.json(
      {
        ok: false,
        conversationId: conversationId ?? undefined,
        code: result.reason === "unavailable" ? "unavailable" : "provider-error",
        message:
          result.reason === "unavailable"
            ? "L'assistant IA n'est pas disponible dans cet environnement."
            : "L'assistant IA n'a pas pu répondre (erreur temporaire). Réessayez.",
      },
      { status: 502 }
    );
  }

  // 9) Enregistrement durable de la RÉPONSE.
  if (conversationId) {
    await appendMessage(guard.session.userId, conversationId, "assistant", result.text);
    await touchConversation(guard.session.userId, conversationId);
  }

  // 10) Mémoire contextuelle : réactualisation périodique (silencieuse —
  //     un échec de résumé ne casse JAMAIS la conversation) — le déclencheur
  //     porte sur l'échange VENANT de se produire.
  if (conversationId && shouldSummarize(exchangeCount + 1)) {
    try {
      const memResult = await generateAi(
        buildMemoryUpdateMessages(memory, [
          ...priorLines,
          { role: "user" as const, content: message },
          { role: "assistant" as const, content: result.text },
        ]),
        { maxTokens: 600, timeoutMs: 30_000 }
      );
      if (memResult.ok && memResult.text.trim().length > 0) {
        await upsertMemory(guard.session.userId, clampMemoryText(memResult.text));
      }
    } catch {
      // La mémoire reste inchangée — aucune trace d'erreur bloquante.
    }
  }

  return Response.json({
    ok: true,
    text: result.text,
    model: result.model,
    conversationId: conversationId ?? undefined,
  });
}
