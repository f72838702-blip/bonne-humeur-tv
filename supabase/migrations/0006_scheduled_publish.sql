-- ═══════════════════════════════════════════════════════════════════════════
-- BONNE HUMEUR TV — Migration 0006 : publication programmée (OPTIONNELLE)
--
-- Passe en « published » les articles dont la date programmée (scheduled_at)
-- est atteinte. Exige l'extension pg_cron ; la migration ne fait PAS échouer
-- si l'extension est indisponible (bloc DO avec gestion d'exception) —
-- dans ce cas la publication reste manuelle, sans erreur silencieuse :
-- un message explicite est produit.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.publish_scheduled_articles()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update public.articles
  set status = 'published',
      published_at = coalesce(published_at, scheduled_at)
  where status = 'scheduled'
    and scheduled_at is not null
    and scheduled_at <= now();

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.publish_scheduled_articles() from public, anon, authenticated;

-- Planification toutes les 5 minutes si pg_cron est disponible.
do $cron$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule(
      'bhtv-publish-scheduled',
      '*/5 * * * *',
      $$select public.publish_scheduled_articles();$$
    );
    raise notice 'pg_cron actif : publication programmée planifiée (*/5 min).';
  else
    raise notice 'pg_cron indisponible : publication programmée DÉSACTIVÉE (manuelle uniquement).';
  end if;
exception
  when others then
    raise notice 'pg_cron non activé (%). Publication programmée manuelle uniquement.', sqlerrm;
end;
$cron$;