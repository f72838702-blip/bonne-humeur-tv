-- ═══════════════════════════════════════════════════════════════════════════
-- BONNE HUMEUR TV — Migration 0028 : Réponses de l'administrateur
-- (historique chronologique des réponses aux demandes/messages)
-- À appliquer APRÈS 0027.
--
-- PRÉPARÉE LOCALEMENT — NE PAS APPLIQUER SUR LA BASE DISTANTE SANS
-- AUTORISATION EXPLICITE DE LA DIRECTION.
--
-- Contenu :
--   Table request_replies : une LIGNE PAR RÉPONSE/ENVoi — le message
--   initial (partnership_requests / contact_messages) n'est JAMAIS modifié.
--   Deux FK en cascade → supprimer une demande supprime SEULEMENT SON
--   historique, jamais celui des autres.
--   RLS : SELECT admin+éditeur (consultation de l'historique) ; INSERT
--   admin seul (l'envoi est réservé aux administrateurs ; l'action serveur
--   requireRole(["admin"]) réapplique la même règle) ; UPDATE/DELETE admin.
--   Aucune adresse e-mail nulle : le destinataire est copié depuis la
--   demande enregistrée (traçabilité du destinataire réel).
-- ═══════════════════════════════════════════════════════════════════════════

create table public.request_replies (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- Parent (exclusif : exactement l'un des deux, XOR) — cascade : la
  -- suppression d'une demande purge SON historique uniquement, sans jamais
  -- toucher l'historique des autres demandes.
  partnership_request_id uuid references public.partnership_requests(id) on delete cascade,
  contact_message_id     uuid references public.contact_messages(id)    on delete cascade,
  constraint request_replies_parent_exclusive
    check ((partnership_request_id is not null) <> (contact_message_id is not null)),
  sender_profile_id uuid references public.profiles(id),
  -- Copie du destinataire RÉEL au moment de l'envoi (destination verrouillée
  -- côté action depuis la base ; jamais transmise par le navigateur).
  recipient_email text not null check (length(btrim(recipient_email)) between 3 and 160),
  body text not null check (length(btrim(body)) between 2 and 10000),
  provider_message_id text,
  status text not null default 'sent' check (status in ('sent', 'failed')),
  error text
);

create index request_replies_partnership_idx on public.request_replies (partnership_request_id);
create index request_replies_contact_idx     on public.request_replies (contact_message_id);

alter table public.request_replies enable row level security;

-- Consultation de l'historique : staff (admin + éditeur), comme l'onglet Demandes.
create policy "request_replies_staff_select" on public.request_replies
  for select to authenticated
  using (public.has_role('admin') or public.has_role('editor'));

-- Envoi enregistré : ADMIN UNIQUEMENT (le refus RLS s'applique à un éditeur
-- même via requête directe) ; le destinataire/body sont écrits par le
-- serveur uniquement — aucune colonne n'est modifiable par le navigateur.
create policy "request_replies_admin_insert" on public.request_replies
  for insert to authenticated
  with check (public.has_role('admin'));

create policy "request_replies_admin_update" on public.request_replies
  for update to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

create policy "request_replies_admin_delete" on public.request_replies
  for delete to authenticated
  using (public.has_role('admin'));

-- Journal: toute écriture de réponse reste dans audit_logs comme le reste
-- des demandes (fonction 0002 audit_row_change, gère tg_op='DELETE').
create trigger request_replies_audit
  after insert or update or delete on public.request_replies
  for each row execute function public.audit_row_change('request_replies');