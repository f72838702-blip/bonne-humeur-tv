-- ═══════════════════════════════════════════════════════════════════════════
-- BONNE HUMEUR MÉDIA — Migration 0036 : gestion multi-administrateurs
-- et hiérarchie des permissions (mission 10/11/2026).
--
-- PRINCIPE — PROLONGER l'architecture existante (aucun 2e système) :
--   • nouveau rôle SQL 'super_admin' (aucune inscription ne peut l'obtenir) ;
--   • profil : + permissions text[] (granularité par module) et is_active
--     boolean (suspension RÉELLE : perte RLS immédiate, même jeton valide) ;
--   • protections EN BASE du Super Administrateur (triggers) : rôle,
--     permissions et statut immuables, compte insupprimable, garde
--     « dernier administrateur », seuls les super admins requalifient un admin ;
--   • politiques recréées avec PERMISSION par module (l'éditeur sans la
--     permission n'accède à AUCUNE donnée du module, même en appelant
--     l'API directement) et lecture « consultation » limitée.
--
-- CONSERVÉ À L'IDENTIQUE : les 3 rôles admin/editor/reporter et TOUT le
-- comportement existant pour le compte admin (devenu super_admin par UNE
-- écriture de données appliquée séparément, sur autorisation explicite).
--
-- ADDITIF UNIQUEMENT : aucune table supprimée, aucune donnée effacée,
-- aucune colonne retirée. Idempotent (drop if exists + create).
--
-- NOTE (rôle des éditeurs) : la base est SANS compte editor en production
-- (vérifié 10/11 : un seul profil, rôle admin). Les politiques recréées
-- exigent donc des PERMISSIONS explicites pour l'éditeur — aucun droit
-- existant n'est perdu par un compte réel. L'interface et les Server
-- Actions appliquent la même granularité au-dessus.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 1) RÔLE + COLONNES
-- ─────────────────────────────────────────────────────────────
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'editor', 'reporter', 'super_admin'));

alter table public.profiles add column if not exists permissions text[]
  not null default '{}';
alter table public.profiles add column if not exists is_active boolean
  not null default true;

-- Clés de permissions fermées (contrainte en base : aucune valeur inconnue).
alter table public.profiles drop constraint if exists profiles_permissions_keys_check;
alter table public.profiles add constraint profiles_permissions_keys_check
  check (permissions <@ array[
    'articles', 'articles_publier', 'articles_tous',
    'videos', 'flash', 'directs',
    'publicite', 'publicite_approuver',
    'consultation'
  ]);

comment on constraint profiles_permissions_keys_check on public.profiles is
  'Clés autorisées : articles, articles_publier, articles_tous, videos, flash, directs, publicite, publicite_approuver, consultation.';

-- ─────────────────────────────────────────────────────────────
-- 2) FONCTIONS DE RÔLE — redéfinies pour la hiérarchie
--    has_role('admin') inclut désormais super_admin (TOUTES les politiques
--    existantes « admin uniquement » donnent automatiquement accès au
--    super administrateur, sans les recréer une à une).
--    TOUT est gated par is_active : un compte suspendu perd ses pouvoir RLS.
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
    (select
       case
         when p_role = 'admin' then role in ('admin', 'super_admin')
         else role = p_role
       end
       and is_active
     from public.profiles where id = auth.uid()),
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
    (select is_active and role in ('admin', 'super_admin', 'editor', 'reporter')
     from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select is_active and role = 'super_admin'
     from public.profiles where id = auth.uid()),
    false
  );
$$;

-- Permission granulaire : admin/super_admin = tout ; éditeur = clé explicite
-- dans profiles.permissions. Jamais une valeur du navigateur.
create or replace function public.has_permission(p_key text) returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select
       is_active and (
         role in ('admin', 'super_admin')
         or (role = 'editor' and p_key = any(permissions))
       )
     from public.profiles where id = auth.uid()),
    false
  );
$$;

