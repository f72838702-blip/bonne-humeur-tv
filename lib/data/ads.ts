import { getSupabaseServerClient } from "@/lib/supabase/server";
import type {
  AdCampaign,
  AdCreative,
  AdDailyStat,
  AdPartner,
  AdPayment,
  AdPlacement,
  Advertiser,
} from "@/lib/types";

/**
 * Lectures BACK-OFFICE de la régie publicitaire (admin/editor).
 * Client serveur « cookies session » — la RLS (0026) filtre déjà :
 * l'éditeur ne lit pas les règlements, le reporter ne lit rien.
 * AUCUN chiffre fictif : vides explicites quand la base est vide.
 */

async function server() {
  return getSupabaseServerClient();
}

// ─── Annonceurs ──────────────────────────────────────────────────────

export interface AdvertiserListFilters {
  q?: string;
  activeOnly?: boolean;
}

export async function listAdvertisers(filters: AdvertiserListFilters = {}) {
  const supabase = await server();
  if (!supabase) return [];
  let query = supabase
    .from("advertisers")
    .select("*")
    .order("name", { ascending: true })
    .limit(200);
  if (filters.q) query = query.ilike("name", `%${filters.q}%`);
  if (filters.activeOnly) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) {
    console.error("[data/ads] listAdvertisers :", error.message);
    return [];
  }
  return (data ?? []) as unknown as Advertiser[];
}

export async function getAdvertiser(id: string) {
  const supabase = await server();
  if (!supabase) return null;
  const { data } = await supabase.from("advertisers").select("*").eq("id", id).maybeSingle();
  return (data as unknown as Advertiser) ?? null;
}

/** Campagnes d'un annonceur (fiche annonceur). */
export async function getAdvertiserCampaigns(advertiserId: string) {
  const supabase = await server();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("ad_campaigns")
    .select("*")
    .eq("advertiser_id", advertiserId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("[data/ads] getAdvertiserCampaigns :", error.message);
    return [];
  }
  return (data ?? []) as unknown as AdCampaign[];
}

// ─── Campagnes ───────────────────────────────────────────────────────

export interface CampaignListFilters {
  q?: string;
  status?: string;
}

export async function listCampaigns(filters: CampaignListFilters = {}) {
  const supabase = await server();
  if (!supabase) return [];
  let query = supabase
    .from("ad_campaigns")
    .select("*, advertisers ( name )")
    .order("created_at", { ascending: false })
    .limit(200);
  if (filters.q) query = query.ilike("name", `%${filters.q}%`);
  if (filters.status) query = query.eq("status", filters.status);
  const { data, error } = await query;
  if (error) {
    console.error("[data/ads] listCampaigns :", error.message);
    return [];
  }
  return (data ?? []) as unknown as (AdCampaign & { advertisers: { name: string } | null })[];
}

export async function getCampaign(id: string) {
  const supabase = await server();
  if (!supabase) return null;

  const { data: campaign } = await supabase
    .from("ad_campaigns")
    .select("*, advertisers ( id, name, is_active )")
    .eq("id", id)
    .maybeSingle();
  if (!campaign) return null;

  return campaign as unknown as AdCampaign & {
    advertisers: Pick<Advertiser, "id" | "name" | "is_active"> | null;
  };
}

export async function getCampaignCreatives(campaignId: string) {
  const supabase = await server();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("ad_creatives")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[data/ads] getCampaignCreatives :", error.message);
    return [];
  }
  return (data ?? []) as unknown as AdCreative[];
}

export async function getCampaignPlacements(campaignId: string) {
  const supabase = await server();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("ad_campaign_placements")
    .select("campaign_id, placement_code, weight")
    .eq("campaign_id", campaignId);
  if (error) {
    console.error("[data/ads] getCampaignPlacements :", error.message);
    return [];
  }
  return (data ?? []) as unknown as { campaign_id: string; placement_code: string; weight: number }[];
}

