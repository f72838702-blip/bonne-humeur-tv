-- ═══════════════════════════════════════════════════════════════════════════
-- BONNE HUMEUR TV — Migration 0026 : Régie publicitaire (RLS + GRANTS)
-- À appliquer APRÈS 0025 (les policies utilisent has_role() de 0002).
--
-- PRÉPARÉE LOCALEMENT — NE PAS APPLIQUER SANS AUTORISATION EXPLICITE.
--
-- Rôles (missions §11) :
--   admin   : gestion complète (annonceurs, campagnes, créations,
--             emplacements, partenaires, RÈGLEMENTS, statistiques).
--   editor  : annonceurs + campagnes + créations (validation « approved »
--             d'une créative réservée ADMIN), emplacements, partenaires,
--             lecture statistiques — RÈGLEMENTS en LECTURE SEULE.
--   reporter: AUCUN accès à la gestion commerciale.
--   public  : JAMAIS les tables — uniquement les fonctions de diffusion
--             get_public_ad_zone / get_public_ad_link / get_public_partners / record_ad_event
--             (SECURITY DEFINER, champs d'affichage seulement).
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.advertisers           enable row level security;
alter table public.ad_partners           enable row level security;
alter table public.ad_placements         enable row level security;
alter table public.ad_campaigns          enable row level security;
alter table public.ad_creatives          enable row level security;
alter table public.ad_campaign_placements enable row level security;
alter table public.ad_payments           enable row level security;
alter table public.ad_daily_stats        enable row level security;

-- La table des empreintes n'a AUCUNE policy : inaccessible via l'API ;
-- seules les fonctions SECURITY DEFINER y écrivent (déduplication).
alter table public.ad_event_fingerprints enable row level security;

-- ─────────────────────────────────────────────────────────────
-- ANNONCEURS (admin = tout ; editor = créer/modifier, pas supprimer)
-- ─────────────────────────────────────────────────────────────
create policy "advertisers_staff_select" on public.advertisers
  for select to authenticated
  using (public.has_role('admin') or public.has_role('editor'));

create policy "advertisers_admin_insert" on public.advertisers
  for insert to authenticated with check (public.has_role('admin') or public.has_role('editor'));

create policy "advertisers_staff_update" on public.advertisers
  for update to authenticated
  using (public.has_role('admin') or public.has_role('editor'))
  with check (public.has_role('admin') or public.has_role('editor'));

create policy "advertisers_admin_delete" on public.advertisers
  for delete to authenticated using (public.has_role('admin'));

-- ─────────────────────────────────────────────────────────────
-- CAMPAGNES (admin = tout ; editor = créer/modifier, pas supprimer)
-- ─────────────────────────────────────────────────────────────
create policy "ad_campaigns_staff_select" on public.ad_campaigns
  for select to authenticated
  using (public.has_role('admin') or public.has_role('editor'));

create policy "ad_campaigns_staff_insert" on public.ad_campaigns
  for insert to authenticated with check (public.has_role('admin') or public.has_role('editor'));

create policy "ad_campaigns_staff_update" on public.ad_campaigns
  for update to authenticated
  using (public.has_role('admin') or public.has_role('editor'))
  with check (public.has_role('admin') or public.has_role('editor'));

create policy "ad_campaigns_admin_delete" on public.ad_campaigns
  for delete to authenticated using (public.has_role('admin'));

-- ─────────────────────────────────────────────────────────────
-- CRÉATIONS — la validation « approved » est réservée ADMIN :
-- l'éditeur ne peut ni approuver, ni modifier une créative déjà approuvée.
-- ─────────────────────────────────────────────────────────────
create policy "ad_creatives_staff_select" on public.ad_creatives
  for select to authenticated
  using (public.has_role('admin') or public.has_role('editor'));

create policy "ad_creatives_staff_insert" on public.ad_creatives
  for insert to authenticated with check (public.has_role('admin') or public.has_role('editor'));

-- NB PostgreSQL : dans une policy, les colonnes non qualifiées désignent la
-- ligne OLD dans using(…) et la ligne NEW dans with check(…) — les alias
-- new./old. ne sont PAS acceptés (prouvé par exécution réelle).
create policy "ad_creatives_staff_update" on public.ad_creatives
  for update to authenticated
  using (
    public.has_role('admin')
    or (public.has_role('editor') and status <> 'approved') -- ligne OLD : l'éditeur ne touche pas une créative approuvée
  )
  with check (
    public.has_role('admin')
    or (public.has_role('editor') and status <> 'approved') -- ligne NEW : ni approuver lui-même
  );

create policy "ad_creatives_admin_delete" on public.ad_creatives
  for delete to authenticated using (public.has_role('admin'));

-- ─────────────────────────────────────────────────────────────
-- EMPLACEMENTS + LIAISONS CAMPAGNE↔EMPLACEMENT (admin et editor)
-- ─────────────────────────────────────────────────────────────
create policy "ad_placements_staff_select" on public.ad_placements
  for select to authenticated
  using (public.has_role('admin') or public.has_role('editor'));

create policy "ad_placements_staff_update" on public.ad_placements
  for update to authenticated
  using (public.has_role('admin') or public.has_role('editor'))
  with check (public.has_role('admin') or public.has_role('editor'));

create policy "ad_campaign_placements_staff_select" on public.ad_campaign_placements
  for select to authenticated
  using (public.has_role('admin') or public.has_role('editor'));

create policy "ad_campaign_placements_staff_insert" on public.ad_campaign_placements
  for insert to authenticated with check (public.has_role('admin') or public.has_role('editor'));

create policy "ad_campaign_placements_staff_update" on public.ad_campaign_placements
  for update to authenticated
  using (public.has_role('admin') or public.has_role('editor'))
  with check (public.has_role('admin') or public.has_role('editor'));

create policy "ad_campaign_placements_staff_delete" on public.ad_campaign_placements
  for delete to authenticated
  using (public.has_role('admin') or public.has_role('editor'));

-- ─────────────────────────────────────────────────────────────
-- RÈGLEMENTS — écriture ADMIN exclusivement (§9 : enregistrement
-- manuel par un administrateur) ; l'éditeur consulte.
-- ─────────────────────────────────────────────────────────────
create policy "ad_payments_staff_select" on public.ad_payments
  for select to authenticated
  using (public.has_role('admin') or public.has_role('editor'));

create policy "ad_payments_admin_insert" on public.ad_payments
  for insert to authenticated with check (public.has_role('admin'));

create policy "ad_payments_admin_update" on public.ad_payments
  for update to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));

