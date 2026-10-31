"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import {
  inviteUserSchema,
  requestStatusSchema,
  roleChangeSchema,
} from "@/lib/validation/schemas";
import {
  ActionState,
  errorState,
  successState,
  zodFieldErrors,
} from "./helpers";
import {
  disableTeamMember,
  enableTeamMember,
  inviteTeamMember,
  updateProfileRole,
} from "@/lib/data/users";
import { updateRequestStatus } from "@/lib/data/requests";
import { deleteMedia, uploadMedia } from "@/lib/data/media";

/**
 * Actions d'administration — demandes B2B/contact, rôles, invitations,
 * comptes, médiathèque. Chaque action revérifie le rôle côté serveur ;
 * la base (RLS) réapplique la même règle en dernier ressort.
 */

function deniedState(denied: string): ActionState {
  const messages: Record<string, string> = {
    unauthenticated: "Connectez-vous pour effectuer cette action.",
    forbidden: "Votre rôle ne permet pas cette action.",
    unconfigured: "Le back-office n'est pas configuré (voir supabase/README-CONFIGURATION.md).",
  };
  return errorState(messages[denied] ?? "Action refusée.");
}

// ─────────────────────────────────────────────────────────────
// DEMANDES (partenariats + contact) — admin/editor
// ─────────────────────────────────────────────────────────────

export async function setRequestStatus(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) return deniedState(guard.denied);

  const parsed = requestStatusSchema.safeParse({
    type: formData.get("type"),
    id: formData.get("id"),
    status: formData.get("status"),
    admin_note: formData.get("admin_note") ?? "",
  });
  if (!parsed.success) {
    return errorState("Données invalides.", zodFieldErrors(parsed.error));
  }

  const result = await updateRequestStatus({
    type: parsed.data.type,
    id: parsed.data.id,
    status: parsed.data.status,
    adminNote: parsed.data.admin_note ?? null,
  });
  if (!result.ok) {
    console.error("[actions/admin] setRequestStatus :", result.error);
    return errorState("Mise à jour impossible.");
  }

  revalidatePath("/admin/demandes");
  return successState("Statut mis à jour.");
}

// ─────────────────────────────────────────────────────────────
// UTILISATEURS — admin UNIQUEMENT
// ─────────────────────────────────────────────────────────────

export async function changeRole(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const guard = await requireRole(["admin"]);
  if ("denied" in guard) return deniedState(guard.denied);

  const parsed = roleChangeSchema.safeParse({
    profile_id: formData.get("profile_id"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return errorState("Données invalides.", zodFieldErrors(parsed.error));
  }
  if (parsed.data.profile_id === guard.session.userId) {
    return errorState("Modifiez votre rôle depuis un autre compte admin pour éviter tout blocage.");
  }

  const result = await updateProfileRole(parsed.data.profile_id, parsed.data.role);
  if (!result.ok) {
    console.error("[actions/admin] changeRole :", result.error);
    return errorState("Changement de rôle impossible.");
  }

  revalidatePath("/admin/utilisateurs");
  return successState("Rôle mis à jour.");
}

export async function inviteUser(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const guard = await requireRole(["admin"]);
  if ("denied" in guard) return deniedState(guard.denied);

  const parsed = inviteUserSchema.safeParse({
    email: formData.get("email"),
    full_name: formData.get("full_name"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return errorState("Veuillez corriger les champs signalés.", zodFieldErrors(parsed.error));
  }

  const result = await inviteTeamMember(parsed.data.email, parsed.data.full_name, parsed.data.role);
  if (!result.ok) {
    if (result.error === "service_role_not_configured") {
      return errorState(
        "L'invitation exige la clé service_role sur le serveur (SUPABASE_SERVICE_ROLE_KEY). Voir supabase/README-CONFIGURATION.md."
      );
    }
    console.error("[actions/admin] inviteUser :", result.error);
    return errorState("Invitation impossible. Vérifiez l'adresse email.");
  }

  revalidatePath("/admin/utilisateurs");
  return successState("Invitation envoyée. Le membre apparaîtra après acceptation.");
}

export async function setUserDisabled(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const guard = await requireRole(["admin"]);
  if ("denied" in guard) return deniedState(guard.denied);

  const userId = String(formData.get("user_id") ?? "");
  const disable = formData.get("disable") === "1";
  if (!userId) return errorState("Utilisateur introuvable.");
  if (userId === guard.session.userId) {
    return errorState("Vous ne pouvez pas désactiver votre propre compte.");
  }

  const result = disable ? await disableTeamMember(userId) : await enableTeamMember(userId);
  if (!result.ok) {
    if (result.error === "service_role_not_configured") {
      return errorState(
        "Cette action exige la clé service_role sur le serveur (SUPABASE_SERVICE_ROLE_KEY)."
      );
    }
    console.error("[actions/admin] setUserDisabled :", result.error);
    return errorState(disable ? "Désactivation impossible." : "Réactivation impossible.");
  }

  revalidatePath("/admin/utilisateurs");
  return successState(disable ? "Compte désactivé." : "Compte réactivé.");
}

// ─────────────────────────────────────────────────────────────
// MÉDIATHÈQUE — admin/editor ; uploads via service_role serveur
// ─────────────────────────────────────────────────────────────

export async function uploadMediaAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) return deniedState(guard.denied);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return errorState("Sélectionnez une image à téléverser.");
  }

  const result = await uploadMedia(file);
  if (!result.ok) {
    console.error("[actions/admin] uploadMediaAction :", result.error);
    return errorState(result.error === "storage_not_configured"
      ? "Le stockage n'est pas configuré (SUPABASE_SERVICE_ROLE_KEY). Voir supabase/README-CONFIGURATION.md."
      : `Téléversement refusé : ${result.error}`);
  }

  revalidatePath("/admin/medias");
  return successState("Image téléversée.");
}

export async function deleteMediaAction(formData: FormData): Promise<ActionState> {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) return deniedState(guard.denied);

  const path = String(formData.get("path") ?? "");
  if (!path.startsWith("uploads/")) {
    return errorState("Chemin refusé.");
  }

  const result = await deleteMedia(path);
  if (!result.ok) {
    console.error("[actions/admin] deleteMediaAction :", result.error);
    return errorState("Suppression impossible.");
  }

  revalidatePath("/admin/medias");
  return successState("Fichier supprimé.");
}