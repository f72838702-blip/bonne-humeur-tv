import { generateAi, type AiMessage } from "@/lib/ai/client";
import { buildAdminMessages } from "@/lib/ai/prompts";
import {
  ADMIN_MSG_MAX_CHARS,
  ADMIN_USER_MAX_REQUESTS,
  ADMIN_USER_WINDOW_SECONDS,
  DAILY_WINDOW_SECONDS,
  ADMIN_DAILY_MAX_REQUESTS,
  QUOTA_ADMIN_MESSAGE,
  ADMIN_OUTPUT_MAX_TOKENS,
  checkAiQuota,
} from "@/lib/ai/quotas";
import { requireRole } from "@/lib/auth/session";

/**
 * Endpoint de l'assistant IA PRIVÉ — rédaction (demande direction §3/§7).
 *
 * • Accès : rôles admin/editor UNIQUEMENT (garde serveur requireRole, comme
 *   toutes les actions d'administration) — un visiteur anonyme reçoit 401/403.
 * • Quota CENTRALISÉ (lib/ai/quotas.ts) : par utilisateur (40/10 min) +
 *   quota journalier de l'administration (40/j, part RÉSERVÉE — le public
 *   écrit dans un compteur DISTINCT et ne peut jamais l'épuiser).
 * • Aucun secret ne circule jamais vers le navigateur : seuls le texte
 *   généré et le nom du modèle repartent.
 * • L'assistant NE PUBLIE JAMAIS : il renvoie du texte que la rédaction
 *   relit ; l'enregistrement éventuel passe par saveArticle existante
 *   (statique brouillon, côté UI).
 * • Les données envoyées par l'utilisateur restent dans la requête : rien
 *   n'est stocké, les conversations privées de la rédaction ne sont pas
 *   exposées (direction §6).
 */

export const runtime = "nodejs";

interface AdminBody {
  message?: string;
  /** Histoire courte récente (≤ 2000 caractères par message). */
  history?: { role?: string; content?: string }[];
}

/** Assainit l'histoire : rôles connus uniquement, contenu borné. */
function sanitizeHistory(
  history: AdminBody["history"]
): { role: "user" | "assistant"; content: string }[] {
  if (!Array.isArray(history)) return [];
  return history
    .filter(
      (m): m is { role: string; content: string } =>
        typeof m === "object" && m !== null &&
        typeof m.role === "string" && typeof m.content === "string"
    )
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content.slice(0, 2000),
    }));
}

export async function POST(request: Request): Promise<Response> {
  // 1) Garde de rôle — jamais seulement l'UI.
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) {
    return Response.json(
      { ok: false, reason: guard.denied, message: "Accès réservé à la rédaction connectée." },
      { status: guard.denied === "unconfigured" ? 503 : 403 }
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

  // 4) Génération via la couche d'abstraction (Workers AI, plan gratuit).
  const history = sanitizeHistory(body.history);
  const messages: AiMessage[] = buildAdminMessages(message, history);
  // max_tokens admin relevé à 2000 (C4) : le modèle principal qwen3 consomme
  // son budget en raisonnement — le repli Mistral n'arrive qu'en échec réel.
  const result = await generateAi(messages, { maxTokens: ADMIN_OUTPUT_MAX_TOKENS });
  if (!result.ok) {
    return Response.json(
      {
        ok: false,
        code: result.reason === "unavailable" ? "unavailable" : "provider-error",
        message:
          result.reason === "unavailable"
            ? "L'assistant IA n'est pas disponible dans cet environnement."
            : "L'assistant IA n'a pas pu répondre (erreur temporaire). Réessayez.",
      },
      { status: 502 }
    );
  }

  return Response.json({ ok: true, text: result.text, model: result.model });
}
