-- ═══════════════════════════════════════════════════════════════════════════
-- BONNE HUMEUR TV — Migration 0035 : corbeille des articles
-- (suppression RÉVERSIBLE pendant 30 jours — demande direction 07/11/2026)
--
-- Origine : 4 articles de la rédaction supprimés durement le 07/11 depuis
-- /admin en 3 clics — irrécupérables (aucune corbeille, aucune sauvegarde
-- accessible sur le plan Free). La suppression devient un PLACEMENT en
-- corbeille : deleted_at/deleted_by posés par l'application, article
-- invisible du public ET de la liste staff, restaurable par la rédaction.
--
-- SÛRETÉ :
--   • le PUBLIC ne voit jamais une ligne en corbeille : la policy
--     articles_public_select est recréée avec deleted_at is null ;
--   • la liste staff continue de ne montrer que les actifs
--     (isNull(deleted_at) côté application) ;
--   • la page /admin/articles/corbeille (admin/editor) est la SEULE à
--     lire les lignes supprimées ;
--   • purge AUTOMATIQUE à 30 jours par pg_cron (même mécanique éprouvée
--     que 0030) : fonction security definer qui ne touche QUE articles ;
--   • article_tags, analytics : les liaisons article_tags partagent le
--     sort de l'article (cascade à la purge dure) — aucun orphelin réel.
-- Idempotent : colonnes IF NOT EXISTS, policy recréée, cron re-planifié.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Colonnes de la corbeille
alter table public.articles add column if not exists deleted_at timestamptz;
alter table public.articles add column if not exists deleted_by uuid
  references public.profiles (id) on delete set null;

comment on column public.articles.deleted_at is
  'Placement en corbeille (null = article actif). Purge dure après 30 jours (pg_cron).';
comment on column public.articles.deleted_by is
  'Profil ayant placé l''article en corbeille (traçabilité, journal d''audit).';

-- Index partiel : la corbeille est petite ; la liste publique n'y passe jamais.
create index if not exists articles_corbeille_idx
  on public.articles (deleted_at)
  where deleted_at is not null;

-- 2) Le public ne voit QUE les articles actifs publiés (jamais la corbeille)
drop policy if exists "articles_public_select" on public.articles;
create policy "articles_public_select" on public.articles
  for select using (
    deleted_at is null
    and status = 'published'
    and published_at is not null
    and published_at <= now()
  );

-- 3) Purge dure à 30 jours — même mécanique que purge_analytics (0030)
create or replace function public.purge_articles_corbeille() returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Ne touche QUE public.articles : toute autre table est ignorée.
  delete from public.articles
  where deleted_at is not null
    and deleted_at < now() - interval '30 days';
end;
$$;

create extension if not exists pg_cron;

-- Idempotent : supprime un éventuel job homonyme avant de le (re)créer.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'purge_corbeille_articles_30_jours') then
    perform cron.unschedule('purge_corbeille_articles_30_jours');
  end if;
end;
$$;

-- 02:40 UTC ≈ 02:40 Conakry : après purge_analytics (02:30), hors pointe.
select cron.schedule(
  'purge_corbeille_articles_30_jours',
  '40 2 * * *',
  'select public.purge_articles_corbeille()'
);
