import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Journal d'activité (mission multi-administrateurs 0036) — lecture des
 * audit_logs, visible par le SUPER ADMINISTRATEUR uniquement :
 * la RLS « audit_logs_select » (0036) ne tolère que is_super_admin().
 * Aucune écriture ici : les traces sont produites par les triggers SQL
 * (audit_profile_delta / audit_profile_delete) et par logTeamAction.
 */

export interface AuditEntry {
  id: string;
  created_at: string;
  /** Nom de l'auteur (jointure profiles — null si compte supprimé). */
  actor_name: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  /** Détails libres (0001) : delta de rôle/permissions/statut pour profiles. */
  details: Record<string, unknown> | null;
}

export async function getAuditLogs(limit = 200): Promise<AuditEntry[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("audit_logs")
    .select("id, created_at, actor_id, action, entity, entity_id, details")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[data/audit] getAuditLogs :", error.message);
    return [];
  }

  // Noms des auteurs : jointure manuelle sur profiles (lecture RLS
  // admin/super) — un compte supprimé reste affiché « (compte supprimé) ».
  const actorIds = [
    ...new Set((data ?? []).map((r) => r.actor_id).filter((v): v is string => Boolean(v))),
  ];
  const names = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name");
    for (const p of profiles ?? []) {
      if (p.full_name) names.set(p.id, p.full_name);
    }
  }

  return (data ?? []).map((r) => ({
    id: r.id,
    created_at: r.created_at,
    actor_name: r.actor_id ? names.get(r.actor_id) ?? null : null,
    action: r.action,
    entity: r.entity,
    entity_id: r.entity_id,
    details: (r.details as Record<string, unknown> | null) ?? null,
  }));
}
