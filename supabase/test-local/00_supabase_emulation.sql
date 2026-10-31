-- ═══════════════════════════════════════════════════════════════════════════
-- HARNASIS DE TEST LOCAL — émulation minimale de l'environnement Supabase
-- sur PostgreSQL vanilla (test isolé, AUCUNE base de production).
--
-- À exécuter sur une base vierge AVANT les migrations.
-- Reproduit uniquement ce que les migrations exigent :
--   • rôles anon / authenticated / service_role (sans login pour anon/authenticated) ;
--   • schéma auth : table users + fonction auth.uid() (claims JWT simulés
--     via current_setting('request.jwt.claim.sub')) ;
--   • schéma storage : buckets + objects + RLS (0004/0008) ;
--   • privilèges à la mode Supabase (RLS = seul contrôle d'accès réel).
-- Ce harnais N'ÉMUle pas pg_cron ni le service Auth/Storage HTTP :
-- 0006 dégrade gracieusement (conçu pour), testée ainsi.
-- ═══════════════════════════════════════════════════════════════════════════

-- Rôles Supabase (au niveau du CLUSTER : idempotent, réutilisable entre bases do test)
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end $$;

-- ── Schéma auth (suffisant pour 0003 : trigger + auth.uid()) ──
create schema auth;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

-- auth.uid() : lit le claim JWT simulé (GUC fixé par le harnais de test)
create function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

-- ── Schéma storage (suffisant pour 0004/0008) ──
create schema storage;

create table storage.buckets (
  id text primary key,
  name text,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets(id),
  name text,
  created_at timestamptz not null default now()
);

alter table storage.objects enable row level security;

-- ── Privilèges à la mode Supabase : le RLS est le SEUL contrôle ──
grant usage on schema public  to anon, authenticated, service_role;
grant usage on schema auth    to anon, authenticated, service_role;
grant usage on schema storage to anon, authenticated, service_role;
grant all on all tables in schema auth    to service_role;
grant all on all tables in schema storage to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;