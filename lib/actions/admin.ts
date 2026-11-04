"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import {
  inviteUserSchema,
  requestDeleteSchema,
  requestStatusSchema,
  roleChangeSchema,
  sendReplySchema,
} from "@/lib/validation/schemas";
import {
  ActionState,
  errorState,
  successState,
  zodFieldErrors,
} from "./helpers";
import { disableTeamMember, enableTeamMember, inviteTeamMember, updateProfileRole } from "@/lib/data/users";
import { deleteRequest, updateRequestStatus } from "@/lib/data/requests";
import { getRequestRecipient, insertFailedReply, insertSentReply } from "@/lib/data/replies";
import { isBrevoConfigured, sendEmailViaBrevo } from "@/lib/email/brevo";
import { buildReplySubject, isPlausibleEmail, type ReplyRequestType } from "@/lib/replies-core";
import { deleteMedia, uploadMediaVariants } from "@/lib/data/media";
import { MEDIA_PURPOSES, MEDIA_VARIANTS, MediaPurpose, MediaVariant } from "@/lib/media/variants";

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

/**
 * Suppression DÉFINITIVE d'une demande/message — ADMIN UNIQUEMENT
 * (requireRole admin + policy DELETE 0027 en dernière barrière : un
 * éditeur, même avec l'URL, est refusé par la base). Confirmation gérée
 * par DeleteActionForm côté interface ; jamais déclenchée par une
 * simple consultation.
 */
export async function deleteRequestAction(
  formData: FormData
): Promise<ActionState> {
  const guard = await requireRole(["admin"]);
  if ("denied" in guard) return deniedState(guard.denied);

  const parsed = requestDeleteSchema.safeParse({
    type: formData.get("type"),
    id: formData.get("id"),
  });
  if (!parsed.success) return errorState("Données invalides.");

  const result = await deleteRequest({
    type: parsed.data.type,
    id: parsed.data.id,
  });
  if (!result.ok) {
    console.error("[actions/admin] deleteRequestAction :", result.error);
    return errorState("Suppression impossible.");
  }

  // Liste + compteurs (sidebar, tableau de bord) immédiatement à jour.
  revalidatePath("/admin/demandes");
  revalidatePath("/admin");
  return successState("Supprimé.");
}

/**
 * Envoyer une réponse à une demande/message — ADMIN UNIQUEMENT
 * (requireRole admin ; la policy INSERT 0028 réapplique la règle en
 * dernier ressort). SÉCURITÉ :
 *  - le destinataire provient UNIQUEMENT de la base (requestDeleteSchema
 *    ne transporte pas d'e-mail : aucun envoi vers une adresse arbitraire) ;
 *  - l'envoi part du serveur (clé Brevo jamais exposée au navigateur) ;
 *  - « envoyée » n'est enregistré QUE si Brevo accepte le message (2xx) :
 *    en échec, la tentative est historisée avec status='failed' et l'erreur
 *    s'affiche — le texte rédigé reste dans le formulaire (contrôlé React).
 */
