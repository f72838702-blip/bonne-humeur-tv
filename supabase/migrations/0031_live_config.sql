-- ─────────────────────────────────────────────────────────────────────────────
-- BONNE HUMEUR TV — Migration 0031 : Configuration du DIRECT YouTube
-- Appliquée UNIQUEMENT après autorisation de la direction (API Management).
-- Zéro donnée personnelle : table de configuration mono-ligne ne contenant
-- que des paramètres publics d'affichage (identifiants YouTube destinés au
-- lecteur public) + le dernier état de détection.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.live_config (
  id text primary key default 'default' check (id = 'default'),
  enabled boolean not null default false,
  -- auto = détection YouTube automatique ; manual = la rédaction colle le
  -- lien du direct en cours ; off = module détecteur désactivé (le module
  -- « section LIVE » reste régi par `enabled`).
  mode text not null default 'auto' check (mode in ('auto', 'manual', 'off')),
  manual_video_id text check (manual_video_id is null or manual_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  replay_video_id text check (replay_video_id is null or replay_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  last_state text check (last_state is null or last_state in ('live', 'none', 'unconfigured', 'error')),
  last_checked_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.live_config enable row level security;

-- Lecture PUBLIQUE : la ligne ne contient rien de privé — uniquement des
-- paramètres d'affichage déjà destinés aux visiteurs (identifiants YouTube
-- publics, état du direct). Les règles d'écriture sont en dessous.
drop policy if exists live_config_select_public on public.live_config;
create policy live_config_select_public
  on public.live_config for select
  to anon, authenticated
  using (true);

-- Écriture : ADMIN uniquement (RLS = contrôle final, l'action serveur
-- revérifie requireRole(["admin"]) avant — défense en profondeur).
drop policy if exists live_config_admin_insert on public.live_config;
create policy live_config_admin_insert
  on public.live_config for insert
  to authenticated
  with check (has_role('admin'));

drop policy if exists live_config_admin_update on public.live_config;
create policy live_config_admin_update
  on public.live_config for update
  to authenticated
  using (has_role('admin'))
  with check (has_role('admin'));

drop policy if exists live_config_admin_delete on public.live_config;
create policy live_config_admin_delete
  on public.live_config for delete
  to authenticated
  using (has_role('admin'));

grant select on public.live_config to anon, authenticated;
grant insert, update, delete on public.live_config to authenticated;

-- Durcissement : Supabase accorde par défaut ALL aux rôles de base —
-- TRUNCATE n'est PAS couvert par RLS. anon n'a besoin QUE de SELECT ;
-- la rédaction n'a jamais besoin de TRUNCATE/REFERENCES/REFERENCES.
revoke insert, update, delete, truncate, references, trigger on public.live_config from anon;
revoke truncate, references, trigger on public.live_config from authenticated;

-- Horodatage automatique (fonction standard 0002).
drop trigger if exists live_config_touch on public.live_config;
create trigger live_config_touch
  before update on public.live_config
  for each row execute function public.touch_updated_at();

-- Ligne unique prête à l'emploi — le module est DÉSACTIVÉ par défaut :
-- zéro rien ne s'affiche sur la page d'accueil avant activation.
insert into public.live_config (id) values ('default')
  on conflict (id) do nothing;