export async function getCampaignPayments(campaignId: string) {
  const supabase = await server();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("ad_payments")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("paid_on", { ascending: false });
  if (error) {
    // RLS : l'éditeur ne lit PAS les règlements — liste vide assumée.
    console.error("[data/ads] getCampaignPayments :", error.message);
    return [];
  }
  return (data ?? []) as unknown as AdPayment[];
}

// ─── Emplacements & partenaires ──────────────────────────────────────

export async function listPlacements() {
  const supabase = await server();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("ad_placements")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) {
    console.error("[data/ads] listPlacements :", error.message);
    return [];
  }
  return (data ?? []) as unknown as AdPlacement[];
}

export async function listPartners() {
  const supabase = await server();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("ad_partners")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) {
    console.error("[data/ads] listPartners :", error.message);
    return [];
  }
  return (data ?? []) as unknown as AdPartner[];
}

// ─── Règlements (ADMIN — RLS 0026 : editor = 0 ligne) ────────────────

export async function listAllPayments() {
  const supabase = await server();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("ad_payments")
    .select("*, ad_campaigns ( name, reference, advertisers ( name ) )")
    .order("paid_on", { ascending: false })
    .limit(500);
  if (error) {
    console.error("[data/ads] listAllPayments :", error.message);
    return [];
  }
  return (data ?? []) as unknown as (AdPayment & {
    ad_campaigns: { name: string; reference: string | null; advertisers: { name: string } | null } | null;
  })[];
}

// ─── Statistiques (agrégats de la base, JAMAIS de chiffre inventé) ───

export interface DailyRow extends AdDailyStat {
  ad_creatives: { name: string; format: string; campaign_id: string; ad_campaigns: { name: string; reference: string | null } | null } | null;
}

export interface DailyFilters {
  from?: string; // AAAA-MM-JJ
  to?: string;
  campaignId?: string;
}

/** Agrégats journaliers bruts (lignes par création×jour). Les plafonds
 *  SQL limitent la fenêtre ; la page agrège ensuite côté serveur. */
export async function listDailyStats(filters: DailyFilters = {}) {
  const supabase = await server();
  if (!supabase) return [];
  let query = supabase
    .from("ad_daily_stats")
    .select("stat_date, creative_id, placement_code, impressions, clicks, ad_creatives ( name, format, campaign_id, ad_campaigns ( name, reference ) )")
    .order("stat_date", { ascending: false })
    .limit(500);
  if (filters.from) query = query.gte("stat_date", filters.from);
  if (filters.to) query = query.lte("stat_date", filters.to);
  if (filters.campaignId) {
    query = query.filter("ad_creatives.campaign_id", "eq", filters.campaignId);
  }
  const { data, error } = await query;
  if (error) {
    console.error("[data/ads] listDailyStats :", error.message);
    return [];
  }
  return (data ?? []) as unknown as DailyRow[];
}

// ─── LISTE SIMPLIFIÉE « Publicités » (une ligne = une publicité) ──────

export interface PubliciteRow {
  id: string;
  name: string;
  reference: string | null;
  status: string;
  start_at: string | null;
  end_at: string | null;
  created_at: string;
  advertiser_name: string | null;
  advertiser_id: string | null;
  placements: string[];
  creative: {
    id: string;
    format: string;
    name: string;
    status: string;
    payload: Record<string, unknown> | null;
  } | null;
}

/**
 * Toutes les publicités (campagnes + visuel + emplacements) en 2 requêtes
 * — jamais N+1. Le visuel affiché est la PREMIÈRE création (ordre de
 * création) ; les emplacements viennent de la table de liaison.
 */
