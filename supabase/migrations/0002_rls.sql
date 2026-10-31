-- ═══════════════════════════════════════════════════════════════════════════
-- BONNE HUMEUR TV — Migration 0002 : Row Level Security
-- À appliquer APRÈS 0001_schema.sql
--
-- Principes :
--   • Le public ne voit QUE les contenus publiés (articles, vidéos, flash-infos
--     actifs) — jamais les brouillons, demandes B2B, messages ni audits.
--   • Les reporters gèrent leurs propres articles (draft/review).
--   • Les editors gèrent tous les contenus éditoriaux.
--   • Les admins gèrent tout, y compris les rôles.
--   • Un utilisateur ne peut JAMAIS s'attribuer lui-même un rôle privilégié.
--   • La protection d'une page frontend ne compte PAS comme contrôle d'accès :
--     chaque règle est appliquée PAR LA BASE.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.profiles            enable row level security;
alter table public.categories          enable row level security;
alter table public.tags                enable row level security;
alter table public.article_tags        enable row level security;
alter table public.articles            enable row level security;
alter table public.videos              enable row level security;
alter table public.breaking_news       enable row level security;
alter table public.partnership_requests enable row level security;
alter table public.contact_messages    enable row level security;
alter table public.form_submissions    enable row level security;
alter table public.audit_logs          enable row level security;

-- ─────────────────────────────────────────────────────────────
-- PROFILES
-- Lecture : soi-même, ou admin/editor (gestion d'équipe).
-- Écriture : soi-même SANS changer son rôle (l'anti-élévation passe par
-- la comparaison avec current_role(), cf. 0003) ; admin : tout.
-- ─────────────────────────────────────────────────────────────
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.has_role('admin') or public.has_role('editor'));

create policy "profiles_update" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.has_role('admin'))
  with check (
    (id = auth.uid() and role = public.current_role())  -- on ne change PAS son propre rôle
    or public.has_role('admin')                          -- seul un admin change les rôles
  );

-- Pas d'insert/delete via l'API publique : les comptes sont créés par
-- l'inscription Auth (trigger 0003) et supprimés depuis le dashboard.

-- ─────────────────────────────────────────────────────────────
-- Vue publique limitée : byline des auteurs (id + nom, RIEN d'autre)
-- ─────────────────────────────────────────────────────────────
create or replace view public.author_names as
  select id, full_name from public.profiles;

grant select on public.author_names to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- CATEGORIES / TAGS / ARTICLE_TAGS
-- Publiques en lecture, gérées par editor+
-- ─────────────────────────────────────────────────────────────
create policy "categories_public_select" on public.categories
  for select using (true);
create policy "categories_manage" on public.categories
  for all to authenticated
  using (public.has_role('admin') or public.has_role('editor'))
  with check (public.has_role('admin') or public.has_role('editor'));

create policy "tags_public_select" on public.tags
  for select using (true);
create policy "tags_manage" on public.tags
  for all to authenticated
  using (public.has_role('admin') or public.has_role('editor'))
  with check (public.has_role('admin') or public.has_role('editor'));

create policy "article_tags_public_select" on public.article_tags
  for select using (true);
create policy "article_tags_manage" on public.article_tags
  for all to authenticated
  using (public.has_role('admin') or public.has_role('editor'))
  with check (public.has_role('admin') or public.has_role('editor'));

-- ─────────────────────────────────────────────────────────────
-- ARTICLES
-- Public : publiés et datés (published_at atteint).
-- Reporter : voit et modifie SES articles en draft/review ; soumission à
-- validation = passage en 'review' ; NE PEUT PAS publier ni archiver.
-- Editor/Admin : tout.
-- ─────────────────────────────────────────────────────────────
create policy "articles_public_select" on public.articles
  for select using (
    status = 'published' and published_at is not null and published_at <= now()
  );

create policy "articles_staff_select" on public.articles
  for select to authenticated
  using (
    author_id = auth.uid()
    or public.has_role('admin') or public.has_role('editor')
  );

create policy "articles_insert" on public.articles
  for insert to authenticated
  with check (
    (author_id = auth.uid() and status in ('draft', 'review'))
    or public.has_role('admin') or public.has_role('editor')
  );

create policy "articles_update" on public.articles
  for update to authenticated
  using (
    (author_id = auth.uid() and status in ('draft', 'review'))
    or public.has_role('admin') or public.has_role('editor')
  )
  with check (
    -- Un reporter ne peut pas s'auto-publier (pas d'opérateur implies en SQL :
    -- logique « non(auteur=moi) OU statut_brouillon »)
    (author_id is distinct from auth.uid() or status in ('draft', 'review'))
    or public.has_role('admin') or public.has_role('editor')
  );