-- ─────────────────────────────────────────────────────────────
-- 3) PROTECTION DU SUPER ADMINISTRATEUR + GARDE « DERNIER ADMIN »
--    Trigger BEFORE sur profiles — s'applique À TOUT le monde, y compris
--    session valide et service_role. Seuls les super admins (session) ou
--    le propriétaire de la base (migration « postgres », SQL Editor)
--    peuvent requalifier un compte en/depuis admin|super_admin.
-- ─────────────────────────────────────────────────────────────
create or replace function public.protect_profile_privileges() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_admins integer;
begin
  if tg_op = 'DELETE' then
    -- 1) Super Administrateur : compte INSUPPRIMABLE (cascade Auth bloquée).
    if old.role = 'super_admin' then
      raise exception 'Le compte Super Administrateur ne peut pas être supprimé.';
    end if;

    -- 2) Garde « dernier administrateur » : jamais 0 admin|super_admin actif.
    if old.role in ('admin', 'super_admin') then
      select count(*) into v_admins from public.profiles
        where id <> old.id and role in ('admin', 'super_admin') and is_active;
      if v_admins = 0 then
        raise exception 'Impossible de supprimer le dernier administrateur.';
      end if;
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    -- 3) Super Administrateur : rôle, permissions et statut IMMUABLES.
    if old.role = 'super_admin' and (
         new.role is distinct from old.role
         or new.permissions is distinct from old.permissions
         or new.is_active is distinct from old.is_active) then
      raise exception 'Le rôle, les permissions et le statut du Super Administrateur sont protégés.';
    end if;

    -- 4) Aucun compte ne peut modifier SON PROPRE rôle / permissions / statut
    --    (règle mission §4.4 : « un administrateur ne peut pas modifier
    --    ses propres permissions »).
    if old.id = auth.uid() and (
         new.role is distinct from old.role
         or new.permissions is distinct from old.permissions
         or new.is_active is distinct from old.is_active) then
      raise exception 'Un compte ne peut pas modifier son propre rôle, ses permissions ou son statut.';
    end if;

    -- 5) Seuls les Super Administrateurs requalifient un compte
    --    administrateur (règles §4.6/§4.7 : personne d'autre ne peut créer,
    --    modifier ou dégrader un admin). Le souverain SANS session JWT
    --    (migrations postgres / SQL Editor) reste souverain : auth.uid()
    --    est NULL hors session (ne JAMAIS tester current_user ici — dans
    --    une fonction security definer, current_user vaut TOUJOURS le
    --    propriétaire de la fonction, donc « postgres », et la clause
    --    n'aurait bloqué personne).
    if new.role is distinct from old.role
       and (old.role in ('admin', 'super_admin') or new.role in ('admin', 'super_admin'))
       and not public.is_super_admin()
       and auth.uid() is not null then
      raise exception 'Seul le Super Administrateur peut modifier le rôle d''un administrateur.';
    end if;

    -- 6) Garde « dernier administrateur » : jamais 0 admin|super_admin actif.
    if old.role in ('admin', 'super_admin') and not (new.role in ('admin', 'super_admin') and coalesce(new.is_active, false)) then
      select count(*) into v_admins from public.profiles
        where id <> old.id and role in ('admin', 'super_admin') and is_active;
      if v_admins = 0 then
        raise exception 'Impossible de retirer le dernier administrateur.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protect_privileges on public.profiles;
create trigger profiles_protect_privileges
  before insert or update or delete on public.profiles
  for each row execute function public.protect_profile_privileges();

-- ─────────────────────────────────────────────────────────────
-- 4) JOURNAL D'AUDIT — delta complet sur chaque changement de profil
--    (ancien → nouveau rôle / permissions / statut, avec l'auteur
--    auth.uid()) + trace des suppressions de profil.
-- ─────────────────────────────────────────────────────────────
create or replace function public.audit_profile_delta() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (
    auth.uid(),
    'update',
    'profiles',
    old.id,
    jsonb_build_object(
      'role_before', old.role, 'role_after', new.role,
      'permissions_before', to_jsonb(old.permissions),
      'permissions_after', to_jsonb(new.permissions),
      'is_active_before', old.is_active, 'is_active_after', new.is_active
    )
  );
  return new;
end;
$$;

drop trigger if exists profiles_audit_delta on public.profiles;
create trigger profiles_audit_delta
  after update on public.profiles
  for each row execute function public.audit_profile_delta();

