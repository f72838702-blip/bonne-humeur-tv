import { getSupabaseServerClient } from "@/lib/supabase/server";
import type {
  ContactMessage,
  PartnershipRequest,
  RequestStatus,
} from "@/lib/types";

/**
 * Demandes commerciales (partenariats + messages de contact).
 * Uniquement accessibles au staff authentifié — la RLS applique
 * la restriction côté base ; ces fonctions ne font que requêter.
 */

export async function getPartnershipRequests(): Promise<PartnershipRequest[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("partnership_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[data/requests] getPartnershipRequests :", error.message);
    return [];
  }
  return (data ?? []) as PartnershipRequest[];
}

export async function getContactMessages(): Promise<ContactMessage[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("contact_messages")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[data/requests] getContactMessages :", error.message);
    return [];
  }
  return (data ?? []) as ContactMessage[];
}

export async function updateRequestStatus(params: {
  type: "partnership" | "contact";
  id: string;
  status: RequestStatus;
  adminNote?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_not_configured" };

  const table =
    params.type === "partnership" ? "partnership_requests" : "contact_messages";

  const { error } = await supabase
    .from(table)
    .update({
      status: params.status,
      admin_note: params.adminNote ?? undefined,
      processed_at: params.status === "treated" ? new Date().toISOString() : null,
    })
    .eq("id", params.id);

  if (error) {
    console.error("[data/requests] updateRequestStatus :", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// NOTIFICATION LÉGÈRE pour la sidebar : 2 requêtes `count` (head, sans
// données) chaque ouverture de page admin staff — jamais de polling,
// jamais de Realtime (Supabase Free / Workers Free préservés).
// ─────────────────────────────────────────────────────────────

export interface DemandesNotificationCount {
  unseenPartnerships: number;
  unreadContacts: number;
}

export async function getDemandesNotificationCount(): Promise<DemandesNotificationCount> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { unseenPartnerships: 0, unreadContacts: 0 };

  const [partnerships, contacts] = await Promise.all([
    supabase.from("partnership_requests").select("id", { count: "exact", head: true }).is("seen_at", null),
    supabase.from("contact_messages").select("id", { count: "exact", head: true }).is("read_at", null),
  ]);

  return {
    unseenPartnerships: partnerships.count ?? 0,
    unreadContacts: contacts.count ?? 0,
  };
}

// ─────────────────────────────────────────────────────────────
// SUIVI DE LECTURE GLOBAL (0027) — notifie uniquement ce qui n'a jamais
// été consulté : une page Demandes ouverte marque VUS/ lus les éléments
// affichés (une seule UPDATE bornée aux ids à l'état NULL ; aucune
// écriture quand il n'y a rien de neuf → pas de notification répétée à
// chaque actualisation ni à chaque connexion).
// ─────────────────────────────────────────────────────────────

/** Marque les demandes de partenariat affichées comme vues (seen_at). */
export async function markPartnershipRequestsSeen(ids: string[]): Promise<boolean> {
  if (ids.length === 0) return true;
  const supabase = await getSupabaseServerClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from("partnership_requests")
    .update({ seen_at: new Date().toISOString() })
    .in("id", ids)
    .is("seen_at", null); // idempotent : jamais réécrit (pas d'horodatage écrasé)

  if (error) {
    console.error("[data/requests] markPartnershipRequestsSeen :", error.message);
    return false;
  }
  return true;
}

/** Marque les messages de contact affichés comme lus (read_at). */
export async function markContactMessagesRead(ids: string[]): Promise<boolean> {
  if (ids.length === 0) return true;
  const supabase = await getSupabaseServerClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from("contact_messages")
    .update({ read_at: new Date().toISOString() })
    .in("id", ids)
    .is("read_at", null);

  if (error) {
    console.error("[data/requests] markContactMessagesRead :", error.message);
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────
// SUPPRESSION — définitif, RÉSERVÉ ADMIN (policy 0027 + action requireRole
// admin) : purge les données personnelles de l'expéditeur ; l'opération
// reste journalisée dans audit_logs (trigger étendu à DELETE).
// ─────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function deleteRequest(params: {
  type: "partnership" | "contact";
  id: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!UUID_RE.test(params.id)) return { ok: false, error: "invalid_id" };

  const supabase = await getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_not_configured" };

  const table =
    params.type === "partnership" ? "partnership_requests" : "contact_messages";

  const { error } = await supabase.from(table).delete().eq("id", params.id);
  if (error) {
    console.error("[data/requests] deleteRequest :", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}