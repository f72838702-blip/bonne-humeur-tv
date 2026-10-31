import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Profile, UserRole } from "@/lib/types";

/**
 * Gestion des utilisateurs de l'équipe (table profiles + Auth Supabase).
 * — Les requêtes `profiles` passent par le client authentifié : la RLS
 *   limite la lecture/écriture (admin/editor) et VERROUILLE les rôles.
 * — Les opérations Auth (invitation, désactivation) exigent service_role :
 *   elles échouent honnêtement si SUPABASE_SERVICE_ROLE_KEY n'est pas configurée.
 */

export async function getProfiles(): Promise<Profile[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[data/users] getProfiles :", error.message);
    return [];
  }
  return (data ?? []) as Profile[];
}

/** Changement de rôle — réservé aux admins, appliqué par la RLS. */
export async function updateProfileRole(
  profileId: string,
  role: UserRole
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_not_configured" };

  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", profileId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Invitation d'un membre : création du compte Auth + email d'invitation.
 * Nécessite SUPABASE_SERVICE_ROLE_KEY (serveur uniquement).
 */
export async function inviteTeamMember(
  email: string,
  fullName: string,
  role: UserRole
): Promise<{ ok: boolean; error?: string }> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false, error: "service_role_not_configured" };

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
  });
  if (error) return { ok: false, error: error.message };

  // Le trigger handle_new_user crée le profil 'reporter' à l'acceptation.
  // Le rôle demandé est appliqué ensuite par un admin (traçé par audit_logs).
  if (role !== "reporter" && data.user) {
    await admin.from("profiles").update({ role }).eq("id", data.user.id);
  }
  return { ok: true };
}

/** Désactivation d'un compte (interdit la connexion) — service_role requis. */
export async function disableTeamMember(
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false, error: "service_role_not_configured" };

  const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: "87600h" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Réactivation d'un compte — service_role requis. */
export async function enableTeamMember(
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false, error: "service_role_not_configured" };

  const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: "none" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}