create or replace function public.audit_profile_delete() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.audit_logs (action, entity, entity_id, details)
  values ('delete', 'profiles', old.id,
          jsonb_build_object('role_before', old.role, 'full_name', old.full_name));
  return old;
end;
$$;

drop trigger if exists profiles_audit_delete on public.profiles;
create trigger profiles_audit_delete
  after delete on public.profiles
  for each row execute function public.audit_profile_delete();

-- ─────────────────────────────────────────────────────────────
-- 5) PROFILES — politiques recréées (lecture durcie : éditeur = soi-même
--    seulement ; gestion d'équipe = admin | super_admin)
-- ─────────────────────────────────────────────────────────────
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.has_role('admin'));

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.has_role('admin'))
  with check (
    (id = auth.uid() and role = public.current_role())
    or public.has_role('admin')
  );

-- ─────────────────────────────────────────────────────────────
-- 6) CATEGORIES / TAGS / ARTICLE_TAGS → permission 'articles'
-- ─────────────────────────────────────────────────────────────
drop policy if exists "categories_manage" on public.categories;
create policy "categories_manage" on public.categories
  for all to authenticated
  using (public.has_role('admin') or public.has_permission('articles'))
  with check (public.has_role('admin') or public.has_permission('articles'));

drop policy if exists "tags_manage" on public.tags;
create policy "tags_manage" on public.tags
  for all to authenticated
  using (public.has_role('admin') or public.has_permission('articles'))
  with check (public.has_role('admin') or public.has_permission('articles'));

drop policy if exists "article_tags_manage" on public.article_tags;
create policy "article_tags_manage" on public.article_tags
  for all to authenticated
  using (public.has_role('admin') or public.has_permission('articles'))
  with check (public.has_role('admin') or public.has_permission('articles'));

-- ─────────────────────────────────────────────────────────────
-- 7) ARTICLES — granularité : 'articles' (les siens, sans publier),
--    'articles_tous' (ceux des autres), 'articles_publier' (publier/
--    dépublier/corbeille). Reporters : leurs brouillons, comme avant.
-- ─────────────────────────────────────────────────────────────
drop policy if exists "articles_staff_select" on public.articles;
create policy "articles_staff_select" on public.articles
  for select to authenticated
  using (
    (author_id = auth.uid() and public.is_staff()) -- suspendu : AUCUNE lecture, même les siens
    or public.has_role('admin')
    or public.has_permission('articles')
    or public.has_permission('articles_tous')
    or public.has_permission('articles_publier')
    or public.has_permission('consultation')
  );

drop policy if exists "articles_insert" on public.articles;
create policy "articles_insert" on public.articles
  for insert to authenticated
  with check (
    (public.has_role('reporter') and author_id = auth.uid()
      and status in ('draft', 'review'))
    or (author_id = auth.uid() and public.has_permission('articles')
      and status in ('draft', 'review'))
    or (public.has_permission('articles_tous') and status in ('draft', 'review'))
    or public.has_permission('articles_publier')
    or public.has_role('admin')
  );

drop policy if exists "articles_update" on public.articles;
create policy "articles_update" on public.articles
  for update to authenticated
  using (
    (public.has_role('reporter') and author_id = auth.uid()
      and status in ('draft', 'review'))
    or (author_id = auth.uid() and public.has_permission('articles'))
    or public.has_permission('articles_tous')
    or public.has_permission('articles_publier')
    or public.has_role('admin')
  )
  with check (
    (public.has_role('reporter') and author_id = auth.uid()
      and status in ('draft', 'review'))
    -- les siens SANS la permission de publier restent en draft/review
    or (author_id = auth.uid() and public.has_permission('articles')
      and status in ('draft', 'review'))
    or public.has_permission('articles_tous')
    or public.has_permission('articles_publier')
    or public.has_role('admin')
  );

drop policy if exists "articles_delete" on public.articles;
create policy "articles_delete" on public.articles
  for delete to authenticated
  using (public.has_role('admin') or public.has_permission('articles_publier'));

-- ─────────────────────────────────────────────────────────────
-- 8) VIDEOS → permission 'videos' ; BREAKING_NEWS (flash-infos) → 'flash'
--    (lecture staff conservée + « consultation »)
-- ─────────────────────────────────────────────────────────────
drop policy if exists "videos_staff_select" on public.videos;
create policy "videos_staff_select" on public.videos
  for select to authenticated
  using (public.is_staff() or public.has_permission('consultation'));

