import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/lib/types";

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

/**
 * Garde serveur pour les pages/actions d'administration.
 * Vérifie la session ET le rôle — jamais uniquement l'UI.
 */
export async function requireRole(
  roles: UserRole[]
): Promise<{ session: SessionInfo } | { denied: "unauthenticated" | "forbidden" | "unconfigured" }> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { denied: "unconfigured" };

  const session = await getSessionInfo();
  if (!session) return { denied: "unauthenticated" };
  if (!session.profile || !roles.includes(session.profile.role)) {
    return { denied: "forbidden" };
  }
  return { session };
}

export async function isAdmin(): Promise<boolean> {
  const session = await getSessionInfo();
  return session?.profile?.role === "admin";
}