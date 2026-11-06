-- ═══════════════════════════════════════════════════════════════════════════
-- BONNE HUMEUR TV — Migration 0034 : Studio de design (apparence du site)
--
-- PRÉPARÉE LOCALEMENT — NE PAS APPLIQUER SUR LA BASE DISTANTE SANS
-- AUTORISATION EXPLICITE DE LA DIRECTION.
--
-- Configurations du design = JSON validé CÔTÉ SERVEUR (schéma Zod, listes
-- fermées, hexadécimaux normalisés — JAMAIS de CSS/HTML/JS bruts ni de
-- texte libre hors liste blanche de clés). Trois tables :
--   site_design (mono-ligne)   : jsonb « published » — la SEULE source de
--                                vérité du site public (anonyme peut lire).
--   site_design_draft (admin)  : brouillon en cours d'édition (jamais
--                                visible du public — le site public ne
--                                change JAMAIS avant publication).
--   site_design_versions      : historique des designs PUBLIÉS (snapshots,
--                                restauration possible — 200 dernières).
--
-- Valeur par défaut : published = 'default' (jsonb minimal) → l'application
-- interprète l'absence de surcharge comme « thème par défaut » : le site ne
-- casse jamais si la migration n'est pas appliquée (dégradation gracieuse).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Design publié (mono-ligne publique) ────────────────────────────────────
create table public.site_design (
  id int primary key default 1 check (id = 1),
  -- Design effectivement affiché au public. 'null'::jsonb = thème par défaut.
  published jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.site_design (id, published) values (1, null::jsonb)
  on conflict (id) do nothing;

alter table public.site_design enable row level security;

-- Le design publié fait partie du site public : tout le monde peut le lire
-- (anonyme + authenticated). C'est la seule policy : aucune écriture
-- possible via la RLS côté clients — la publication passe par le
-- service_role (Server Action admin) et jamais par le navigateur.
create policy site_design_public_select
  on public.site_design for select to anon, authenticated
  using (true);

grant select on public.site_design to anon, authenticated;
revoke truncate, references, trigger on public.site_design from authenticated;

drop trigger if exists site_design_touch on public.site_design;
create trigger site_design_touch
  before update on public.site_design
  for each row execute function public.touch_updated_at();

drop trigger if exists site_design_audit on public.site_design;
create trigger site_design_audit
  after insert or update or delete on public.site_design
  for each row execute function public.audit_row_change('site_design');

-- ─── Brouillon (privé admin/éditeur) ───────────────────────────────────────
create table public.site_design_draft (
  updated_by uuid not null references public.profiles(id) on delete cascade,
  -- Brouillon en cours. 'null'::jsonb = aucun brouillon (thème publié).
  content jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (updated_by)
);

alter table public.site_design_draft enable row level security;

create policy site_design_draft_read
  on public.site_design_draft for select to authenticated
  using (
    exists (select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'editor'))
  );

create policy site_design_draft_write
  on public.site_design_draft for insert to authenticated
  with check (
    updated_by = auth.uid()
    and exists (select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'editor'))
  );

create policy site_design_draft_modify
  on public.site_design_draft for update to authenticated
  using (
    -- admin : peut modifier n'importe quel brouillon (p. ex. prend la main
    -- sur un brouillon d'éditeur) ; éditeur : only le sien.
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or updated_by = auth.uid()
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or updated_by = auth.uid()
  );

create policy site_design_draft_drop
  on public.site_design_draft for delete to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or updated_by = auth.uid()
  );

grant select, insert, update, delete on public.site_design_draft to authenticated;
revoke all on public.site_design_draft from anon;
revoke truncate, references, trigger on public.site_design_draft from authenticated;

drop trigger if exists site_design_draft_touch on public.site_design_draft;
create trigger site_design_draft_touch
  before update on public.site_design_draft
  for each row execute function public.touch_updated_at();

drop trigger if exists site_design_draft_audit on public.site_design_draft;
create trigger site_design_draft_audit
  after insert or update or delete on public.site_design_draft
  for each row execute function public.audit_row_change('site_design_draft');

-- ─── Historique des publications (snapshots admin) ──────────────────────────
create table public.site_design_versions (
  id bigint generated always as identity primary key,
  -- Snapshot complet du design au moment de la publication.
  snapshot jsonb not null,
  published_by uuid references public.profiles(id) on delete set null,
  -- Description courte (texte JSX-échappé côté rendu admin, aucune injection)
  note text not null default 'Publication du design',
  created_at timestamptz not null default now()
);

create index site_design_versions_recent_idx
  on public.site_design_versions (created_at desc);

alter table public.site_design_versions enable row level security;

create policy site_design_versions_read
  on public.site_design_versions for select to authenticated
  using (
    exists (select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'editor'))
  );

create policy site_design_versions_write
  on public.site_design_versions for insert to authenticated
  with check (
    exists (select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'editor'))
  );

grant select, insert on public.site_design_versions to authenticated;
revoke all on public.site_design_versions from anon;
-- Historique IMMUABLE : aucune mise à jour/suppression possible, même admin
-- (la reprise d'un ancien design = un NOUVEAU snapshot en brouillon).
revoke update, delete, truncate, references, trigger
  on public.site_design_versions from authenticated;
