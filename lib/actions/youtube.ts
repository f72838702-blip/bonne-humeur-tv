"use server";

import { requireRole } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { extractYouTubeId } from "@/lib/youtube/url";
import { fetchYouTubeVideoMeta, isYouTubeApiConfigured } from "@/lib/youtube/api";
import { ActionState, errorState } from "./helpers";

/**
 * Import des métadonnées YouTube (titre, description, miniature, durée,
 * statut de direct RÉEL) pour le formulaire vidéo du CMS.
 *
 * • editor+ uniquement AVEC la permission « videos » (mission 0036) —
 *   l'import alimente le formulaire vidéo du CMS.
 * • L'identifiant est extrait et validé STRICTEMENT : URL YouTube ou ID
 *   brut — toute source externe arbitraire est refusée (directive §1).
 * • YOUTUBE_API_KEY n'est jamais exposée : l'appel à la Data API v3
 *   se fait ici, côté serveur uniquement.
 * • API non configurée → message honnête, l'ajout manuel reste possible.
 */

export async function importYouTubeMeta(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) {
    return errorState(
      guard.denied === "unauthenticated"
        ? "Connectez-vous pour effectuer cette action."
        : "Votre rôle ne permet pas cette action."
    );
  }
  // Permission « videos » exigée d'un éditeur (mission 0036).
  if (guard.session.profile?.role === "editor" && !hasPermission(guard.session.profile, "videos")) {
    return errorState("Votre rôle ne permet pas cette action.");
  }

  const raw = String(formData.get("youtube_url") ?? "");
  const videoId = extractYouTubeId(raw);
  if (!videoId) {
    return errorState(
      "URL YouTube invalide. Formats acceptés : youtube.com/watch?v=…, youtu.be/…, youtube.com/embed/…, youtube.com/live/… ou l'identifiant à 11 caractères.",
      { youtube_url: "URL YouTube ou ID invalide" }
    );
  }

  if (!isYouTubeApiConfigured()) {
    return errorState(
      "L'API YouTube n'est pas configurée sur le serveur (YOUTUBE_API_KEY absente). Renseignez les champs manuellement — l'identifiant détecté est correct.",
      { youtube_url: "API non configurée" }
    );
  }

  const meta = await fetchYouTubeVideoMeta(videoId);
  if (!meta) {
    return errorState(
      "Impossible de récupérer les métadonnées YouTube (vidéo introuvable, privée, ou erreur réseau). Renseignez les champs manuellement.",
      { youtube_url: "Métadonnées indisponibles" }
    );
  }

  // Charge utile destinée au formulaire : successState ne transporte pas
  // de données, on renvoie donc l'état complet explicitement.
  return {
    status: "success",
    message: "Métadonnées YouTube importées.",
    data: {
      id: meta.id,
      title: meta.title,
      description: meta.description,
      thumbnail_url: meta.thumbnailUrl,
      duration: meta.duration,
      published_at: meta.publishedAt,
      // liveBroadcastContent réel : "live" | "upcoming" | "none"
      live_broadcast_content: meta.liveBroadcastContent,
    },
  };
}