-- ═══════════════════════════════════════════════════════════════════════════
-- BONNE HUMEUR TV — Migration 0029 : Statistiques d'audience (collecte
-- propriétaire, anonyme, 0 USD/mois)
-- À appliquer APRÈS 0028.
--
-- PRÉPARÉE LOCALEMENT — NE PAS APPLIQUER SUR LA BASE DISTANTE SANS
-- AUTORISATION EXPLICITE DE LA DIRECTION.
--
-- VIE PRIVÉE (dur) :
--   • AUCUNE adresse IP stockée ; l'empreinte sha256(IP+UA+JOUR) sert
--     UNIQUEMENT au plafonnement anti-abus (motif ad_event_fingerprints
--     0025), rotée chaque jour, jamais utilisable pour identifier un
--     visiteur ;
--   • session_id = UUID aléatoire éphémère (sessionStorage du navigateur,
--     régénéré après 30 min d'inactivité AUCUN cookie, AUCUN profil) ;
--   • pays = request.cf.country (Cloudflare Worker, sans l'IP) ;
--   • appareil/navigateur = classification de l'User-Agent CÔTÉ SERVEUR ;
--   • 1 seule ligne par page vue ; les heartbeats d'engagement METTENT À
--     JOUR cette ligne (upsert GREATEST : jamais de baisse, jamais de
--     doublon de comptage) — aucune ligne permanente par pulse.
-- ACCÈS :
--   • RLS activée, AUCUNE policy anon : le navigateur public ne peut
--     NI lire NI écrire les lignes brutes ; les écritures passent SEULEMENT
--     par les 2 RPC security definer (validation SQL stricte de chaque
--     champ) ; la lecture du tableau de bord est réservée à has_role('admin')
--     via policy SELECT.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.analytics_page_views (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  session_id uuid not null,
  event_id     uuid not null unique,
  path text not null check (length(path) between 1 and 2000)
             check (left(path, 1) = '/' and path not like '/admin%'),
  path_kind text not null default 'other' check (path_kind in ('article', 'other')),
  article_id uuid references public.articles(id) on delete set null,
  device text not null check (device in ('mobile', 'desktop', 'tablet')),
  browser text not null check (browser in ('chrome', 'safari', 'firefox', 'edge', 'samsung', 'opera', 'other')),
  country_iso2 text check (country_iso2 ~ '^[A-Z]{2}$'),
  referrer_class text not null check (referrer_class in (
    'direct', 'search', 'facebook', 'whatsapp', 'instagram', 'twitter',
    'tiktok', 'youtube', 'other_social', 'external', 'unknown')),
  engaged_ms bigint not null default 0
    check (engaged_ms between 0 and 86400000), -- 24 h max (cap anti-abus)
  tz_offset_minutes int check (tz_offset_minutes between -840 and 840),
  fingerprint text not null check (length(fingerprint) between 8 and 200)
);

create index analytics_created_idx   on public.analytics_page_views (created_at);
create index analytics_session_idx   on public.analytics_page_views (session_id);
create index analytics_article_idx   on public.analytics_page_views (article_id);
create index analytics_country_idx   on public.analytics_page_views (country_iso2);
create index analytics_fingerprint_idx on public.analytics_page_views (fingerprint, created_at);

alter table public.analytics_page_views enable row level security;

-- Lecture du tableau de bord : ADMIN UNIQUEMENT (la mission §11 : seuls
-- les administrateurs consultent les statistiques).
create policy "analytics_page_views_admin_select" on public.analytics_page_views
  for select to authenticated
  using (public.has_role('admin'));

-- ─────────────────────────────────────────────────────────────────────────
-- RPC 1 — INSERT d'une page vue (appelée par le Worker CÔTÉ SERVEUR).
-- Toutes les valeurs sont validées ici EN DERNIER RESORT. L'article est
-- résolu par le slug du chemin (path '/actualites/<slug>'). Plafonnement
-- anti-abus : 240 événements/h/empreinte — au-delà, l'insert est ignoré
-- silencieusement (réponse 204 côté Worker).
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.insert_analytics_page_view(
  p_session_id uuid,
  p_event_id uuid,
  p_path text,
  p_device text,
  p_browser text,
  p_country_iso2 text,
  p_referrer_class text,
  p_tz_offset_minutes int,
  p_fingerprint text
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_article uuid;
  v_recent int;
begin
  -- Validations défensives (le Worker valide déjà).
  if p_path like '/admin%' or left(p_path, 1) <> '/' then return; end if;
  if p_fingerprint is null or length(btrim(p_fingerprint)) < 8 then return; end if;

  -- Plafond anti-abus par empreinte (240/heure ≈ 1 page vue toutes les 15 s max).
  select count(*) into v_recent
    from public.analytics_page_views
    where fingerprint = p_fingerprint
      and created_at > now() - interval '1 hour';
  if v_recent >= 240 then return; end if;

  -- Résolution de l'article SANS requête supplémentaire du Worker.
  if p_path like '/actualites/%' and p_path not like '/actualites/categorie%' then
    select id into v_article from public.articles
      where slug = right(p_path, length(p_path) - length('/actualites/'))
      limit 1;
  end if;

  insert into public.analytics_page_views (
    session_id, event_id, path, path_kind, article_id,
    device, browser, country_iso2, referrer_class,
    tz_offset_minutes, fingerprint
  ) values (
    p_session_id, p_event_id, p_path,
    case when v_article is not null then 'article' else 'other' end,
    v_article, p_device, p_browser, nullif(btrim(p_country_iso2), ''),
    p_referrer_class, p_tz_offset_minutes, p_fingerprint
  )
  on conflict (event_id) do nothing; -- idempotent : jamais de doublon
end;
$$;

revoke execute on function public.insert_analytics_page_view(uuid, uuid, text, text, text, text, text, int, text) from public;
grant execute on function public.insert_analytics_page_view(uuid, uuid, text, text, text, text, text, int, text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- RPC 2 — ENGAGEMENT (temps réellement passé page VISIBLE, transmis par le
-- client en valeur CUMULÉE monotone). Upsert d'UNE LIGNE : les heartbeats
-- ne créent jamais de lignes. Barrières :
--   • event_id doit exister ;
--   • l'empreinte doit correspondre à celle de la page vue (empêche
--     n'importe quel visiteur d'augmenter les lignes des autres) ;
--   • GREATEST : les valeurs ne baissent jamais (double envoi sans
--     conséquence, anti-comptage multiple) ;
--   • cap 24h par la contrainte de colonne.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.analytics_engagement(
  p_event_id uuid,
  p_engaged_ms bigint,
  p_fingerprint text
) returns void
language sql security definer set search_path = public
as $$
  update public.analytics_page_views
     set engaged_ms = greatest(engaged_ms, p_engaged_ms)
   where event_id = p_event_id
     and fingerprint = p_fingerprint
     and p_engaged_ms between 0 and 86400000;
$$;

revoke execute on function public.analytics_engagement(uuid, bigint, text) from public;
grant execute on function public.analytics_engagement(uuid, bigint, text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- Purge (retenue 12 mois) — à appeler manuellement (ou via pg_cron si la
-- direction le souhaite) ; ne supprime JAMAIS d'autre table.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.purge_analytics(p_keep_months int default 12)
returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  v_deleted bigint;
begin
  with del as (
    delete from public.analytics_page_views
     where created_at < now() - make_interval(months => greatest(p_keep_months, 1))
    returning 1
  ) select count(*) into v_deleted from del;
  return v_deleted;
end;
$$;

revoke execute on function public.purge_analytics(int) from public;
grant execute on function public.purge_analytics(int) to authenticated;