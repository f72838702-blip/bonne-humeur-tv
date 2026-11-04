/**
 * Noyau PUR de l'onglet « Demandes » — notifications intelligentes :
 * badge « Nouveau » / « Non lu » seulement pour ce qui n'a JAMAIS été
 * consulté (seen_at / read_at NULL), jamais pour l'ancien contenu.
 * Testable sans base ni session.
 */
import type { ContactMessage, PartnershipRequest } from "@/lib/types";

/** Compteur de notifications utile : demandes jamais vues. */
export function countUnseenPartnerships(list: PartnershipRequest[]): number {
  return list.filter((r) => !r.seen_at).length;
}

/** Compteur de notifications utile : messages jamais lus. */
export function countUnreadContacts(list: ContactMessage[]): number {
  return list.filter((m) => !m.read_at).length;
}

/** Ids à marquer vu/lu au rendu de la page (UNIQUEMENT les NULL — les
 *  éléments déjà consultés ne sont jamais réécrits). */
export function idsToMarkSeen(list: PartnershipRequest[]): string[] {
  return list.filter((r) => !r.seen_at).map((r) => r.id);
}

export function idsToMarkRead(list: ContactMessage[]): string[] {
  return list.filter((m) => !m.read_at).map((m) => m.id);
}