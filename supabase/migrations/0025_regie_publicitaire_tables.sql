-- ═══════════════════════════════════════════════════════════════════════════
-- BONNE HUMEUR TV — Migration 0025 : Régie publicitaire (TABLES + FONCTIONS)
-- À appliquer APRÈS 0001-0008, 0023, 0024.
--
-- PRÉPARÉE LOCALEMENT — NE PAS APPLIQUER SUR LA BASE DISTANTE SANS
-- AUTORISATION EXPLICITE DE LA DIRECTION (cahier d'implémentation §17).
--
-- Contenu :
--   8 tables : advertisers, ad_partners, ad_placements (seed 8 codes),
--              ad_campaigns, ad_creatives, ad_campaign_placements,
--              ad_payments, ad_daily_stats (+ ad_event_fingerprints
--              = déduplication des impressions, AUCUNE IP brute).
--   Fonctions : get_public_ads (diffusion, champs d'affichage SEULEMENT),
--               record_ad_event (idempotent), purge_ad_fingerprints.
--   Triggers  : touch_updated_at + audit_row_change (tables commerciales).
--   Aucune colonne redondante : la « Programmation » est calculée depuis la
--   période et l'horloge serveur (pattern 0024 / lib/ads/ads-core.ts).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- ANNONCEURS — coordonnées PRIVÉES : jamais exposées publiquement
-- (RLS 0026 : staff admin/editor ; reporter et public exclus).
-- ─────────────────────────────────────────────────────────────
create table public.advertisers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 120),
  legal_name text check (length(legal_name) <= 160),
  logo_url text,
  sector text check (length(sector) <= 80),
  contact_name text check (length(contact_name) <= 120),
  contact_phone text check (length(contact_phone) <= 40),
  contact_email text check (length(contact_email) <= 160),
  website text check (length(website) <= 300),
  location text check (length(location) <= 200),
  notes text check (length(notes) <= 2000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index advertisers_name_search_idx on public.advertisers (lower(name));
create index advertisers_active_idx on public.advertisers (is_active);

-- ─────────────────────────────────────────────────────────────
-- EMPLACEMENTS — codes stables (lib/ads/ads-core.ts), configurables
-- sans modification de code : activation, formats autorisés, max, devices.
-- Le SEED couvre les 8 emplacements initiaux du cahier des charges.
-- ─────────────────────────────────────────────────────────────
create table public.ad_placements (
  code text primary key check (code in (
    'home_top_banner', 'home_inline', 'news_feed_inline', 'article_inline',
    'article_bottom', 'videos_inline', 'home_promo_strip', 'home_partners'
    -- codes additionnels possibles via insert (SQL), lib/ads liste les codes connus
  )),
  label text not null check (length(btrim(label)) between 2 and 80),
  description text check (length(description) <= 300),
  allowed_formats text[] not null default array['banner','card','promo_strip']
    check (array_length(allowed_formats, 1) >= 1),
  max_items smallint not null default 1 check (max_items between 1 and 12),
  devices text[] not null default array['desktop','mobile']
    check (array_length(devices, 1) >= 1),
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ad_placements_valid_formats
    check (allowed_formats <@ array['banner','sponsor_article','video','card','promo_strip']),
  constraint ad_placements_valid_devices
    check (devices <@ array['desktop','mobile'])
);

insert into public.ad_placements
  (code, label, description, allowed_formats, max_items)
values
  ('home_top_banner',   'Bannière sous la navigation',      'Bannière d''accueil sous le bandeau principal.',                 array['banner','promo_strip'], 1),
  ('home_inline',       'Encart entre les sections',        'Carte(s) publicitaire(s) insérée(s) entre les sections accueil.',array['card'],                 1),
  ('news_feed_inline',  'Carte dans les actualités',        'Insérée dans la grille de la liste des actualités.',             array['card'],                 1),
  ('article_inline',    'Encart dans l''article',           'Après le corps de l''article, avant les suggestions.',           array['card','banner'],        1),
  ('article_bottom',    'Bannière après l''article',        'Pied d''article.',                                               array['banner'],               1),
  ('videos_inline',     'Encart dans les vidéos',           'Inséré dans la liste des émissions.',                            array['card'],                 1),
  ('home_promo_strip',  'Bandeau promotionnel',             'Bandeau léger d''accueil (offre du moment).',                    array['promo_strip'],          1),
  ('home_partners',     'Logos des partenaires officiels',  'Section « Partenaires » distincte du contenu journalistique.',   array['banner'],               12)
on conflict (code) do nothing;

-- ─────────────────────────────────────────────────────────────
-- CAMPAGNES — statut « Programmée » calculé (jamais stocké) ;
-- période OBLIGATOIRE à l'activation (contrôle applicatif + constraint).
-- ─────────────────────────────────────────────────────────────
create table public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  advertiser_id uuid not null references public.advertisers (id) on delete restrict,
  name text not null check (length(btrim(name)) between 2 and 140),
  reference text unique check (length(btrim(reference)) between 3 and 60),
  description text check (length(description) <= 1500),
  start_at timestamptz,
  end_at timestamptz,
  billing_type text not null default 'forfait'
    check (billing_type in ('forfait', 'forfait_plus_production')),
  amount numeric(14,2) check (amount is null or amount >= 0),
  currency text not null default 'GNF' check (currency ~ '^[A-Z]{3}$'),
  priority smallint not null default 50 check (priority between 0 and 100),
  status text not null default 'draft'
    check (status in ('draft','pending','active','suspended','completed','cancelled','refused')),
  commercial_manager text check (length(commercial_manager) <= 120),
  notes text check (length(notes) <= 2000),
  contract_ref text check (length(contract_ref) <= 60),
  contract_signed_at date,
  contract_start_at date,
  contract_end_at date,
  contract_terms text check (length(contract_terms) <= 2000),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ad_campaigns_period_valid
    check (start_at is null or end_at is null or end_at > start_at)
);

create index ad_campaigns_status_idx   on public.ad_campaigns (status, priority desc);
create index ad_campaigns_period_idx    on public.ad_campaigns (start_at, end_at);
create index ad_campaigns_advertiser_idx on public.ad_campaigns (advertiser_id);

-- ─────────────────────────────────────────────────────────────
-- CRÉATIONS — payload jsonb VALIDÉ côté application (zod, par format) ;
-- statuts draft/approved/refused ; SEUL approved peut être rendu public.
-- ─────────────────────────────────────────────────────────────
create table public.ad_creatives (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.ad_campaigns (id) on delete cascade,
  format text not null check (format in ('banner','sponsor_article','video','card','promo_strip')),
  name text not null check (length(btrim(name)) between 2 and 120),
  payload jsonb not null default '{}'::jsonb,
  article_id uuid references public.articles (id) on delete set null, -- format sponsor_article
  status text not null default 'draft'
    check (status in ('draft','approved','refused')),
  weight smallint not null default 1 check (weight between 1 and 20),
  created_by uuid references public.profiles (id) on delete set null,
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ad_creatives_article_required
    check (format <> 'sponsor_article' or article_id is not null),
  constraint ad_creatives_approval_coherence
    check (status <> 'approved' or approved_by is not null)
);

create index ad_creatives_campaign_idx on public.ad_creatives (campaign_id);
create index ad_creatives_status_idx   on public.ad_creatives (status, format);
create index ad_creatives_article_idx  on public.ad_creatives (article_id) where article_id is not null;

-- ─────────────────────────────────────────────────────────────
-- CAMPAGNE ↔ EMPLACEMENT
-- ─────────────────────────────────────────────────────────────
create table public.ad_campaign_placements (
  campaign_id uuid not null references public.ad_campaigns (id) on delete cascade,
  placement_code text not null references public.ad_placements (code) on delete cascade,
  weight smallint not null default 1 check (weight between 1 and 20),
  primary key (campaign_id, placement_code)
);

-- ─────────────────────────────────────────────────────────────
-- RÈGLEMENTS MANUELS — aucun service de paiement externe, aucune donnée
-- bancaire sensible (montant + référence de transaction uniquement).
-- ─────────────────────────────────────────────────────────────
create table public.ad_payments (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.ad_campaigns (id) on delete cascade,
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null default 'GNF' check (currency ~ '^[A-Z]{3}$'),
  paid_on date not null,
  method text not null check (method in ('espèces','mobile_money','virement','chèque','autre')),
  transaction_reference text check (length(transaction_reference) <= 120),
  note text check (length(note) <= 500),
  recorded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index ad_payments_campaign_idx on public.ad_payments (campaign_id, paid_on);

-- ─────────────────────────────────────────────────────────────
-- STATISTIQUES AGGRÉGÉES — 1 ligne / création×emplacement×jour
-- (aucune ligne par impression, aucune donnée personnelle).
-- ─────────────────────────────────────────────────────────────
create table public.ad_daily_stats (
  stat_date date not null,
  creative_id uuid not null references public.ad_creatives (id) on delete cascade,
  placement_code text not null,
  impressions integer not null default 0 check (impressions >= 0),
  clicks integer not null default 0 check (clicks >= 0),
  primary key (stat_date, creative_id, placement_code)
);

create index ad_stats_campaign_day_idx on public.ad_daily_stats (stat_date desc, creative_id);

-- Déduplication des impressions/clics : 1 événement max / jour / création /
-- empreinte (SHA-256 de IP+UA+créative+jour — AUCUNE IP brute, purgée > 3 j).
create table public.ad_event_fingerprints (
  fingerprint text primary key check (length(fingerprint) <= 200),
  seen_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- PARTENAIRES OFFICIELS — section distincte du contenu journalistique.
-- ─────────────────────────────────────────────────────────────
create table public.ad_partners (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 120),
  logo_url text not null,
  alt_text text not null default '' check (length(alt_text) <= 200),
  link_url text,
  sort_order integer not null default 100,
  visible_from date,
  visible_to date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ad_partners_order_idx on public.ad_partners (sort_order) where is_active;

-- ─────────────────────────────────────────────────────────────
-- TRIGGERS — horodatage + audit des opérations commerciales
-- (pattern réutilisé depuis 0002, aucune fonction nouvelle).
-- ─────────────────────────────────────────────────────────────
create trigger advertisers_touch before update on public.advertisers
  for each row execute function public.touch_updated_at();
create trigger ad_campaigns_touch before update on public.ad_campaigns
  for each row execute function public.touch_updated_at();
create trigger ad_creatives_touch before update on public.ad_creatives
  for each row execute function public.touch_updated_at();
create trigger ad_partners_touch before update on public.ad_partners
  for each row execute function public.touch_updated_at();

create trigger advertisers_audit after insert or update or delete on public.advertisers
  for each row execute function public.audit_row_change('advertisers');
create trigger ad_campaigns_audit after insert or update or delete on public.ad_campaigns
  for each row execute function public.audit_row_change('ad_campaigns');
create trigger ad_creatives_audit after insert or update or delete on public.ad_creatives
  for each row execute function public.audit_row_change('ad_creatives');
create trigger ad_payments_audit after insert or update or delete on public.ad_payments
  for each row execute function public.audit_row_change('ad_payments');
create trigger ad_partners_audit after insert or update or delete on public.ad_partners
  for each row execute function public.audit_row_change('ad_partners');

-- ═══════════════════════════════════════════════════════════
-- FONCTION DE DIFFUSION PUBLIQUE — renvoie UNIQUEMENT les champs
-- d'affichage (aucune coordonnée d'annonceur, aucun montant, aucun
-- contrat). Sécurité invoker... SECURITY DEFINER : l'anon ne lit JAMAIS
-- les tables directement ; la fonction joint et filtre elle-même.
-- ═══════════════════════════════════════════════════════════
create or replace function public.get_public_ads(p_code text)
returns table (
  creative_id uuid,
  format text,
  name text,
  payload jsonb,
  priority smallint,
  weight smallint
)
language sql stable security definer set search_path = public
as $$
  select cr.id, cr.format, cr.name, cr.payload, cam.priority, cr.weight
  from public.ad_placements p
  join public.ad_campaign_placements cp
    on cp.placement_code = p.code
  join public.ad_campaigns cam
    on cam.id = cp.campaign_id
  join public.ad_creatives cr
    on cr.campaign_id = cam.id
  join public.advertisers adv
    on adv.id = cam.advertiser_id
  where p.code = p_code
    and p.is_active
    and cam.status = 'active'
    and cam.start_at is not null and cam.end_at is not null
    and cam.start_at <= now() and now() < cam.end_at
    and cr.status = 'approved'
    and cr.format = any (p.allowed_formats)
    and adv.is_active
  order by cam.priority desc, cr.weight;
$$;

-- ═══════════════════════════════════════════════════════════
-- PARTENAIRES PUBLICS — mêmes principes que get_public_ads :
-- champs d'affichage seulement, période respectée (dates serveur).
-- Le lien partenaire est rendu tel quel UNIQUEMENT s'il a été saisi
-- http/https côté admin (validation applicative ads-core) —
-- les partenaires sont une vitrine, non des campagnes facturées au clic.
-- ═══════════════════════════════════════════════════════════
create or replace function public.get_public_partners()
returns table (
  id uuid,
  name text,
  logo_url text,
  alt_text text,
  link_url text
)
language sql stable security definer set search_path = public
as $$
  select pa.id, pa.name, pa.logo_url, pa.alt_text, pa.link_url
  from public.ad_partners pa
  join public.ad_placements pl
    on pl.code = 'home_partners' and pl.is_active
  where pa.is_active
    and (pa.visible_from is null or pa.visible_from <= (now() at time zone 'utc')::date)
    and (pa.visible_to is null or pa.visible_to >= (now() at time zone 'utc')::date)
  order by pa.sort_order, pa.name
  limit 24;
$$;

-- ═══════════════════════════════════════════════════════════
-- ENregistrement D'ÉVÉNEMENT (impression / clic) — IDEMPOTENT :
-- l'insert-or-ignore d'une empreinte (SHA-256 serveur, AUCUNE IP brute)
-- garantit 1 comptage max / jour / création / empreinte ; le compteur
-- agrégé quotidien n'est incrémenté QUE si l'événement est nouveau.
-- La créative doit être d'une campagne réellement en diffusion.
-- ═══════════════════════════════════════════════════════════
create or replace function public.record_ad_event(
  p_creative uuid,
  p_kind text,
  p_placement text,
  p_fingerprint text
) returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_valid boolean;
  v_fresh boolean;
begin
  if p_kind not in ('impression', 'clic') or length(p_fingerprint) = 0 or length(p_fingerprint) > 200 then
    return false;
  end if;

  select exists (
    select 1
    from public.ad_creatives cr
    join public.ad_campaigns cam on cam.id = cr.campaign_id
    where cr.id = p_creative
      and cr.status = 'approved'
      and cam.status = 'active'
      and cam.start_at <= now() and now() < cam.end_at
  ) into v_valid;

  if not v_valid then
    return false; -- créative non diffusée : comptage REFUSÉ
  end if;

  insert into public.ad_event_fingerprints (fingerprint)
  values (p_fingerprint)
  on conflict (fingerprint) do nothing
  returning true into v_fresh;

  if v_fresh then
    insert into public.ad_daily_stats (stat_date, creative_id, placement_code,
      impressions, clicks)
    values ((now() at time zone 'utc')::date, p_creative, p_placement,
      case when p_kind = 'impression' then 1 else 0 end,
      case when p_kind = 'clic' then 1 else 0 end)
    on conflict (stat_date, creative_id, placement_code) do update
      set impressions = ad_daily_stats.impressions
        + (case when p_kind = 'impression' then 1 else 0 end),
      clicks = ad_daily_stats.clicks
        + (case when p_kind = 'clic' then 1 else 0 end);
  end if;

  return coalesce(v_fresh, false);
end;
$$;

-- Purge des empreintes (> 3 jours) — job pg_cron daily (infra 0006 réelle).
create or replace function public.purge_ad_fingerprints()
returns void
language sql security definer set search_path = public
as $$
  delete from public.ad_event_fingerprints
  where seen_at < now() - interval '3 days';
$$;

comment on table public.advertisers is 'Annonceurs de la régie — coordonnées privées, jamais publiques.';
comment on table public.ad_campaigns is 'Campagnes publicitaires — diffusion = active + période serveur + créative approved.';
comment on table public.ad_daily_stats is 'Agrégats quotidiens impressions/clics — chiffres indicatifs, aucune IP brute.';