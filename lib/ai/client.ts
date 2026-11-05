/**
 * Couche d'ABSTRACTION du fournisseur IA (demande direction §2) :
 * les deux assistants ne connaissent que `generateAi(messages)` —
 * changer de modèle (ou de fournisseur un jour) ne réécrit rien.
 *
 * Fournisseur actuel : CLOUDFLARE WORKERS AI (plan Free — 10 000 Neurons/
 * jour vérifiés sur la documentation officielle, AUCUN moyen de paiement
 * possible, dépassement = erreur → arrêt propre, jamais de bascule payante).
 *
 * • Accès UNIQUEMENT par le binding natif `env.AI` du Worker : il n'existe
 *   littéralement AUCUNE clé API pour ce service — rien à exposer.
 * • REPLI (C4, Phase E + ajustement E2) : sur échec DÉFINITIF du principal
 *   uniquement (réponse vide, erreur du binding), un SEUL essai sur
 *   @cf/mistralai/mistral-small-3.1-24b-instruct — reste Workers AI, reste
 *   gratuit. JAMAIS de repli : si le principal réussit, après un TIMEOUT
 *   (la génération du principal poursuivrait en arrière-plan — le binding
 *   ne permet pas de l'interrompre → erreur propre plutôt que deux
 *   générations simultanées), ni quand le principal EST déjà Mistral.
 * • TIMEOUT (C8, Phase E) : course avec un délai explicite
 *   (AI_TIMEOUT_MS, défaut 60 s). Le binding Workers AI ne permet pas
 *   d'interrompre la génération CÔTÉ SERVEUR : le délai ne fait que
 *   répondre au client ; les tokens générés après coup peuvent être
 *   facturés en Neurons par Cloudflare — documenté, coût plafonné par le
 *   free plan.
 * • En dev local sans binding : raison « unavailable » honnête — jamais de
 *   réponse simulée.
 */

export const AI_PROVIDER_NAME = "workers-ai";

/** Modèle par défaut (banc d'essai : meilleur rapport qualité/prix). */
export const DEFAULT_AI_MODEL = "@cf/qwen/qwen3-30b-a3b-fp8";

/** Repli du banc d'essai (excellent français, rapide, un peu plus cher). */
export const FALLBACK_AI_MODEL = "@cf/mistralai/mistral-small-3.1-24b-instruct";

/** Dépai d'un appel au modèle (C8). Doit couvrir les réponses longues
 *  observées au banc (jusqu'à ~22 s) avec marge — pas un raccourci agressif. */
export const AI_TIMEOUT_MS = 60_000;

export function currentAiModel(): string {
  const model = (process.env.WORKERS_AI_MODEL ?? "").trim();
  return model.length > 0 ? model : DEFAULT_AI_MODEL;
}

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export type AiResult =
  | { ok: true; text: string; model: string }
  | { ok: false; reason: "unavailable" | "provider-error"; error?: string };

interface AiBinding {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}

/** Binding Workers AI — null hors Worker (dev local : indisponible honnête). */
async function getAiBinding(): Promise<AiBinding | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const env = getCloudflareContext().env as { AI?: AiBinding } | undefined;
    return env?.AI ?? null;
  } catch {
    return null;
  }
}

/** Race avec délai — le rejet du timer ne rejette pas la promesse réelle. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`délai dépassé (${ms} ms)`)),
      ms
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/** Normalise les deux formes de réponse observées (string / chat.completion). */
export function extractResponseText(out: unknown): string | null {
  if (typeof out === "string") return out.trim().length > 0 ? out : null;
  if (out === null || typeof out !== "object") return null;
  const o = out as {
    response?: unknown;
    output_text?: unknown;
    choices?: { message?: { content?: unknown } }[];
  };
  for (const candidate of [
    o.response,
    o.output_text,
    o.choices?.[0]?.message?.content,
  ]) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate;
    }
  }
  return null;
}

type AttemptResult =
  | { ok: true; text: string }
  | { ok: false; error: string; definitive: boolean };

/** Un essai sur UN modèle.
 *  • réponse vide / rejet du binding = échec DÉFINITIF (l'appel est terminé :
 *    aucune génération ne tourne en arrière-plan → repli sans risque) ;
 *  • TIMEOUT = échec NON définitif (E2) : la génération continue côté
 *    Cloudflare, qu'on ne peut pas interrompre — lancer un repli créerait
 *    DEUX générations simultanées facturées. On rend donc une erreur
 *    propre, SANS repli. */
async function attempt(
  binding: AiBinding,
  model: string,
  input: Record<string, unknown>,
  timeoutMs: number
): Promise<AttemptResult> {
  try {
    const out = await withTimeout(binding.run(model, input), timeoutMs);
    const text = extractResponseText(out);
    if (!text) return { ok: false, error: "réponse vide", definitive: true };
    return { ok: true, text };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // withTimeout rejette exactement son propre message en cas de délai.
    const isTimeout = message.startsWith("délai dépassé");
    return { ok: false, error: message, definitive: !isTimeout };
  }
}

/**
 * Génère une réponse. JAMAIS d'argument payant : max_tokens plafonné par
 * l'appelant (quotas) ; un seul repli si le principal échoue ; l'erreur
 * du PRINCIPAL est rapportée (la plus descriptive) si le repli échoue aussi.
 */
export async function generateAi(
  messages: AiMessage[],
  opts?: { maxTokens?: number; timeoutMs?: number }
): Promise<AiResult> {
  const binding = await getAiBinding();
  if (!binding) {
    return { ok: false, reason: "unavailable" };
  }
  const input = {
    messages,
    max_tokens: opts?.maxTokens ?? 900,
  };
  const timeoutMs = opts?.timeoutMs ?? AI_TIMEOUT_MS;

  const primary = currentAiModel();
  const primaryResult = await attempt(binding, primary, input, timeoutMs);
  if (primaryResult.ok) {
    return { ok: true, text: primaryResult.text, model: primary };
  }

  // Repli UNIQUEMENT sur échec DÉFINITIF du principal (jamais après un
  // timeout — E2 : la génération du principal continuerait en arrière-plan
  // pendant celle du repli → double consommation). En cas de timeout :
  // erreur propre, pas de second appel.
  if (!primaryResult.definitive || primary === FALLBACK_AI_MODEL) {
    return {
      ok: false,
      reason: "provider-error",
      error: primaryResult.error,
    };
  }
  const fallbackResult = await attempt(
    binding,
    FALLBACK_AI_MODEL,
    input,
    timeoutMs
  );
  if (fallbackResult.ok) {
    return { ok: true, text: fallbackResult.text, model: FALLBACK_AI_MODEL };
  }
  return {
    ok: false,
    reason: "provider-error",
    error: primaryResult.error,
  };
}
