-- ═══════════════════════════════════════════════════════════════════════════
-- BONNE HUMEUR TV — Migration 0037 : durcissements de l'audit de sécurité
-- (audit global 10/11/2026). PRÉPARÉE ET NON APPLIQUÉE : toute application
-- distante EXIGE l'autorisation explicite de la direction.
--
-- CONTENU (4 points, tous additive/idempotent, aucune donnée supprimée) :
--   1. record_ad_event : la borne de placement calculée (v_place, bug réel
--      de 0025 — variable saine jamais utilisée à l'insert) est désormais
--      ÉCRITE ; valeurs hors liste + '-' neutre refusées (l'API de
--      vérifie déjà, la base devient bornante → pollution impossible) ;
--   2. purge_analytics : le grant superflu à authenticated est retiré
--      (la purge reste pg_cron + postgres uniquement) ;
--   3. ad_creatives : contrainte de schéma sur payload->>'link_url'
--      (http/https, comme la validation applicative — colonne jsonb, les
--      lignes sans link_url passent) — la base devient la dernière barrière
--      promise par le commentaire de la route de clic ;
--   4. check_rate_limit : nouveau compteur 'admin_login' (rate limiting du
--      login applicatif, séparé des autres compteurs) ; l'appel existe déjà
--      côté application (état « degraded » avant migration, actif après).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 1) record_ad_event — placement borné (0025 corrigée, reste identique
--    à l'original hormis v_place utilisé à l'écriture).
-- ─────────────────────────────────────────────────────────────
create or replace function public.record_ad_event(
  p_creative uuid,
  p_kind text,
  p_placement text default null,
  p_fingerprint text default null
) returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_valid boolean;
  v_fresh boolean;
  -- SAIN : borné aux emplacements réellement prévus (aucun autre texte).
  v_place text := nullif(btrim(coalesce(p_placement, '')), '');
  v_fp text := coalesce(p_fingerprint, '');
begin
  if p_kind not in ('impression', 'clic') or length(v_fp) = 0 or length(v_fp) > 200 then
    return false;
  end if;

  -- Placement inconnu → REFUS (l'écriture de lignes arbitraires en
  -- ad_daily_stats n'est plus possible, même en appelant la RPC à la main).
  if v_place is not null and not (
    v_place in ('home_top_banner', 'home_inline', 'news_feed_inline',
                'article_inline', 'article_bottom', 'videos_inline',
                'home_promo_strip', 'home_partners')
  ) then
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
  values (v_fp)
  on conflict (fingerprint) do nothing
  returning true into v_fresh;

  if v_fresh then
    insert into public.ad_daily_stats (stat_date, creative_id, placement_code,
      impressions, clicks)
    values ((now() at time zone 'utc')::date, p_creative, coalesce(v_place, '-'),
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

-- ─────────────────────────────────────────────────────────────
-- 2) purge_analytics : plus exécutable par un simple utilisateur connecté
--    (pg_cron reste planifié ; postgres/SQL Editor reste souverain).
-- ─────────────────────────────────────────────────────────────
revoke execute on function public.purge_analytics(int) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3) Contrainte de schéma sur la destination publicitaire (dernière
--    barrière de la route de clic). Les lignes existantes sont conformes :
--    l'écriture applicative a toujours exigé http/https (isSafeAdUrl).
-- ─────────────────────────────────────────────────────────────
alter table public.ad_creatives drop constraint if exists ad_creatives_link_url_scheme_check;
alter table public.ad_creatives add constraint ad_creatives_link_url_scheme_check
  check ((payload ->> 'link_url') ~ '^https?://');

-- ─────────────────────────────────────────────────────────────
-- 4) check_rate_limit : + compteur 'admin_login' (login back-office).
--    Compteur DISTINCT : un débit de connexions ne peut jamais épuiser
--    les formulaires publics ni l'assistant admin.
-- ─────────────────────────────────────────────────────────────
create or replace function public.check_rate_limit(
  p_form_type text,
  p_identifier text,
  p_max_requests integer,
  p_window_seconds integer
) returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_count integer;
begin
  if p_form_type not in
     ('contact', 'partnership', 'assistant_public', 'assistant_admin', 'admin_login') then
    raise exception 'Type de formulaire inconnu : %', p_form_type;
  end if;

  select count(*) into v_count
  from public.form_submissions
  where form_type = p_form_type
    and identifier = p_identifier
    and created_at > now() - make_interval(secs => p_window_seconds);

  if v_count >= p_max_requests then
    return false;
  end if;

  insert into public.form_submissions (form_type, identifier)
    values (p_form_type, p_identifier);

  if random() < 0.05 then
    delete from public.form_submissions
    where created_at < now() - interval '7 days';
  end if;

  return true;
end;
$$;

-- Contrainte de table alignée (0032 identique + 'admin_login').
alter table public.form_submissions
  drop constraint if exists form_submissions_form_type_check;
alter table public.form_submissions
  add constraint form_submissions_form_type_check
    check (form_type in
      ('contact', 'partnership', 'assistant_public', 'assistant_admin', 'admin_login'));