drop policy if exists "videos_manage" on public.videos;
create policy "videos_manage" on public.videos
  for all to authenticated
  using (public.has_role('admin') or public.has_permission('videos'))
  with check (public.has_role('admin') or public.has_permission('videos'));

drop policy if exists "breaking_news_staff_select" on public.breaking_news;
create policy "breaking_news_staff_select" on public.breaking_news
  for select to authenticated
  using (public.is_staff() or public.has_permission('consultation'));

drop policy if exists "breaking_news_manage" on public.breaking_news;
create policy "breaking_news_manage" on public.breaking_news
  for all to authenticated
  using (public.has_role('admin') or public.has_permission('flash'))
  with check (public.has_role('admin') or public.has_permission('flash'));

-- ─────────────────────────────────────────────────────────────
-- 9) DEMANDES (contact / partenariat) — lecture = permission
--    'consultation' ; traitement (statuts) = admin | super_admin
-- ─────────────────────────────────────────────────────────────
drop policy if exists "partnership_requests_staff_select" on public.partnership_requests;
create policy "partnership_requests_staff_select" on public.partnership_requests
  for select to authenticated
  using (public.has_role('admin') or public.has_permission('consultation'));

drop policy if exists "partnership_requests_staff_update" on public.partnership_requests;
create policy "partnership_requests_staff_update" on public.partnership_requests
  for update to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

drop policy if exists "contact_messages_staff_select" on public.contact_messages;
create policy "contact_messages_staff_select" on public.contact_messages
  for select to authenticated
  using (public.has_role('admin') or public.has_permission('consultation'));

drop policy if exists "contact_messages_staff_update" on public.contact_messages;
create policy "contact_messages_staff_update" on public.contact_messages
  for update to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

-- Historique des réponses : lecture admin | super_admin seulement.
drop policy if exists "request_replies_staff_select" on public.request_replies;
create policy "request_replies_staff_select" on public.request_replies
  for select to authenticated
  using (public.has_role('admin'));

-- ─────────────────────────────────────────────────────────────
-- 10) RÉGIE PUBLICITAIRE → 'publicite' (+ 'publicite_approuver' pour
--     validations, statuts et suppressions ; placements/config = admin)
-- ─────────────────────────────────────────────────────────────
drop policy if exists "advertisers_staff_select" on public.advertisers;
create policy "advertisers_staff_select" on public.advertisers
  for select to authenticated
  using (public.has_role('admin') or public.has_permission('publicite')
         or public.has_permission('publicite_approuver')
         or public.has_permission('consultation'));

drop policy if exists "advertisers_admin_insert" on public.advertisers;
create policy "advertisers_admin_insert" on public.advertisers
  for insert to authenticated
  with check (public.has_role('admin') or public.has_permission('publicite'));

drop policy if exists "advertisers_staff_update" on public.advertisers;
create policy "advertisers_staff_update" on public.advertisers
  for update to authenticated
  using (public.has_role('admin') or public.has_permission('publicite'))
  with check (public.has_role('admin') or public.has_permission('publicite'));

drop policy if exists "advertisers_admin_delete" on public.advertisers;
create policy "advertisers_admin_delete" on public.advertisers
  for delete to authenticated
  using (public.has_role('admin') or public.has_permission('publicite_approuver'));

drop policy if exists "ad_campaigns_staff_select" on public.ad_campaigns;
create policy "ad_campaigns_staff_select" on public.ad_campaigns
  for select to authenticated
  using (public.has_role('admin') or public.has_permission('publicite')
         or public.has_permission('publicite_approuver')
         or public.has_permission('consultation'));

drop policy if exists "ad_campaigns_staff_insert" on public.ad_campaigns;
create policy "ad_campaigns_staff_insert" on public.ad_campaigns
  for insert to authenticated
  with check (public.has_role('admin') or public.has_permission('publicite'));

drop policy if exists "ad_campaigns_staff_update" on public.ad_campaigns;
create policy "ad_campaigns_staff_update" on public.ad_campaigns
  for update to authenticated
  using (public.has_role('admin') or public.has_permission('publicite'))
  with check (public.has_role('admin') or public.has_permission('publicite'));

