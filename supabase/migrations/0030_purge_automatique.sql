-- ═══════════════════════════════════════════════════════════════════════════
-- BONNE HUMEUR TV — Migration 0030 : purge AUTOMATIQUE de l'audience (12 mois)
--
-- Automatise exactement la règle annoncée dans /confidentialite : les lignes
-- d'audience de plus de 12 mois sont supprimées chaque jour par pg_cron
-- (extension fournie par Supabase, gratuite, aucune dépendance applicative).
--
-- PRÉPARÉE POUR APPLICATION IMMÉDIATE (autorisation direction 05/11/2026).
--
-- SÛRETÉ :
--   • purge_analytics (0029) est security definer et ne touche QUE
--     analytics_page_views — aucune autre jamais supprimée ;
--   • le job est replanifié de façon idempotente (unschedule + reschedule) ;
--   • 1 seule exécution par jour, hors heures de pointe (02:30 UTC ≈ 02:30
--     heure de Conakry, GMT+0) ;
--   • aucun secret, aucune donnée personnelle en jeu — table anonyme.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists pg_cron;

-- Idempotent : supprime un éventuel job homonyme avant de le (re)créer.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'purge_analytics_12_mois') then
    perform cron.unschedule('purge_analytics_12_mois');
  end if;
end;
$$;

select cron.schedule(
  'purge_analytics_12_mois',
  '30 2 * * *',
  'select public.purge_analytics(12)'
);
