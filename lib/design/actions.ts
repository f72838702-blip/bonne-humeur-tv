"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isSuperAdmin, getSessionInfo } from "@/lib/auth/session";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { errorState, successState, type ActionState } from "@/lib/actions/helpers";
import { designConfigSchema, parseDesignConfig, type DesignConfig } from "./schema";

/**
 * ACTIONS STUDIO DE DESIGN — le navigateur n'est JAMAIS une source de
 * vérité : chaque action revérifie session + rôle côté serveur
 * (règle maison), revalide le schéma fermé, puis écrit via le client
 * service_role (côté serveur seulement, jamais exposé).
 *   Mission 0036 : le Studio (design du site public) est réservé au
 *   SUPER ADMINISTRATEUR — brouillon, publication, restauration.
 */

export async function saveDraftAction(config: DesignConfig): Promise<ActionState> {
  const allowed = await isSuperAdmin();
  if (!allowed) {
    return errorState("Le Studio est réservé au Super Administrateur.");
  }
  // Session déjà validée par isSuperAdmin() : l'auteur du brouillon = PDG.
  const session = await getSessionInfo();
  const actorId = session?.userId;
  if (!actorId) return errorState("Connectez-vous à l'administration.");
  const validation = designConfigSchema.safeParse(config);
  if (!validation.success) {
    return errorState("Design invalide — des valeurs sont hors liste autorisée.");
  }
  const admin = getSupabaseAdminClient();
  if (!admin) return errorState("Base injoignable — réessayez.");

  // Un brouillon par admin/éditeur — upsert sur sa clé. Le contenu du
  // brouillon reste celui de la config VALIDÉE (jamais du texte brut).
  const { error } = await admin.from("site_design_draft").upsert({
    updated_by: actorId,
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
  const allowed = await isSuperAdmin();
  if (!allowed) {
    return errorState("Seul le Super Administrateur peut publier le design.");
  }
  const actorId = (await getSessionInfo())?.userId;
  if (!actorId) return errorState("Connectez-vous à l'administration.");
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
    .update({ published: parsed.data.draft, updated_by: actorId })
    .eq("id", 1);
  if (pubErr) return errorState("Publication refusée — réessayez.");

  // 3) Historique : le design PRÉCÉDENT (restorable), jamais un snapshot vide.
  if (previous !== null && previous !== undefined) {
    await admin.from("site_design_versions").insert({
      snapshot: previous,
      published_by: actorId,
      note: parsed.data.note ?? "Version précédente du design",
    });
  }

  // 4) Brouillon consommé (il est devenu le design publié).
  await admin.from("site_design_draft").delete().eq("updated_by", actorId);

  // 5) Le site public change MAINTENANT — invalidation ISR complète.
  revalidatePath("/", "layout");
  return successState("Design publié — le site public est mis à jour.");
}

export async function restoreDesignAction(versionId: string): Promise<ActionState> {
  const allowed = await isSuperAdmin();
  if (!allowed) {
    return errorState("Seul le Super Administrateur peut restaurer le design.");
  }
  const actorId = (await getSessionInfo())?.userId;
  if (!actorId) return errorState("Connectez-vous à l'administration.");
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
    .upsert({ updated_by: actorId, content: snapshot });
  if (upErr) return errorState("Restauration impossible — réessayez.");
  return successState("Ancien design chargé en brouillon — prévisualisez puis publiez.");
}
