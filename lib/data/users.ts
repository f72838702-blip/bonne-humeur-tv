import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Profile, UserRole } from "@/lib/types";
import { sanitizePermissions, type PermissionKey } from "@/lib/auth/permissions";

/**
 * Gestion des administrateurs (mission multi-administrateurs 0036).
 * — Les requêtes `profiles` passent par le client authentifié : la RLS
 *   limite la lecture/écriture (super_admin/admin) et VERROUILLE super_admin
 *   (triggers SQL : rôle/permissions/statut immuables, dernier admin protégé).
 * — Les opérations Auth (invitation, ban, suppression) exigent service_role :
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

export interface TeamEntry extends Profile {
  /** E-mail du compte Auth (jamais dans profiles) — null si introuvable. */
  email: string | null;
  /** Invitation en attente : le compte n'a jamais accepté l'e-mail. */
  invitation_pending: boolean;
  /** Dernière connexion Auth (si disponible). */
  last_sign_in_at: string | null;
}

/**
 * Liste complète de l'équipe : profils (RLS) + comptes Auth (service_role,
 * serveur uniquement — e-mail, statut d'invitation, dernière connexion).
 */
export async function getTeamEntries(): Promise<TeamEntry[]> {
  const profiles = await getProfiles();
  if (profiles.length === 0) return [];

  const admin = getSupabaseAdminClient();
  if (!admin) {
    // Dégradation honnête : profils seuls, sans e-mail/statut Auth.
    return profiles.map((p) => ({
      ...p,
      email: null,
      invitation_pending: false,
      last_sign_in_at: null,
    }));
  }

  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) {
    console.error("[data/users] listUsers :", error.message);
    return profiles.map((p) => ({
      ...p,
      email: null,
      invitation_pending: false,
      last_sign_in_at: null,
    }));
  }

  const byId = new Map(
    (data.users ?? []).map((u) => [
      u.id,
      {
        email: u.email ?? null,
        // Invitation en attente : l'utilisateur n'a jamais confirmé/accepté
        // (email_confirmed_at vide) OU jamais connecté.
        invitation_pending: !u.email_confirmed_at && !u.last_sign_in_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
      },
    ])
  );

  return profiles.map((p) => {
    const auth = byId.get(p.id);
    return {
      ...p,
      email: auth?.email ?? null,
      invitation_pending: auth?.invitation_pending ?? false,
      last_sign_in_at: auth?.last_sign_in_at ?? null,
    };
  });
}

/** Changement de rôle — super_admin/admin, verrouillé par RLS + triggers SQL. */
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

/** Modification des permissions (liste blanche normalisée) — super_admin. */
export async function updateProfilePermissions(
  profileId: string,
  permissions: string[]
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_not_configured" };

  const clean = sanitizePermissions(permissions) as string[];
  const { error } = await supabase
    .from("profiles")
    .update({ permissions: clean })
    .eq("id", profileId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Suspension RÉELLE : ban Auth (plus de connexion) + is_active = false. */
export async function suspendTeamMember(
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false, error: "service_role_not_configured" };

  const { error: authError } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: "87600h",
  });
  if (authError && !isBanAlreadyApplied(authError)) {
    return { ok: false, error: authError.message };
  }

  // is_active = false : le TRIGGER SQL refusera la modification
  // du propre compte de l'auteur — c'est le filet anti-suspension de soi.
  const { data: self } = await admin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (self) {
    const { error } = await admin
      .from("profiles")
      .update({ is_active: false })
      .eq("id", userId);
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true };
}

function isBanAlreadyApplied(error: { message: string }): boolean {
  // Un compte déjà banni refuse le second ban : non bloquant.
  return /already banned/i.test(error.message);
}

/** Réactivation : ban levé + is_active = true. */
export async function reactiveTeamMember(
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false, error: "service_role_not_configured" };

  const { error: authError } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: "none",
  });
  if (authError && !isBanAlreadyApplied(authError)) {
    return { ok: false, error: authError.message };
  }

  const { error } = await admin
    .from("profiles")
    .update({ is_active: true })
    .eq("id", userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Invitation d'un membre : création du compte Auth + e-mail de sécurité.
 * (mécanisme Supabase EXISTANT — jamais de mot de passe en clair).
 * Rôle appliqué en service_role juste après ; permissions de la même façon.
 */
export async function inviteTeamMember(
  email: string,
  fullName: string,
  role: UserRole,
  permissions: string[] = []
): Promise<{ ok: boolean; error?: string; userId?: string | null }> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false, error: "service_role_not_configured" };

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
  });
  if (error) return { ok: false, error: error.message };

  // Le trigger handle_new_user crée le profil 'reporter' à l'acceptation.
  // Le rôle ET les permissions demandés sont appliqués ensuite par le
  // super admin (traçés dans audit_logs).
  if (data.user) {
    if (role !== "reporter") {
      const { error: roleError } = await admin
        .from("profiles")
        .update({ role })
        .eq("id", data.user.id);
      if (roleError) return { ok: true, error: `rôle: ${roleError.message}` };
    }
    const clean = sanitizePermissions(permissions) as string[];
    if (clean.length > 0) {
      const { error: permError } = await admin
        .from("profiles")
        .update({ permissions: clean })
        .eq("id", data.user.id);
      if (permError) return { ok: true, error: `permissions: ${permError.message}` };
    }
  }
  return { ok: true, userId: data.user?.id ?? null };
}

/** Suppression DÉFINITIVE du compte (cascade profil) — avec confirmation côté UI. */
export async function deleteTeamMember(
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false, error: "service_role_not_configured" };

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Trace applicative d'une action de gestion (invite, etc.) dans audit_logs. */
export async function logTeamAction(
  action: string,
  entity: "profiles" | "auth",
  entityId: string | null,
  details: Record<string, unknown>
): Promise<void> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return;
  const { error } = await supabase.from("audit_logs").insert({
    action,
    entity,
    entity_id: entityId,
    details,
  });
  if (error) console.error("[data/users] audit :", error.message);
}
