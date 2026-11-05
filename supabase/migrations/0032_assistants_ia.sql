-- ─────────────────────────────────────────────────────────────────────────────
-- BONNE HUMEUR TV — Migration 0032 : Assistsants IA (quotas)
-- MINIME et ADDITIVE : étend le rate limiting existant à deux nouveaux
-- types ('assistant_public', 'assistant_admin'). Aucune table nouvelle,
-- aucune colonne nouvelle, aucune donnée touchée, aucune policy modifiée.
-- Appliquée UNIQUEMENT après autorisation de la direction.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Fonction de garde : whitelist étendue (le reste identique à 0002).
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
  -- Types autorisés : les 2 formulaires publics EXISTANTS + les 2
  -- assistants IA (compteurs DISTINCTS : le public ne peut jamais
  -- épuiser le quota réservé à l'administration).
  if p_form_type not in ('contact', 'partnership', 'assistant_public', 'assistant_admin') then
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

  -- Purge légère des vieilles entrées : reprise IDENTIQUE à 0002
  -- (1 insertion sur ~20 déclenche la suppression des lignes de plus de
  -- 7 jours). Réintroduite par la Phase E : sans elle, create or replace
  -- effacerait le mécanisme de purge (croissance non purgeable — audit).
  if random() < 0.05 then
    delete from public.form_submissions
    where created_at < now() - interval '7 days';
  end if;

  return true;
end;
$$;

-- Le grant établi pour 0002 reste inchangé (fonction réservée au
-- service_role côté application).

-- 2) Contrainte de table alignée (les anciennes lignes restent valides).
alter table public.form_submissions
  drop constraint if exists form_submissions_form_type_check;
alter table public.form_submissions
  add constraint form_submissions_form_type_check
    check (form_type in ('contact', 'partnership', 'assistant_public', 'assistant_admin'));
