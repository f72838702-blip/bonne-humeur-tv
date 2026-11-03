/**
 * Types de domaine de la plateforme Bonne Humeur TV.
 * Ces types reflètent le schéma SQL (supabase/migrations/) —
 * toute évolution du schéma doit être répercutée ici.
 */

export type ContentStatus = "draft" | "review" | "scheduled" | "published" | "archived";
export type VideoStatus = "draft" | "published" | "archived";
export type UserRole = "admin" | "editor" | "reporter";
export type RequestStatus = "new" | "processing" | "treated";

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  featured_image: string | null;
  featured_image_alt: string | null;
  category_id: string | null;
  author_id: string | null;
  status: ContentStatus;
  published_at: string | null;
  scheduled_at: string | null;
  meta_title: string | null;
  meta_description: string | null;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

/** Article enrichi des jointures publiques (catégorie, nom de l'auteur). */
export interface ArticleWithRelations extends Article {
  categories: Pick<Category, "id" | "name" | "slug"> | null;
  author_name: string | null;
  /** Tags attachés (table article_tags) */
  tags?: { id: string; name: string; slug: string }[];
}

export interface Video {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  youtube_id: string;
  thumbnail_url: string | null;
  category_id: string | null;
  duration: string | null;
  published_at: string | null;
  status: VideoStatus;
  is_featured: boolean;
  is_live: boolean;
  /** Position d'épinglage sur l'accueil (0 = ordre chronologique automatique). */
  position: number;
  created_at: string;
  updated_at: string;
}

export interface VideoWithRelations extends Video {
  categories: Pick<Category, "id" | "name" | "slug"> | null;
}

export interface BreakingNewsItem {
  id: string;
  content: string;
  link: string | null;
  is_active: boolean;
  start_at: string | null;
  end_at: string | null;
  position: number;
  /** Niveau éditorial — présent après la migration 0024. */
  level?: "normal" | "important" | "urgent";
  created_at: string;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
}

export interface PartnershipRequest {
  id: string;
  created_at: string;
  contact_name: string;
  organisation: string;
  fonction: string | null;
  email: string;
  phone: string | null;
  service: string;
  message: string;
  budget: string | null;
  timeline: string | null;
  status: RequestStatus;
  admin_note: string | null;
  processed_at: string | null;
}

export interface ContactMessage {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  status: RequestStatus;
  admin_note: string | null;
  processed_at: string | null;
}

/** Statistiques réelles du tableau de bord (jamais de chiffres fictifs). */
export interface DashboardStats {
  articlesPublished: number;
  articlesDraft: number;
  articlesReview: number;
  articlesScheduled: number;
  videosPublished: number;
  breakingNewsActive: number;
  partnershipRequests: number;
  contactMessagesNew: number;
}

/** État de configuration du backend — affiché honnêtement dans l'UI. */
export interface BackendStatus {
  supabaseConfigured: boolean;
  turnstileConfigured: boolean;
}

// ═══════════════════════════════════════════════════════════
// RÉGIE PUBLICITAIRE (migrations 0025/0026)
// ═══════════════════════════════════════════════════════════

export interface Advertiser {
  id: string;
  name: string;
  legal_name: string | null;
  logo_url: string | null;
  sector: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  website: string | null;
  location: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdPartner {
  id: string;
  name: string;
  logo_url: string;
  alt_text: string;
  link_url: string | null;
  sort_order: number;
  visible_from: string | null;
  visible_to: string | null;
  is_active: boolean;
}

export interface AdPlacement {
  code: string;
  label: string;
  description: string | null;
  allowed_formats: ("banner" | "sponsor_article" | "video" | "card" | "promo_strip")[];
  max_items: number;
  devices: ("desktop" | "mobile")[];
  is_active: boolean;
  sort_order: number;
}

export interface AdCampaign {
  id: string;
  advertiser_id: string;
  name: string;
  reference: string | null;
  description: string | null;
  start_at: string | null;
  end_at: string | null;
  billing_type: "forfait" | "forfait_plus_production";
  amount: number | null;
  currency: string;
  priority: number;
  status: "draft" | "pending" | "active" | "suspended" | "completed" | "cancelled" | "refused";
  commercial_manager: string | null;
  notes: string | null;
  contract_ref: string | null;
  contract_signed_at: string | null;
  contract_start_at: string | null;
  contract_end_at: string | null;
  contract_terms: string | null;
  created_at: string;
  updated_at: string;
  advertisers?: { name: string } | null;
}

export interface AdCreative {
  id: string;
  campaign_id: string;
  format: "banner" | "sponsor_article" | "video" | "card" | "promo_strip";
  name: string;
  payload: Record<string, unknown>;
  article_id: string | null;
  status: "draft" | "approved" | "refused";
  weight: number;
  created_at: string;
  updated_at: string;
}

export interface AdPlacementLink {
  campaign_id: string;
  placement_code: string;
  weight: number;
}

export interface AdPayment {
  id: string;
  campaign_id: string;
  amount: number;
  currency: string;
  paid_on: string;
  method: "espèces" | "mobile_money" | "virement" | "chèque" | "autre";
  transaction_reference: string | null;
  note: string | null;
  recorded_by: string | null;
  created_at: string;
}

export interface AdDailyStat {
  stat_date: string;
  creative_id: string;
  placement_code: string;
  impressions: number;
  clicks: number;
}

/** Création rendue par get_public_ad_zone (champs d'affichage SEULEMENT). */
export interface AdPublicCreative {
  id: string;
  format: AdCreative["format"];
  name: string;
  payload: Record<string, unknown>;
  priority: number;
  weight: number;
}

export interface AdPublicZone {
  active: boolean;
  max_items: number;
  devices: ("desktop" | "mobile")[];
  creatives: AdPublicCreative[];
}