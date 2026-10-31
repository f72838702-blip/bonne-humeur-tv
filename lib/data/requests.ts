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