export async function listPubliciteAds(limit = 200): Promise<PubliciteRow[]> {
  const supabase = await server();
  if (!supabase) return [];

  const [campaigns, links] = await Promise.all([
    supabase
      .from("ad_campaigns")
      .select(
        "id, name, reference, status, start_at, end_at, created_at, advertisers ( id, name )"
      )
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("ad_campaign_placements")
      .select("campaign_id, placement_code")
      .order("placement_code")
      .limit(2000),
  ]);
  if (campaigns.error) {
    console.error("[data/ads] listPubliciteAds(campaigns) :", campaigns.error.message);
    return [];
  }
  if (links.error) {
    console.error("[data/ads] listPubliciteAds(links) :", links.error.message);
  }

  const campaignIds = (campaigns.data ?? []).map((c) => c.id);
  const creatives = campaignIds.length
    ? await supabase
        .from("ad_creatives")
        .select("id, campaign_id, format, name, status, payload")
        .in("campaign_id", campaignIds)
        .order("created_at", { ascending: true })
    : null;

  interface CreativeLite {
    id: string;
    campaign_id: string;
    format: string;
    name: string;
    status: string;
    payload: Record<string, unknown> | null;
  }
  const placementsByCampaign = new Map<string, string[]>();
  for (const l of (links.data ?? []) as unknown as { campaign_id: string; placement_code: string }[]) {
    placementsByCampaign.set(l.campaign_id, [...(placementsByCampaign.get(l.campaign_id) ?? []), l.placement_code]);
  }
  const creativeByCampaign = new Map<string, CreativeLite>();
  for (const c of (creatives?.data ?? []) as unknown as CreativeLite[]) {
    if (!creativeByCampaign.has(c.campaign_id)) creativeByCampaign.set(c.campaign_id, c);
  }

  return (campaigns.data ?? []).map((c) => {
    const row = c as unknown as {
      id: string; name: string; reference: string | null; status: string;
      start_at: string | null; end_at: string | null; created_at: string;
      advertisers: { id: string; name: string } | null;
    };
    const creative = creativeByCampaign.get(row.id);
    return {
      id: row.id,
      name: row.name,
      reference: row.reference,
      status: row.status,
      start_at: row.start_at,
      end_at: row.end_at,
      created_at: row.created_at,
      advertiser_name: row.advertisers?.name ?? null,
      advertiser_id: row.advertisers?.id ?? null,
      placements: placementsByCampaign.get(row.id) ?? [],
      creative: creative
        ? {
            id: creative.id,
            format: creative.format,
            name: creative.name,
            status: creative.status,
            payload: creative.payload,
          }
        : null,
    } satisfies PubliciteRow;
  });
}

/** Compteurs réels du tableau de bord régie (aucune estimation). */
export async function getAdsDashboardCounters() {
  const supabase = await server();
  if (!supabase) {
    return {
      advertisers: 0,
      advertisersActive: 0,
      campaignsTotal: 0,
      campaignsByStatus: {} as Record<string, number>,
      creativesPending: 0,
      impressionsTotal: 0,
      clicksTotal: 0,
    };
  }

  const [{ count: advertisers }, { count: advertisersActive }, campaigns, creatives] =
    await Promise.all([
      supabase.from("advertisers").select("id", { count: "exact", head: true }),
      supabase.from("advertisers").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("ad_campaigns").select("status"),
      supabase.from("ad_creatives").select("status").eq("status", "draft"),
    ]);

  const byStatus: Record<string, number> = {};
  for (const row of campaigns.data ?? []) {
    const s = (row as unknown as { status: string }).status;
    byStatus[s] = (byStatus[s] ?? 0) + 1;
  }

  const { data: totals } = await supabase
    .from("ad_daily_stats")
    .select("impressions, clicks")
    .limit(5000);

  let impressionsTotal = 0;
  let clicksTotal = 0;
  for (const row of totals ?? []) {
    const r = row as unknown as { impressions: number; clicks: number };
    impressionsTotal += Number(r.impressions);
    clicksTotal += Number(r.clicks);
  }

  return {
    advertisers: advertisers ?? 0,
    advertisersActive: advertisersActive ?? 0,
    campaignsTotal: campaigns.data?.length ?? 0,
    campaignsByStatus: byStatus,
    creativesPending: creatives.data?.length ?? 0,
    impressionsTotal,
    clicksTotal,
  };
}