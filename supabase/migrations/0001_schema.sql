-- ═══════════════════════════════════════════════════════════════════════════
-- BONNE HUMEUR TV — Migration 0001 : Schéma de base
-- Application manuelle via l'éditeur SQL du dashboard Supabase
-- (voir supabase/README-CONFIGURATION.md — NE PAS appliquer sans autorisation)
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────
-- PROFILES : équipe éditoriale (rôles : admin / editor / reporter)
-- Créés automatiquement à l'inscription via le trigger handle_new_user
-- (0003) — le rôle par défaut est TOUJOURS 'reporter' :
-- aucune auto-attribution de rôle privilégié n'est possible.
-- ─────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'reporter'
    check (role in ('admin', 'editor', 'reporter')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- CATEGORIES : rubriques éditoriales (articles ET vidéos)
-- ─────────────────────────────────────────────────────────────
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- TAGS
-- ─────────────────────────────────────────────────────────────
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- ARTICLES : actualités
-- Statuts : draft → review → (scheduled →) published → archived
-- ─────────────────────────────────────────────────────────────
create table public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text,
  content text not null default '',
  featured_image text,
  category_id uuid references public.categories(id) on delete set null,
  author_id uuid references public.profiles(id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft', 'review', 'scheduled', 'published', 'archived')),
  published_at timestamptz,
  scheduled_at timestamptz,
  meta_title text,
  meta_description text,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index articles_published_idx on public.articles (status, published_at desc);
create index articles_featured_idx on public.articles (is_featured) where is_featured;
create index articles_category_idx on public.articles (category_id);
create index articles_author_idx on public.articles (author_id);
create index articles_slug_idx on public.articles (slug);

-- ─────────────────────────────────────────────────────────────
-- ARTICLE_TAGS : relation articles ↔ tags (créée APRÈS articles)
-- ─────────────────────────────────────────────────────────────
create table public.article_tags (
  article_id uuid not null references public.articles(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (article_id, tag_id)
);

-- ─────────────────────────────────────────────────────────────
-- VIDEOS : émissions et reportages YouTube
-- is_live ne doit être TRUE que pour un direct RÉELLEMENT vérifié.
-- Aucune statistique de vues n'est stockée : pas de faux compteurs.
-- ─────────────────────────────────────────────────────────────
create table public.videos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text,
  youtube_id text not null,
  thumbnail_url text,
  category_id uuid references public.categories(id) on delete set null,
  duration text,
  published_at timestamptz,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  is_featured boolean not null default false,
  is_live boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index videos_published_idx on public.videos (status, published_at desc);
create index videos_category_idx on public.videos (category_id);
create index videos_live_idx on public.videos (is_live) where is_live;

-- ─────────────────────────────────────────────────────────────
-- BREAKING_NEWS : flash-infos administrables
-- ─────────────────────────────────────────────────────────────
create table public.breaking_news (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  link text,
  is_active boolean not null default true,
  start_at timestamptz,
  end_at timestamptz,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index breaking_news_active_idx on public.breaking_news (is_active, position);

-- ─────────────────────────────────────────────────────────────
-- PARTNERSHIP_REQUESTS : demandes de devis B2B
-- ─────────────────────────────────────────────────────────────
create table public.partnership_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  contact_name text not null,
  organisation text not null,
  fonction text,
  email text not null,
  phone text,
  service text not null
    check (service in ('couverture', 'interview', 'production', 'digitale', 'autre')),
  message text not null,
  budget text,
  timeline text,
  status text not null default 'new'
    check (status in ('new', 'processing', 'treated')),
  admin_note text,
  processed_at timestamptz,
  ip_hash text
);

create index partnership_requests_status_idx on public.partnership_requests (status, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- CONTACT_MESSAGES : messages du formulaire de contact
-- ─────────────────────────────────────────────────────────────
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  email text not null,
  phone text,
  subject text,
  message text not null,
  status text not null default 'new'
    check (status in ('new', 'processing', 'treated')),
  admin_note text,
  processed_at timestamptz,
  ip_hash text
);

create index contact_messages_status_idx on public.contact_messages (status, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- FORM_SUBMISSIONS : journal pour le rate limiting serveur.
-- Aucune policy d'accès pour anon/authenticated : accessible uniquement
-- via la fonction SECURITY DEFINER check_rate_limit (0003) et service_role.
-- ─────────────────────────────────────────────────────────────
create table public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  form_type text not null check (form_type in ('contact', 'partnership')),
  identifier text not null
);

create index form_submissions_lookup_idx on public.form_submissions (form_type, identifier, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- AUDIT_LOGS : traçabilité des opérations administratives
-- ─────────────────────────────────────────────────────────────
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb
);

create index audit_logs_created_idx on public.audit_logs (created_at desc);