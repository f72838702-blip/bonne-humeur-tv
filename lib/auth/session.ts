import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/lib/types";
import {
  effectivePermissions,
  hasAnyPermission,
  hasPermission,
  type PermissionKey,
} from "@/lib/auth/permissions";

export interface SessionInfo {
  userId: string;
  email: string | null;
  profile: Profile | null;
}

/**
 * Session + profil de l'utilisateur connecté.
 * Retourne null si non connecté OU backend non configuré :
 * les pages d'administration affichent alors un état explicite.
 */
export async function getSessionInfo(): Promise<SessionInfo | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return {
    userId: user.id,
    email: user.email ?? null,
    profile: (profile as Profile) ?? null,
  };
}

/** Le compte est utilisable : profil présent ET actif (0036). */
export function isUsableProfile(profile: Profile | null | undefined): boolean {
  return Boolean(profile && profile.is_active !== false);
}

/**
 * Garde serveur pour les pages/actions d'administration.
 * Vérifie la session ET le rôle — jamais uniquement l'UI.
 * Règle 0036 : le super_admin passe partout où « admin » est exigé,
 * un compte suspendu (is_active = false) ne passe nulle part.
 */
export async function requireRole(
  roles: UserRole[]
): Promise<{ session: SessionInfo } | { denied: "unauthenticated" | "forbidden" | "unconfigured" }> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { denied: "unconfigured" };

  const session = await getSessionInfo();
  if (!session) return { denied: "unauthenticated" };
  const { profile } = session;
  if (!profile || !isUsableProfile(profile)) return { denied: "forbidden" };

  const allowed =
    roles.includes(profile.role) ||
    (roles.includes("admin") && profile.role === "super_admin");
  if (!allowed) return { denied: "forbidden" };
  return { session };
}

/**
 * Garde serveur par PERMISSION (mission multi-administrateurs) :
 * super_admin/admin → tout ; editor → clé cochée sur son profil.
 * Appelée par chaque Server Action sensible — masquer un bouton ne
 * suffit jamais.
 */
export async function requirePermission(
  key: PermissionKey
): Promise<{ session: SessionInfo } | { denied: "unauthenticated" | "forbidden" | "unconfigured" }> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { denied: "unconfigured" };

  const session = await getSessionInfo();
  if (!session) return { denied: "unauthenticated" };
  if (!session.profile || !isUsableProfile(session.profile)) {
    return { denied: "forbidden" };
  }
  if (!hasPermission(session.profile, key)) return { denied: "forbidden" };
  return { session };
}

/** Variante : au moins UNE des permissions listées. */
export async function requireAnyPermission(
  keys: readonly PermissionKey[]
): Promise<{ session: SessionInfo } | { denied: "unauthenticated" | "forbidden" | "unconfigured" }> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { denied: "unconfigured" };

  const session = await getSessionInfo();
  if (!session) return { denied: "unauthenticated" };
  if (!session.profile || !isUsableProfile(session.profile)) {
    return { denied: "forbidden" };
  }
  if (!hasAnyPermission(session.profile, keys)) return { denied: "forbidden" };
  return { session };
}

export async function isAdmin(): Promise<boolean> {
  const session = await getSessionInfo();
  const role = session?.profile?.role;
  return role === "admin" || role === "super_admin";
}

/** Super Administrateur — gestion des comptes, Studio, paramètres. */
export async function isSuperAdmin(): Promise<boolean> {
  const session = await getSessionInfo();
  return session?.profile?.role === "super_admin" && isUsableProfile(session.profile);
}

/** Permissions effectives de la session courante (mémoire optimisée UI). */
export async function currentPermissions(): Promise<PermissionKey[]> {
  const session = await getSessionInfo();
  return effectivePermissions(session?.profile ?? null);
}
