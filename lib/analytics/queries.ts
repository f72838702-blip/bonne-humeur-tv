import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { AnalyticsRow } from "@/lib/analytics/aggregate";

/**
 * Récupération des DONNÉES BRUTES de la période (le client connecté est
 * admin : la RLS 0029 ne renvoie QUE ce que la policy admin select autorise).
 * Les agrégats sont ensuite calculés en pur (lib/analytics/aggregate.ts).
 *
 * Ce modèle agrège à la demande avec un plafond strict : au-delà du cap
 * (site à très fort trafic), on renvoie null → l'interface affiche
 * « Données insuffisantes pour la comparaison » — JAMAIS de chiffre tronqué
 * présenté comme complet.
 */

export const PERIOD_ROW_CAP = 25_000;

export async function fetchPeriodRows(range: {
  from: Date;
  to: Date;
}): Promise<AnalyticsRow[] | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("analytics_page_views")
    .select(
      "created_at, session_id, event_id, path, path_kind, article_id, device, browser, country_iso2, referrer_class, engaged_ms"
    )
    .gte("created_at", range.from.toISOString())
    .lte("created_at", range.to.toISOString())
    .order("created_at", { ascending: true })
    .limit(PERIOD_ROW_CAP + 1);

  if (error) {
    console.error("[analytics/queries] fetchPeriodRows :", error.message);
    return null;
  }
  const rows = (data ?? []) as AnalyticsRow[];
  return rows.length > PERIOD_ROW_CAP ? null : rows; // null = données volumineuses, non paginées
}

/** Métadonnées des articles de la période (titre, date de publication). */
export async function fetchArticleMeta(): Promise<
  Map<string, { title: string; published_at: string | null }>
> {
  const supabase = await getSupabaseServerClient();
  const map = new Map<string, { title: string; published_at: string | null }>();
  if (!supabase) return map;

  const { data, error } = await supabase
    .from("articles")
    .select("id, title, published_at")
    .order("published_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("[analytics/queries] fetchArticleMeta :", error.message);
    return map;
  }
  for (const a of (data ?? []) as { id: string; title: string; published_at: string | null }[]) {
    map.set(a.id, { title: a.title, published_at: a.published_at });
  }
  return map;
}

/** Les RPC de collecte sont appelées par le Worker côté serveur (anon). */
export async function rpcInsertPageView(params: {
  sessionId: string;
  eventId: string;
  path: string;
  device: string;
  browser: string;
  countryIso2: string | null;
  referrerClass: string;
  tzOffsetMinutes: number | null;
  fingerprint: string;
}): Promise<boolean> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return false;
  const { error } = await supabase.rpc("insert_analytics_page_view", {
    p_session_id: params.sessionId,
    p_event_id: params.eventId,
    p_path: params.path,
    p_device: params.device,
    p_browser: params.browser,
    p_country_iso2: params.countryIso2,
    p_referrer_class: params.referrerClass,
    p_tz_offset_minutes: params.tzOffsetMinutes,
    p_fingerprint: params.fingerprint,
  });
  if (error) {
    console.error("[analytics/queries] insert_analytics_page_view :", error.message);
    return false;
  }
  return true;
}

export async function rpcEngagement(params: {
  eventId: string;
  engagedMs: number;
  fingerprint: string;
}): Promise<boolean> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return false;
  const { error } = await supabase.rpc("analytics_engagement", {
    p_event_id: params.eventId,
    p_engaged_ms: params.engagedMs,
    p_fingerprint: params.fingerprint,
  });
  if (error) {
    console.error("[analytics/queries] analytics_engagement :", error.message);
    return false;
  }
  return true;
}
