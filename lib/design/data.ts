import { cache } from "react";
import { getSupabasePublicClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseDesignConfig } from "./schema";
import { DEFAULT_DESIGN } from "./default";
import type { DesignConfig } from "./schema";

/**
 * Données du design — LECTURES DÉGRADABLES (le site public ne casse
 * jamais : table absente / base vide / Supabase non configuré = thème
 * par défaut). Le brouillon se lit avec le CLIENT ADMIN (service_role,
 * côté serveur uniquement) — le navigateur n'y a jamais accès.
 */

export interface PublishedDesign {
  config: DesignConfig | null; // null = thème par défaut du socle
  updatedAt: string | null;
}

export async function getPublishedDesign(): Promise<PublishedDesign> {
  try {
    const supabase = getSupabasePublicClient();
    if (!supabase) return { config: null, updatedAt: null };
    // Table mono-ligne (id=1)
    const { data, error } = await supabase
      .from("site_design")
      .select("published, updated_at")
      .eq("id", 1)
      .maybeSingle();
    if (error || !data) return { config: null, updatedAt: null };
    return {
      config: parseDesignConfig((data as { published: unknown }).published),
      updatedAt: (data as { updated_at: string | null })?.updated_at ?? null,
    };
  } catch {
    // Table pas encore migrée / réseau : repli défaut, jamais d'erreur page.
    return { config: null, updatedAt: null };
  }
}

/** Même requête dédupliquée par rendu (layout + page + preview). */
export const getPublishedDesignCached = cache(getPublishedDesign);

/** Brouillon d'UN utilisateur précis (chaque admin/éditeur a le sien). */
export async function getDraftForUser(
  userId: string,
): Promise<{ config: DesignConfig | null; updatedAt: string | null }> {
  try {
    const admin = getSupabaseAdminClient();
    if (!admin) return { config: null, updatedAt: null };
    const { data, error } = await admin
      .from("site_design_draft")
      .select("content, updated_at")
      .eq("updated_by", userId)
      .maybeSingle();
    if (error || !data) return { config: null, updatedAt: null };
    return {
      config: parseDesignConfig((data as { content: unknown }).content),
      updatedAt: (data as { updated_at: string | null })?.updated_at ?? null,
    };
  } catch {
    return { config: null, updatedAt: null };
  }
}

export async function getDraftDesign(): Promise<{
  config: DesignConfig | null;
  updatedAt: string | null;
}> {
  try {
    const admin = getSupabaseAdminClient();
    if (!admin) return { config: null, updatedAt: null };
    const { data, error } = await admin
      .from("site_design_draft")
      .select("content, updated_at")
      // Brouillon le plus récent (plusieurs rédacteurs possibles).
      .order("updated_at", { ascending: false })
      .limit(1);
    const row = (data as { content: unknown; updated_at: string | null }[] | null)?.[0];
    if (error || !row) return { config: null, updatedAt: null };
    return { config: parseDesignConfig(row.content), updatedAt: row.updated_at };
  } catch {
    return { config: null, updatedAt: null };
  }
}

export async function getDesignHistory(): Promise<
  { id: string; snapshot: unknown; note: string; createdAt: string }[]
> {
  try {
    const admin = getSupabaseAdminClient();
    if (!admin) return [];
    const { data, error } = await admin
      .from("site_design_versions")
      .select("id, snapshot, note, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error || !data) return [];
    return data.map((row) => ({
      id: String((row as { id: number }).id),
      snapshot: (row as { snapshot: unknown }).snapshot,
      note: (row as { note: string }).note,
      createdAt: (row as { created_at: string }).created_at,
    }));
  } catch {
    return [];
  }
}

/** Chemin de publication : config valide → config publiée. */
export function resolvePublished(
  raw: unknown,
): DesignConfig {
  return parseDesignConfig(raw) ?? DEFAULT_DESIGN;
}
