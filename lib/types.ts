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