drop policy if exists "ad_campaigns_admin_delete" on public.ad_campaigns;
create policy "ad_campaigns_admin_delete" on public.ad_campaigns
  for delete to authenticated
  using (public.has_role('admin') or public.has_permission('publicite_approuver'));

drop policy if exists "ad_creatives_staff_select" on public.ad_creatives;
create policy "ad_creatives_staff_select" on public.ad_creatives
  for select to authenticated
  using (public.has_role('admin') or public.has_permission('publicite')
         or public.has_permission('publicite_approuver')
         or public.has_permission('consultation'));

drop policy if exists "ad_creatives_staff_insert" on public.ad_creatives;
create policy "ad_creatives_staff_insert" on public.ad_creatives
  for insert to authenticated
  with check (public.has_role('admin') or public.has_permission('publicite'));

-- NB PostgreSQL : dans une policy, les colonnes non qualifiées désignent la
-- ligne OLD dans using(…) et la ligne NEW dans with check(…).
drop policy if exists "ad_creatives_staff_update" on public.ad_creatives;
create policy "ad_creatives_staff_update" on public.ad_creatives
  for update to authenticated
  using (
    public.has_role('admin')
    or public.has_permission('publicite_approuver')
    or (public.has_permission('publicite') and status <> 'approved') -- OLD : une créative approuvée ne se modifie pas sans approval
  )
  with check (
    public.has_role('admin')
    or public.has_permission('publicite_approuver')
    or (public.has_permission('publicite') and status <> 'approved') -- NEW : ni approuver soi-même sans approval
  );

drop policy if exists "ad_creatives_admin_delete" on public.ad_creatives;
create policy "ad_creatives_admin_delete" on public.ad_creatives
  for delete to authenticated
  using (public.has_role('admin') or public.has_permission('publicite_approuver'));

drop policy if exists "ad_placements_staff_select" on public.ad_placements;
create policy "ad_placements_staff_select" on public.ad_placements
  for select to authenticated
  using (public.has_role('admin') or public.has_permission('publicite')
         or public.has_permission('consultation'));

-- Placement = configuration du site (formats admis) : super_admin/admin.
drop policy if exists "ad_placements_staff_update" on public.ad_placements;
create policy "ad_placements_staff_update" on public.ad_placements
  for update to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

drop policy if exists "ad_campaign_placements_staff_select" on public.ad_campaign_placements;
create policy "ad_campaign_placements_staff_select" on public.ad_campaign_placements
  for select to authenticated
  using (public.has_role('admin') or public.has_permission('publicite')
         or public.has_permission('consultation'));

drop policy if exists "ad_campaign_placements_staff_insert" on public.ad_campaign_placements;
create policy "ad_campaign_placements_staff_insert" on public.ad_campaign_placements
  for insert to authenticated
  with check (public.has_role('admin') or public.has_permission('publicite'));

drop policy if exists "ad_campaign_placements_staff_update" on public.ad_campaign_placements;
create policy "ad_campaign_placements_staff_update" on public.ad_campaign_placements
  for update to authenticated
  using (public.has_role('admin') or public.has_permission('publicite'))
  with check (public.has_role('admin') or public.has_permission('publicite'));

drop policy if exists "ad_campaign_placements_staff_delete" on public.ad_campaign_placements;
create policy "ad_campaign_placements_staff_delete" on public.ad_campaign_placements
  for delete to authenticated
  using (public.has_role('admin') or public.has_permission('publicite'));