create policy "ad_payments_admin_delete" on public.ad_payments
  for delete to authenticated using (public.has_role('admin'));

-- ─────────────────────────────────────────────────────────────
-- STATISTIQUES — lecture staff (admin + editor) ; écritures UNIQUEMENT
-- par les fonctions SECURITY DEFINER (aucune policy insert/update).
-- ─────────────────────────────────────────────────────────────
create policy "ad_daily_stats_staff_select" on public.ad_daily_stats
  for select to authenticated
  using (public.has_role('admin') or public.has_role('editor'));

-- ─────────────────────────────────────────────────────────────
-- PARTENAIRES (staff ; public via get_public_partners)
-- ─────────────────────────────────────────────────────────────
create policy "ad_partners_staff_select" on public.ad_partners
  for select to authenticated
  using (public.has_role('admin') or public.has_role('editor'));

create policy "ad_partners_staff_insert" on public.ad_partners
  for insert to authenticated with check (public.has_role('admin') or public.has_role('editor'));

create policy "ad_partners_staff_update" on public.ad_partners
  for update to authenticated
  using (public.has_role('admin') or public.has_role('editor'))
  with check (public.has_role('admin') or public.has_role('editor'));

create policy "ad_partners_admin_delete" on public.ad_partners
  for delete to authenticated using (public.has_role('admin'));

-- ═══════════════════════════════════════════════════════════
-- FONCTIONS PUBLIQUES — revoke public puis grants explicites :
--   anon + authenticated exécutent UNIQUEMENT diffusion et trackers.
--   purge_ad_fingerprints : personne (pg_cron, rôle postgres).
-- ═══════════════════════════════════════════════════════════
revoke all on function public.get_public_ad_zone(text) from public;
revoke all on function public.get_public_ad_link(uuid) from public;
revoke all on function public.get_public_partners() from public;
revoke all on function public.record_ad_event(uuid, text, text, text) from public;
revoke all on function public.purge_ad_fingerprints() from public, anon, authenticated;

grant execute on function public.get_public_ad_zone(text) to anon, authenticated;
grant execute on function public.get_public_ad_link(uuid) to anon, authenticated;
grant execute on function public.get_public_partners() to anon, authenticated;
grant execute on function public.record_ad_event(uuid, text, text, text) to anon, authenticated;

-- Purge quotidienne des empreintes si pg_cron est actif (infra 0006 réelle).
do $cron$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    begin
      perform cron.unschedule('bhtv-purge-ad-fingerprints');
    exception
      when others then null; -- le job n'existe pas encore : rien à retirer
    end;
    perform cron.schedule(
      'bhtv-purge-ad-fingerprints',
      '25 2 * * *',
      $$select public.purge_ad_fingerprints();$$
    );
    raise notice 'pg_cron actif : purge des empreintes planifiée (02h25).';
  else
    raise notice 'pg_cron indisponible : purge manuelle uniquement.';
  end if;
exception
  when others then
    raise notice 'pg_cron non activé (%). Purge manuelle uniquement.', sqlerrm;
end;
$cron$;

comment on function public.get_public_ad_zone(text) is 'Diffusion publique : renvoie les champs AFFICHAGE des créations approuvées de campagnes actives dans leur période serveur — aucune coordonnée privée.';
comment on function public.record_ad_event(uuid, text, text, text) is 'Tracker idempotent : 1 événement max / jour / créative / empreinte SHA-256 serveur (AUCUNE IP brute).';