create policy "articles_delete" on public.articles
  for delete to authenticated
  using (public.has_role('admin') or public.has_role('editor'));

-- ─────────────────────────────────────────────────────────────
-- VIDEOS — publiques en lecture publiée ; editor+ en gestion
-- ─────────────────────────────────────────────────────────────
create policy "videos_public_select" on public.videos
  for select using (
    status = 'published'
    or (is_live is true and status = 'published')
  );

create policy "videos_staff_select" on public.videos
  for select to authenticated
  using (public.is_staff());

create policy "videos_manage" on public.videos
  for all to authenticated
  using (public.has_role('admin') or public.has_role('editor'))
  with check (public.has_role('admin') or public.has_role('editor'));

-- ─────────────────────────────────────────────────────────────
-- BREAKING_NEWS — publiques si actives et dans leur période ; editor+ gère
-- ─────────────────────────────────────────────────────────────
create policy "breaking_news_public_select" on public.breaking_news
  for select using (
    is_active
    and (start_at is null or start_at <= now())
    and (end_at is null or end_at >= now())
  );

create policy "breaking_news_staff_select" on public.breaking_news
  for select to authenticated
  using (public.is_staff());

create policy "breaking_news_manage" on public.breaking_news
  for all to authenticated
  using (public.has_role('admin') or public.has_role('editor'))
  with check (public.has_role('admin') or public.has_role('editor'));

-- ─────────────────────────────────────────────────────────────
-- PARTNERSHIP_REQUESTS / CONTACT_MESSAGES
-- Anon : INSERT uniquement (jamais de lecture publique).
-- Staff (admin/editor) : lecture + suivi de traitement.
-- ─────────────────────────────────────────────────────────────
create policy "partnership_requests_public_insert" on public.partnership_requests
  for insert to anon with check (true);

create policy "partnership_requests_staff_select" on public.partnership_requests
  for select to authenticated
  using (public.has_role('admin') or public.has_role('editor'));

create policy "partnership_requests_staff_update" on public.partnership_requests
  for update to authenticated
  using (public.has_role('admin') or public.has_role('editor'))
  with check (public.has_role('admin') or public.has_role('editor'));

create policy "contact_messages_public_insert" on public.contact_messages
  for insert to anon with check (true);

create policy "contact_messages_staff_select" on public.contact_messages
  for select to authenticated
  using (public.has_role('admin') or public.has_role('editor'));

create policy "contact_messages_staff_update" on public.contact_messages
  for update to authenticated
  using (public.has_role('admin') or public.has_role('editor'))
  with check (public.has_role('admin') or public.has_role('editor'));

-- ─────────────────────────────────────────────────────────────
-- FORM_SUBMISSIONS : RLS activé, AUCUNE policy →
-- inaccessible via anon/authenticated (uniquement service_role + RPC).
-- ─────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────
-- AUDIT_LOGS : écriture par le staff (trigger), lecture admin UNIQUEMENT.
-- Aucune policy update/delete : le journal est en append-only.
-- ─────────────────────────────────────────────────────────────
create policy "audit_logs_staff_insert" on public.audit_logs
  for insert to authenticated
  with check (public.is_staff());

create policy "audit_logs_admin_select" on public.audit_logs
  for select to authenticated
  using (public.has_role('admin'));