"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  parseDirectConfigFormData,
} from "@/lib/direct/config";
import { resetDetectionCache } from "@/lib/direct/detect";
import type { Detection } from "@/lib/direct/core";

/**
 * Server Actions du module DIRECT (migration live_config 0031).
 * Garde requireRole(["admin","editor"]) + permission « directs » pour un
 * éditeur (mission 0036) ; la RLS (has_permission('directs') sur
 * live_config) applique en dernier ressort la même règle côté base.
 * Aucun service_role.
 *
 * Le champ « lien du direct » est un texte libre de la rédaction : il
 * est normalisé via extractYouTubeId (URL YouTube ou ID à 11
 * caractères) — une URL externe arbitraire est REFUSÉE, jamais de
 * lecteur hors YouTube.
 */

export interface SaveDirectState {
  ok: boolean;
  message: string;
}

/** Messages d'erreur de garde réutilisés (lib/actions/content.ts). */
function deniedMessage(denied: string): string {
  if (denied === "unauthenticated")
    return "Connectez-vous pour effectuer cette action.";
  if (denied === "unconfigured")
    return "Le back-office n'est pas configuré (voir supabase/README-CONFIGURATION.md).";
  return "Votre rôle ne permet pas cette action.";
}

export async function saveDirectConfig(
  _prev: SaveDirectState,
  formData: FormData
): Promise<SaveDirectState> {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) {
    return { ok: false, message: deniedMessage(guard.denied) };
  }
  // Un éditeur doit posséder la permission « directs » (admin/super passent).
  if (guard.session.profile?.role === "editor" && !hasPermission(guard.session.profile, "directs")) {
    return { ok: false, message: deniedMessage("forbidden") };
  }

  const input = parseDirectConfigFormData(formData);

  // Cohérence éditoriale : mode manuel exige un lien direct VALIDE.
  if (input.mode === "manual" && !input.manualVideoId) {
    return {
      ok: false,
      message:
        "Mode manuel : collez un lien YouTube (ou un identifiant à 11 caractères) du direct en cours.",
    };
  }

  // La rediffusion est facultative ; si saisie invalide → refus honnête
  // plutôt qu'un lien non fonctionnel.
  const replayRaw = String(formData.get("replay_url") ?? "").trim();
  if (replayRaw && !input.replayVideoId) {
    return {
      ok: false,
      message: "Lien de rediffusion invalide : seul un lien YouTube est accepté.",
    };
  }
  const manualRaw = String(formData.get("manual_url") ?? "").trim();
  if (manualRaw && !input.manualVideoId) {
    return {
      ok: false,
      message:
        "Lien de direct invalide : seul un lien YouTube (watch, youtu.be, live, embed) est accepté.",
    };
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, message: "Client introuvable — back-office non configuré." };
  }

  const { error } = await supabase.from("live_config").update({
    enabled: input.enabled,
    mode: input.mode,
    manual_video_id: input.manualVideoId,
    replay_video_id: input.replayVideoId,
    updated_by: guard.session.profile?.id ?? null,
  }).eq("id", "default");

  if (error) {
    // 42P01 = table absente → migration 0031 pas encore appliquée.
    const missing = error.code === "42P01" || /live_config/.test(error.message);
    return {
      ok: false,
      message: missing
        ? "La table live_config n'existe pas encore : la migration 0031 doit être appliquée sur autorisation de la direction."
        : `Enregistrement refusé : ${error.message}`,
    };
  }

  resetDetectionCache();
  revalidatePath("/");
  revalidatePath("/admin/direct");
  return { ok: true, message: "Configuration du direct enregistrée." };
}

export interface DetectDirectState {
  ok: boolean;
  message: string;
  status: Detection["status"] | null;
  videoId: string | null;
  title: string | null;
}

/**
 * Test de détection à la demande : force la détection (sans cache) et
 * enregistre le dernier état réel pour l'affichage admin + public.
 */
export async function testDirectDetection(
  _prev: DetectDirectState | null,
  _formData: FormData
): Promise<DetectDirectState> {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) {
    return {
      ok: false,
      status: null, videoId: null, title: null,
      message: deniedMessage(guard.denied),
    };
  }
  // Permission « directs » exigée d'un éditeur (mission 0036).
  if (guard.session.profile?.role === "editor" && !hasPermission(guard.session.profile, "directs")) {
    return {
      ok: false,
      status: null, videoId: null, title: null,
      message: deniedMessage("forbidden"),
    };
  }

  resetDetectionCache();
  const { detectLive } = await import("@/lib/direct/detect");
  const detection = await detectLive();

  // Trace de l'état réel (télémétrie honnête pour la rédaction).
  const supabase = await getSupabaseServerClient();
  if (supabase && detection.status !== "error") {
    await supabase
      .from("live_config")
      .update({
        last_state: detection.status,
        last_checked_at: new Date().toISOString(),
        updated_by: guard.session.profile?.id ?? null,
      })
      .eq("id", "default");
  }

  revalidatePath("/admin/direct");

  const labels: Record<Detection["status"], string> = {
    live: "DIRECT CONFIRMÉ : une émission est en cours sur la chaîne.",
    none: "Aucun direct en cours — la page d'accueil affichera la présentation discrète de la chaîne.",
    unconfigured:
      "Clé API YouTube absente : la détection automatique est silencieuse (le mode manuel de la rédaction reste disponible).",
    error:
      "YouTube n'a pas répondu — nouvel essai dans quelques minutes (la page d'accueil reste discrète).",
  };

  return {
    ok: true,
    status: detection.status,
    videoId: detection.status === "live" ? detection.videoId : null,
    title: detection.status === "live" ? detection.title : null,
    message: labels[detection.status],
  };
}
