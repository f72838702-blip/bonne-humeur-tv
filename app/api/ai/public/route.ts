import { isBotUserAgent } from "@/lib/analytics/classes";
import { generateAi } from "@/lib/ai/client";
import { PUBLIC_FALLBACK_MESSAGE, buildPublicMessages } from "@/lib/ai/prompts";
import { buildKnowledgeContext } from "@/lib/ai/knowledge";
import { publicIdentifier } from "@/lib/ai/identity";
import {
  OUTPUT_MAX_TOKENS,
  PUBLIC_DAILY_MAX_REQUESTS,
  PUBLIC_MSG_MAX_CHARS,
  PUBLIC_SESSION_MAX_REQUESTS,
  PUBLIC_SESSION_WINDOW_SECONDS,
  DAILY_WINDOW_SECONDS,
  QUOTA_PUBLIC_MESSAGE,
  checkAiQuota,
} from "@/lib/ai/quotas";

/**
 * Endpoint du chatbot PUBLIC « Assistant Bonne Humeur Média » (direction §4/§7).
 *
 * • Périmètre strict : ne répond que sur Bonne Humeur Média à partir des
 *   contenus PUBLIÉS (RAG textuel search_published + base statique de la
 *   chaîne). Les contenus récupérés sont injectés comme DONNÉES — le prompt
 *   système les désigne ainsi (jamais des instructions).
 * • Sans réponse : le message exact de la direction (PUBLIC_FALLBACK_MESSAGE).
 * • Aucune donnée personnelle n'est collectée : pas de cookie, pas de
 *   stockage de conversation. Le calcul d'empreinte (C5, Phase E) vit dans
 *   lib/ai/identity.ts : CF-Connecting-IP d'abord (posé par l'edge
 *   Cloudflare, non forgeable), X-Forwarded-For en recours local ; hash
 *   sha256 roté chaque jour UTC — l'IP n'est JAMAIS stockée.
 * • Quota CENTRALISÉ DISTINCT (compteur `assistant_public` en base) :
 *   12 requêtes/10 min par visiteur + 150/jour au global (calibrage Neurons,
 *   Phase E2) — le quota journalier de l'administration (40) existe dans un
 *   COMPTEUR SÉPARÉ.
 * • Bots refusés (isBotUserAgent, même garde que l'analytics).
 * • En cas d'échec du modèle, la réponse est TOUJOURS le message de
 *   recadrage — jamais une erreur brute exposée, jamais d'invention.
 */

export const runtime = "nodejs";

interface PublicBody {
  message?: string;
}

export async function POST(request: Request): Promise<Response> {
  // 1) Bots refusés (comme la collecte analytics).
  const ua = request.headers.get("user-agent") ?? "";
  if (isBotUserAgent(ua)) {
    return Response.json({ ok: false, message: PUBLIC_FALLBACK_MESSAGE }, { status: 403 });
  }

  // 2) Charge utile stricte et bornée.
  let body: PublicBody;
  try {
    body = (await request.json()) as PublicBody;
  } catch {
    return Response.json(
      { ok: true, reply: PUBLIC_FALLBACK_MESSAGE, fallback: true }
    );
  }
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (message.length === 0) {
    return Response.json({ ok: true, reply: PUBLIC_FALLBACK_MESSAGE, fallback: true });
  }
  if (message.length > PUBLIC_MSG_MAX_CHARS) {
    return Response.json(
      { ok: false, message: `Message trop long (maximum ${PUBLIC_MSG_MAX_CHARS} caractères).` },
      { status: 413 }
    );
  }

  // 3) Empreinte anti-abus — CF-Connecting-IP d'abord (C5), hash journalier
  //    roté, JAMAIS l'IP en clair (lib/ai/identity.ts, testé).
  const identifier = publicIdentifier(
    (name) => request.headers.get(name),
    ua
  );
  const quota = await checkAiQuota("public", identifier);
  if (quota === "limited") {
    return Response.json(
      { ok: false, message: QUOTA_PUBLIC_MESSAGE, code: "quota" },
      { status: 429 }
    );
  }

  // 4) Contexte RAG : UNIQUEMENT du publié, injecté comme DONNÉES.
  const knowledge = await buildKnowledgeContext(message);

  // 5) Génération — tout échec = message de recadrage, jamais d'exposition.
  const result = await generateAi(buildPublicMessages(message, knowledge.context), {
    maxTokens: OUTPUT_MAX_TOKENS,
  });
  if (!result.ok) {
    // Indisponible (dev local) ou erreur fournisseurs : recadrage exact.
    return Response.json({ ok: true, reply: PUBLIC_FALLBACK_MESSAGE, fallback: true });
  }

  // Garde-fou : si le modèle a renvoyé une réponse quasi vide.
  const reply = result.text.trim();
  if (reply.length === 0) {
    return Response.json({ ok: true, reply: PUBLIC_FALLBACK_MESSAGE, fallback: true });
  }

  return Response.json({
    ok: true,
    reply,
    fallback: false,
    degraded: knowledge.degraded || undefined,
  });
}
