"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { errorState, successState, type ActionState } from "@/lib/actions/helpers";
import { designConfigSchema, parseDesignConfig, type DesignConfig } from "./schema";

/**
 * ACTIONS STUDIO DE DESIGN — le navigateur n'est JAMAIS une source de
 * vérité : chaque action revérifie session + rôle côté serveur
 * (règle maison), revalide le schéma fermé, puis écrit via le client
 * service_role (côté serveur seulement, jamais exposé).
 *   Éditer / enregistrer le brouillon : admin + éditeur.
 *   Publier / restaurer               : ADMIN SEUL.
 */

export async function saveDraftAction(config: DesignConfig): Promise<ActionState> {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) {
    return guard.denied === "unauthenticated"
      ? errorState("Session expirée — reconnectez-vous.")
      : errorState("Accès réservé à la rédaction.");
  }
  const validation = designConfigSchema.safeParse(config);
  if (!validation.success) {
    return errorState("Design invalide — des valeurs sont hors liste autorisée.");
  }
  const admin = getSupabaseAdminClient();
  if (!admin) return errorState("Base injoignable — réessayez.");

  // Un brouillon par admin/éditeur — upsert sur sa clé. Le contenu du
  // brouillon reste celui de la config VALIDÉE (jamais du texte brut).
  const { error } = await admin.from("site_design_draft").upsert({
    updated_by: guard.session.userId,
    content: validation.data,
  });
  if (error) return errorState("Brouillon non enregistré — réessayez.");
  return successState("Brouillon enregistré.");
}

const publishActionSchema = z.object({
  draft: designConfigSchema.nullable(),
  /** Reprise d'un ancien design : note historique informative. */
  note: z.string().trim().max(120).optional(),
});

export async function publishDesignAction(
  draft: DesignConfig,
  note?: string,
): Promise<ActionState> {
  const guard = await requireRole(["admin"]);
  if ("denied" in guard) {
    return guard.denied === "unauthenticated"
      ? errorState("Session expirée — reconnectez-vous.")
      : errorState("Seul un administrateur peut publier le design.");
  }
  const parsed = publishActionSchema.safeParse({ draft, note });
  if (!parsed.success) {
    return errorState("Design invalide — la publication est refusée.");
  }
  const admin = getSupabaseAdminClient();
  if (!admin) return errorState("Base injoignable — réessayez.");

  // 1) Snapshot de l'ancien design publié (historique immuable) —
  //    si published était null (défaut), on n'archive rien.
  const { data: current } = await admin
    .from("site_design")
    .select("published")
    .eq("id", 1)
    .maybeSingle();
  const previous = (current as { published: unknown } | null)?.published ?? null;

  // 2) Publication (brouillon null = retour au thème par défaut).
  const { error: pubErr } = await admin
    .from("site_design")
    .update({ published: parsed.data.draft, updated_by: guard.session.userId })
    .eq("id", 1);
  if (pubErr) return errorState("Publication refusée — réessayez.");

  // 3) Historique : le design PRÉCÉDENT (restorable), jamais un snapshot vide.
  if (previous !== null && previous !== undefined) {
    await admin.from("site_design_versions").insert({
      snapshot: previous,
      published_by: guard.session.userId,
      note: parsed.data.note ?? "Version précédente du design",
    });
  }

  // 4) Brouillon consommé (il est devenu le design publié).
  await admin.from("site_design_draft").delete().eq("updated_by", guard.session.userId);

  // 5) Le site public change MAINTENANT — invalidation ISR complète.
  revalidatePath("/", "layout");
  return successState("Design publié — le site public est mis à jour.");
}

export async function restoreDesignAction(versionId: string): Promise<ActionState> {
  const guard = await requireRole(["admin"]);
  if ("denied" in guard) {
    return guard.denied === "unauthenticated"
      ? errorState("Session expirée — reconnectez-vous.")
      : errorState("Seul un administrateur peut restaurer le design.");
  }
  // Id strictement numérique (séquence Postgres) — aucun autre format.
  if (!/^[0-9]+$/.test(versionId)) return errorState("Historique invalide.");
  const admin = getSupabaseAdminClient();
  if (!admin) return errorState("Base injoignable — réessayez.");

  const { data: version, error } = await admin
    .from("site_design_versions")
    .select("snapshot")
    .eq("id", Number(versionId))
    .maybeSingle();
  if (error || !version) return errorState("Historique introuvable.");

  const snapshot = parseDesignConfig((version as { snapshot: unknown }).snapshot);
  if (!snapshot) return errorState("Historique illisible — restauration refusée.");

  // Restauration : l'ancien design REPART en brouillon (le PDG le
  // prévisualise puis publie) — jamais de retour arrière à l'aveugle.
  const { error: upErr } = await admin
    .from("site_design_draft")
    .upsert({ updated_by: guard.session.userId, content: snapshot });
  if (upErr) return errorState("Restauration impossible — réessayez.");
  return successState("Ancien design chargé en brouillon — prévisualisez puis publiez.");
}
