import { getSupabasePublicClient } from "@/lib/supabase/server";
import { rotateAds } from "@/lib/ads/ads-core";
import type { AdPublicCreative } from "@/lib/types";

/**
 * Lectures PUBLIQUES de la régie publicitaire — fonctions SECURITY DEFINER
 * uniquement (get_public_ad_zone / get_public_ad_link / get_public_partners).
 *
 * Garde-fous structurels (§12) :
 *   - link_url est RETIRÉ du payload par la base : aucun lien externe
 *     ne peut apparaître dans le DOM ;
 *   - la zone renvoyée est déjà filtrée : campagne active en période,
 *     créative approuvée, annonceur actif, emplacement actif ;
 *   - la rotation (rotateAds) est déterministe par fenêtre de 5 min.
 */

export interface RotatedZone {
  active: boolean;
  max_items: number;
  devices: ("desktop" | "mobile")[];
  creatives: AdPublicCreative[];
}

/**
 * Zone d'un emplacement, prête à être rendue par un Server Component
 * (revalidate ISR — pas de polling, cohérence SSR/hydratation).
 */
export async function getAdZone(code: string, nowMs = Date.now()): Promise<RotatedZone | null> {
  const supabase = getSupabasePublicClient();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("get_public_ad_zone", { p_code: code });
  if (error) {
    console.error("[data/ads-public] getAdZone :", error.message);
    return null;
  }
  const zone = data as unknown as RotatedZone;
  if (!zone || !zone.active) return null;

  const candidates = Array.isArray(zone.creatives) ? zone.creatives : [];
  if (candidates.length === 0) {
    return { active: true, max_items: zone.max_items, devices: zone.devices, creatives: [] };
  }

  // rotateAds exige une clé stable : l'ID de créative la remplit.
  const creatives = rotateAds(
    candidates.map((c) => ({ ...c, key: String(c.id) })),
    Math.min(zone.max_items, candidates.length),
    nowMs
  );
  return {
    active: true,
    max_items: zone.max_items,
    devices: zone.devices,
    creatives,
  };
}

/** Partenaires actifs et dans leur fenêtre de visibilité (base = filtre). */
export async function getPartners() {
  const supabase = getSupabasePublicClient();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("get_public_partners");
  if (error) {
    console.error("[data/ads-public] getPartners :", error.message);
    return [];
  }
  return (data ?? []) as unknown as {
    id: string;
    name: string;
    logo_url: string;
    alt_text: string;
    link_url: string | null;
  }[];
}

/**
 * Destination d'un clic publicitaire — appelée par /ads/click/[id].
 * Renvoie '' si la créative n'est pas diffusable (fail-closed).
 */
export async function getPublicAdLink(creativeId: string): Promise<string> {
  const supabase = getSupabasePublicClient();
  if (!supabase) return "";
  const { data, error } = await supabase.rpc("get_public_ad_link", { p_creative: creativeId });
  if (error) {
    console.error("[data/ads-public] getPublicAdLink :", error.message);
    return "";
  }
  return typeof data === "string" ? data : "";
}

/**
 * Article RÉEL d'une création « sponsor_article » — lecture PUBLIQUE
 * (RLS : brouillons invisibles, jamais un article non publié n'est
 * transformé en contenu affiché). Renvoie null si l'article n'existe
 * pas ou n'est pas publié : la création n'est tout simplement pas rendue.
 */
export async function getSponsoredArticle(articleId: string) {
  const supabase = getSupabasePublicClient();
  if (!supabase) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(articleId)) return null;

  const { data, error } = await supabase
    .from("articles")
    .select("id, title, slug, excerpt, featured_image, categories ( id, name, slug )")
    .eq("id", articleId)
    .eq("status", "published")
    .not("published_at", "is", null)
    .lte("published_at", new Date().toISOString())
    .maybeSingle();
  if (error) {
    console.error("[data/ads-public] getSponsoredArticle :", error.message);
    return null;
  }
  return data as unknown as
    | {
        id: string;
        title: string;
        slug: string;
        excerpt: string | null;
        featured_image: string | null;
        categories: { id: string; name: string; slug: string } | null;
      }
    | null;
}

/**
 * IDs des articles RÉELS marqués « Sponsorisé » en ce moment (§12) —
 * appelé UNE fois par liste pour placer la mention sur toutes les
 * cartes, y compris les flux normaux. Échec → liste vide (fail-closed ;
 * conséquence : une carte sans mention, jamais l'inverse).
 */
export async function getSponsoredArticleIds(): Promise<string[]> {
  const supabase = getSupabasePublicClient();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("get_public_sponsored_articles");
  if (error) {
    console.error("[data/ads-public] getSponsoredArticleIds :", error.message);
    return [];
  }
  return ((data ?? []) as unknown[]).filter((v): v is string => typeof v === "string");
}