export async function sendReplyAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const guard = await requireRole(["admin"]);
  if ("denied" in guard) return deniedState(guard.denied);

  const parsed = sendReplySchema.safeParse({
    type: formData.get("type"),
    id: formData.get("id"),
    body: formData.get("body") ?? "",
  });
  if (!parsed.success) {
    return errorState("Veuillez corriger les champs signalés.", zodFieldErrors(parsed.error));
  }

  const parent = await getRequestRecipient({
    type: parsed.data.type,
    id: parsed.data.id,
  });
  if (!parent.ok || !parent.email || !isPlausibleEmail(parent.email)) {
    return errorState("Demande introuvable ou adresse de destination invalide.");
  }

  if (!isBrevoConfigured()) {
    return errorState(
      "L'envoi d'e-mails n'est pas encore configuré sur le serveur (clé Brevo). Voir le rapport de la direction."
    );
  }

  const result = await sendEmailViaBrevo({
    recipientEmail: parent.email,
    subject: buildReplySubject(parsed.data.type, parent.subject ?? null),
    body: parsed.data.body,
  });

  if (!result.ok) {
    console.error("[actions/admin] sendReplyAction :", result.error);
    await insertFailedReply({
      type: parsed.data.type,
      requestId: parsed.data.id,
      recipientEmail: parent.email,
      body: parsed.data.body,
      senderProfileId: guard.session.profile?.id ?? null,
      error: result.error,
    });
    return errorState(`Envoi refusé — veuillez réessayer. Détail : ${result.error}`);
  }

  const recorded = await insertSentReply({
    type: parsed.data.type as ReplyRequestType,
    requestId: parsed.data.id,
    recipientEmail: parent.email,
    body: parsed.data.body,
    senderProfileId: guard.session.profile?.id ?? null,
    providerMessageId: result.messageId,
  });
  if (!recorded) {
    // E-mail parti mais historique refusé : on l'affiche honnêtement plutôt
    // qu'un succès trompeur — l'admin peut recopier la réponse si besoin.
    console.error("[actions/admin] sendReplyAction : historique refusé par la base");
    return errorState(
      "Le message a été accepté par le fournisseur, mais son enregistrement dans l'historique a échoué. Réessayez uniquement s'il faut le renvoyer."
    );
  }

  revalidatePath("/admin/demandes");
  return successState(`Réponse envoyée à ${parent.email}.`);
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

  // Dossier logique de destination (directive §2).
  const purpose = String(formData.get("purpose") ?? "");
  if (!(MEDIA_PURPOSES as readonly string[]).includes(purpose)) {
    return errorState("Choisissez un dossier de destination.");
  }

  // Variantes pré-comprimées par le navigateur (clés file_full, file_card…).
  const variants: { variant: MediaVariant; file: File }[] = [];
  for (const v of MEDIA_VARIANTS) {
    const entry = formData.get(`file_${v}`);
    if (entry instanceof File && entry.size > 0) variants.push({ variant: v, file: entry });
  }
  if (variants.length === 0) {
    return errorState("Sélectionnez une image à téléverser.");
  }

  const result = await uploadMediaVariants(purpose as MediaPurpose, variants);
  if (!result.ok) {
    console.error("[actions/admin] uploadMediaAction :", result.error);
    return errorState(result.error === "storage_not_configured"
      ? "Le stockage n'est pas configuré (SUPABASE_SERVICE_ROLE_KEY). Voir supabase/README-CONFIGURATION.md."
      : `Téléversement refusé : ${result.error}`);
  }

  revalidatePath("/admin/medias");
  return successState(
    `Image téléversée (${variants.length} variante${variants.length > 1 ? "s" : ""} compressée${variants.length > 1 ? "s" : ""}).`
  );
}

export async function deleteMediaAction(formData: FormData): Promise<ActionState> {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) return deniedState(guard.denied);

  const path = String(formData.get("path") ?? "");
  // Le chemin est revalidé dans deleteMedia (dossier autorisé, sans «..»).
  const result = await deleteMedia(path);
  if (!result.ok) {
    console.error("[actions/admin] deleteMediaAction :", result.error);
    return errorState("Suppression impossible.");
  }

  revalidatePath("/admin/medias");
  return successState("Fichier supprimé.");
}

// ─────────────────────────────────────────────────────────────
// COUVERTURE D'ARTICLE — appelée directement par le formulaire
// d'article (ArticleForm). Même pipeline que la médiathèque :
// compression navigateur + revalidation serveur (signature, MIME,
// dimensions, poids) + upload service_role CÔTÉ SERVEUR uniquement.
// ─────────────────────────────────────────────────────────────

/**
 * Téléverse la couverture d'un article (dossier logique « articles »
 * exclusivement) et renvoie l'URL publique réelle (variante pleine) pour
 * préremplir le champ featured_image du formulaire.
 *
 * Rôles : identiques à saveArticle (admin, editor, reporter) — un reporter
 * ajoute une couverture à SON article, comme la médiathèque l'exigeait
 * pour editor+ uniquement. Le service_role n'est jamais exposé au
 * navigateur : l'upload part de ce module serveur seulement.
 */
export async function uploadArticleCoverAction(
  formData: FormData
): Promise<ActionState> {
  const guard = await requireRole(["admin", "editor", "reporter"]);
  if ("denied" in guard) return deniedState(guard.denied);

  const variants: { variant: MediaVariant; file: File }[] = [];
  for (const v of MEDIA_VARIANTS) {
    const entry = formData.get(`file_${v}`);
    if (entry instanceof File && entry.size > 0) variants.push({ variant: v, file: entry });
  }
  if (variants.length === 0) {
    return errorState("Aucune image compressée à téléverser.");
  }

  const result = await uploadMediaVariants("articles", variants);
  if (!result.ok) {
    console.error("[actions/admin] uploadArticleCoverAction :", result.error);
    return errorState(
      result.error === "storage_not_configured"
        ? "Le stockage n'est pas configuré (SUPABASE_SERVICE_ROLE_KEY)."
        : `Téléversement refusé : ${result.error}`
    );
  }

  return {
    status: "success",
    message: "Image téléversée.",
    // successState ne transporte pas de données → état complet explicite
    // (même mécanisme que importYouTubeMeta).
    data: {
      url: result.url ?? null,
      variants: result.variants?.join(" ") ?? null,
    },
  };
}