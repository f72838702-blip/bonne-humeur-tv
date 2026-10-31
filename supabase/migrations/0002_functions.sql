-- ═══════════════════════════════════════════════════════════════════════════
-- BONNE HUMEUR TV — Migration 0002 : Fonctions, triggers, sécurité
-- À appliquer APRÈS 0001_schema.sql et AVANT 0003_rls.sql.
-- L'ordre 0002 (fonctions) → 0003 (RLS) est OBLIGATOIRE : les politiques de
-- 0003_rls.sql appellent current_role()/has_role()/is_staff() — PostgreSQL
-- résout les fonctions DÈS LA CRÉATION d'une policy (invalidé : l'ancien ordre
-- « RLS avant fonctions » échouait avec « function public.has_role does not
-- exist », prouvé par exécution réelle sur PostgreSQL isolé — cf. rapport).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- Fonctions de rôle — SECURITY DEFINER pour éviter la récursion RLS.
-- Elles lisent la ligne du profil APPLICABLE à l'utilisateur courant,
-- jamais une valeur fournie par le client.
-- ─────────────────────────────────────────────────────────────
create or replace function public.current_role() returns text
language sql stable security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.has_role(p_role text) returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid()) = p_role,
    false
  );
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public
as $$
  select public.has_role('admin');
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid()) in ('admin', 'editor', 'reporter'),
    false
  );
$$;

-- ─────────────────────────────────────────────────────────────
-- Trigger : création automatique du profil à l'inscription.
-- Le rôle est FORCÉ à 'reporter' : aucune inscription ne peut créer un admin.
-- ─────────────────────────────────────────────────────────────
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    'reporter'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- Trigger : mise à jour automatique de updated_at
-- ─────────────────────────────────────────────────────────────
create or replace function public.touch_updated_at() returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger articles_touch before update on public.articles
  for each row execute function public.touch_updated_at();
create trigger videos_touch before update on public.videos
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Trigger : journal d'audit des opérations administratives
-- SECURITY DEFINER : fonctionne même via service_role (contourne RLS
-- d'insertion, ce qui est sûr : le journal doit rester en append-only).
-- ─────────────────────────────────────────────────────────────
create or replace function public.audit_row_change() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_entity text := tg_argv[0]::text;
  v_row record;
  v_id text;
begin
  if (tg_op = 'DELETE') then
    v_row := old;
  else
    v_row := new;
  end if;
  begin
    v_id := coalesce(v_row.id::text, v_row.slug::text, null);
  exception when others then
    v_id := null;
  end;
  insert into public.audit_logs (actor_id, action, entity, entity_id)
  values (
    auth.uid(),
    lower(tg_op),
    v_entity,
    v_id
  );
  if (tg_op = 'DELETE') then
    return old;
  end if;
  return new;
end;
$$;

create trigger articles_audit after insert or update or delete on public.articles
  for each row execute function public.audit_row_change('articles');
create trigger videos_audit after insert or update or delete on public.videos
  for each row execute function public.audit_row_change('videos');
create trigger breaking_news_audit after insert or update or delete on public.breaking_news
  for each row execute function public.audit_row_change('breaking_news');
create trigger partnership_requests_audit after insert or update on public.partnership_requests
  for each row execute function public.audit_row_change('partnership_requests');
create trigger contact_messages_audit after insert or update on public.contact_messages
  for each row execute function public.audit_row_change('contact_messages');
create trigger profiles_audit after update on public.profiles
  for each row execute function public.audit_row_change('profiles');

-- ─────────────────────────────────────────────────────────────
-- RATE LIMITING serveur (partagé entre instances serverless : la BASE
-- est l'état commun — pas de mémoire locale).
-- Appelée UNIQUEMENT par le serveur (service_role, cf. lib/actions) :
-- SECURITY DEFINER + pas de grant à anon/authenticated.
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
  if p_form_type not in ('contact', 'partnership') then
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

  -- Purge légère des vieilles entrées (1 ligne sur ~20) pour éviter la
  -- croissance infinie sans coût systématique.
  if random() < 0.05 then
    delete from public.form_submissions
    where created_at < now() - interval '7 days';
  end if;

  return true;
end;
$$;

revoke all on function public.check_rate_limit(text, text, integer, integer) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- Recherche publique (articles + vidéos) — évite d'exposer le contenu
-- non publié et contourne l'ILIKE côté client.
-- ─────────────────────────────────────────────────────────────
create or replace function public.search_published(
  p_query text,
  p_limit integer default 20
) returns json
language sql stable security definer set search_path = public
as $$
  select json_build_object(
    'articles', coalesce((
      select json_agg(t) from (
        select a.id, a.title, a.slug, a.excerpt, a.featured_image, a.published_at,
               c.name as category_name, c.slug as category_slug
        from public.articles a
        left join public.categories c on c.id = a.category_id
        where a.status = 'published' and a.published_at <= now()
          and (a.title ilike '%' || p_query || '%' or coalesce(a.excerpt,'') ilike '%' || p_query || '%')
        order by a.published_at desc
        limit p_limit
      ) t
    ), '[]'::json),
    'videos', coalesce((
      select json_agg(t) from (
        select v.id, v.title, v.slug, v.thumbnail_url, v.published_at,
               c.name as category_name, c.slug as category_slug
        from public.videos v
        left join public.categories c on c.id = v.category_id
        where v.status = 'published'
          and (v.title ilike '%' || p_query || '%' or coalesce(v.description,'') ilike '%' || p_query || '%')
        order by v.published_at desc
        limit p_limit
      ) t
    ), '[]'::json)
  );
$$;

grant execute on function public.search_published(text, integer) to anon, authenticated;