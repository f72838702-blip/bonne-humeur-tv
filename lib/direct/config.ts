import { getSupabasePublicClient, getSupabaseServerClient } from "@/lib/supabase/server";
import { extractYouTubeId } from "@/lib/youtube/url";
import type { DirectMode, LiveConfig } from "@/lib/direct/core";

/**
 * Accès à la configuration du direct (table live_config — migration 0031).
 * • Lecture publique : via le client public (RLS select anon — la ligne ne
 *   contient que des paramètres d'affichage publics) — défaut désactivé.
 * • Écriture : Server Actions admin uniquement (client de session ; RLS
 *   `has_role('admin')` en dernier ressort).
 * • L'ID YouTube vient TOUJOURS de extractYouTubeId (lib existante) : une
 *   URL arbitraire externe ne peut jamais devenir une source de lecteur.
 */

interface RawConfig {
  enabled: boolean;
  mode: string | null;
  manual_video_id: string | null;
  replay_video_id: string | null;
  last_state: string | null;
  last_checked_at: string | null;
}

function toConfig(row: RawConfig | null | undefined): LiveConfig {
  const mode = row?.mode;
  return {
    enabled: row?.enabled ?? false,
    mode: mode === "manual" || mode === "off" ? mode : "auto",
    manualVideoId: row?.manual_video_id ?? null,
    replayVideoId: row?.replay_video_id ?? null,
    lastState:
      row?.last_state === "live" ||
      row?.last_state === "unconfigured" ||
      row?.last_state === "none" ||
      row?.last_state === "error"
        ? row.last_state
        : null,
    lastCheckedAt: row?.last_checked_at ?? null,
  };
}

export async function getLiveConfig(): Promise<LiveConfig> {
  const supabase = getSupabasePublicClient();
  if (!supabase) return toConfig(null);
  const { data } = await supabase
    .from("live_config")
    .select("*")
    .eq("id", "default")
    .maybeSingle();
  return toConfig(data as RawConfig | null);
}

/** Normalise une saisie (URL YouTube ou ID brut) → ID à 11 caractères | null. */
export function normalizeVideoInput(input: string): string | null {
  return extractYouTubeId(input);
}

/** Données validées prêtes à être enregistrées (aucun champ brut). */
export interface DirectConfigInput {
  enabled: boolean;
  mode: DirectMode;
  manualVideoId: string | null;
  replayVideoId: string | null;
}

export function parseDirectConfigFormData(formData: FormData): DirectConfigInput {
  const mode = String(formData.get("mode") ?? "auto");
  return {
    enabled: formData.get("enabled") === "on" || formData.get("enabled") === "true",
    mode: mode === "manual" || mode === "off" ? mode : "auto",
    manualVideoId: normalizeVideoInput(String(formData.get("manual_url") ?? "")),
    replayVideoId: normalizeVideoInput(String(formData.get("replay_url") ?? "")),
  };
}
