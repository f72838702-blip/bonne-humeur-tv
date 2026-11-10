-- ═══════════════════════════════════════════════════════════════════════════
-- BONNE HUMEUR TV — Migration 0038 : emplacement publicitaire « footer »
-- (demande direction 10/11/2026 : « cable le footer » — publicité en pied
-- de page, présente sur TOUTES les pages publiques via le layout).
--
-- CONTENU (3 points, tous idempotent, aucune donnée supprimée) :
--   1. contrainte ad_placements.code étendue au 9e emplacement « footer »
--      (le commentaire de 0025 prévoyait des codes additionnels par
--      INSERT SQL ; la contrainte d'origine bornait à 8 codes) ;
--   2. seed idempotent de l'emplacement footer (bannière/cartes/bandeau,
--      max 1 par page — pied de page sobre) ;
--   3. record_ad_event : liste blanche des placements alignée (0037)
--      + « footer » — SANS ce point, impressions et clics du footer
--      seraient silencieusement refusés par la base.
-- RÉVERSIBLE : drop constraint + delete ad_placements where code='footer'
-- + recréer la fonction 0037.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 1) Contrainte de code : 8 emplacements → 9 (+ 'footer').
-- ─────────────────────────────────────────────────────────────
alter table public.ad_placements drop constraint if exists ad_placements_code_check;
alter table public.ad_placements add constraint ad_placements_code_check
  check (code in ('home_top_banner', 'home_inline', 'news_feed_inline',
                  'article_inline', 'article_bottom', 'videos_inline',
                  'home_promo_strip', 'home_partners', 'footer'));

-- ─────────────────────────────────────────────────────────────
-- 2) Seed de l'emplacement « footer » (idempotent — même motif 0025).
--    Formats : bannière / carte / bandeau promotionnel (pas de vidéo
--    YouTube dans un pied de page). max_items 1 = pied de page sobre.
-- ─────────────────────────────────────────────────────────────
insert into public.ad_placements
  (code, label, description, allowed_formats, max_items)
values
  ('footer',
   'Pied de page — bannière',
   'Bannière du pied de page, présente sous toutes les pages publiques (sous les colonnes, au-dessus du bandeau légal).',
   array['banner', 'card', 'promo_strip'],
   1)
on conflict (code) do nothing;

-- ─────────────────────────────────────────────────────────────
-- 3) record_ad_event — liste blanche alignée (corps 0037 + 'footer').
--    Aucun autre changement : borne identique à 0037 (placement
--    inconnu → return false AVANT toute écriture).
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
                'home_promo_strip', 'home_partners', 'footer')
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