-- Règlements : lecture 'publicite' (l'écriture reste ADMIN — 0026 intacte).
drop policy if exists "ad_payments_staff_select" on public.ad_payments;
create policy "ad_payments_staff_select" on public.ad_payments
  for select to authenticated
  using (public.has_role('admin') or public.has_permission('publicite'));

drop policy if exists "ad_daily_stats_staff_select" on public.ad_daily_stats;
create policy "ad_daily_stats_staff_select" on public.ad_daily_stats
  for select to authenticated
  using (public.has_role('admin') or public.has_permission('publicite'));

drop policy if exists "ad_partners_staff_select" on public.ad_partners;
create policy "ad_partners_staff_select" on public.ad_partners
  for select to authenticated
  using (public.has_role('admin') or public.has_permission('publicite')
         or public.has_permission('publicite_approuver')
         or public.has_permission('consultation'));

drop policy if exists "ad_partners_staff_insert" on public.ad_partners;
create policy "ad_partners_staff_insert" on public.ad_partners
  for insert to authenticated
  with check (public.has_role('admin') or public.has_permission('publicite'));

drop policy if exists "ad_partners_staff_update" on public.ad_partners;
create policy "ad_partners_staff_update" on public.ad_partners
  for update to authenticated
  using (public.has_role('admin') or public.has_permission('publicite'))
  with check (public.has_role('admin') or public.has_permission('publicite'));

drop policy if exists "ad_partners_admin_delete" on public.ad_partners;
create policy "ad_partners_admin_delete" on public.ad_partners
  for delete to authenticated
  using (public.has_role('admin') or public.has_permission('publicite_approuver'));

-- ─────────────────────────────────────────────────────────────
-- 11) DIRECT (live_config) → permission 'directs'
-- ─────────────────────────────────────────────────────────────
drop policy if exists live_config_admin_insert on public.live_config;
create policy live_config_admin_insert
  on public.live_config for insert
  to authenticated
  with check (public.has_role('admin') or public.has_permission('directs'));

drop policy if exists live_config_admin_update on public.live_config;
create policy live_config_admin_update
  on public.live_config for update
  to authenticated
  using (public.has_role('admin') or public.has_permission('directs'))
  with check (public.has_role('admin') or public.has_permission('directs'));

drop policy if exists live_config_admin_delete on public.live_config;
create policy live_config_admin_delete
  on public.live_config for delete
  to authenticated
  using (public.has_role('admin') or public.has_permission('directs'));

-- ─────────────────────────────────────────────────────────────
-- 12) STATISTIQUES → + permission 'consultation' (lecture seule)
-- ─────────────────────────────────────────────────────────────
drop policy if exists "analytics_page_views_admin_select" on public.analytics_page_views;
create policy "analytics_page_views_admin_select" on public.analytics_page_views
  for select to authenticated
  using (public.has_role('admin') or public.has_permission('consultation'));

-- ─────────────────────────────────────────────────────────────
-- 13) STUDIO DE DESIGN — paramètres sensibles du site :
--     Super Administrateur (et admin) SEULENT.
-- ─────────────────────────────────────────────────────────────
drop policy if exists site_design_draft_read on public.site_design_draft;
create policy site_design_draft_read
  on public.site_design_draft for select to authenticated
  using (public.has_role('admin'));

drop policy if exists site_design_draft_write on public.site_design_draft;
create policy site_design_draft_write
  on public.site_design_draft for insert to authenticated
  with check (updated_by = auth.uid() and public.has_role('admin'));

drop policy if exists site_design_draft_modify on public.site_design_draft;
create policy site_design_draft_modify
  on public.site_design_draft for update to authenticated
  using (updated_by = auth.uid() or public.has_role('admin'))
  with check (updated_by = auth.uid() or public.has_role('admin'));

drop policy if exists site_design_draft_drop on public.site_design_draft;
create policy site_design_draft_drop
  on public.site_design_draft for delete to authenticated
  using (updated_by = auth.uid() or public.has_role('admin'));

drop policy if exists site_design_versions_read on public.site_design_versions;
create policy site_design_versions_read
  on public.site_design_versions for select to authenticated
  using (public.has_role('admin'));

drop policy if exists site_design_versions_write on public.site_design_versions;
create policy site_design_versions_write
  on public.site_design_versions for insert to authenticated
  with check (public.has_role('admin'));

-- ─────────────────────────────────────────────────────────────
-- 14) JOURNAL D'AUDIT — lecture Super Administrateur uniquement
--     (écriture : déjà par trigger ; aucune update/delete = append-only).
-- ─────────────────────────────────────────────────────────────
drop policy if exists "audit_logs_admin_select" on public.audit_logs;
create policy "audit_logs_admin_select" on public.audit_logs
  for select to authenticated
  using (public.is_super_admin());
