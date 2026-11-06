-- ═══════════════════════════════════════════════════════════════════════════
-- BONNE HUMEUR TV — Migration 0033 : Mémoire conversationnelle de
-- l'assistant IA de l'administration (direction §M — missions 2026-11-06)
--
-- PRÉPARÉE LOCALEMENT — NE PAS APPLIQUER SUR LA BASE DISTANTE SANS
-- AUTORISATION EXPLICITE DE LA DIRECTION.
--
-- Trois tables, TOUTES PRIVÉES (aucun accès anon, jamais exposées au
-- chatbot public — aucune fonction SECURITY DEFINER ici ne lit ces tables) :
--
--   ai_conversations : une conversation par ligne, propriétaire = profils
--                       connecté (identité vérifiée CÔTÉ SERVEUR par
--                       requireRole + RLS `owner_user_id = auth.uid()` —
--                       jamais un user_id transmis par le navigateur).
--   ai_messages      : messages de la conversation (cascade au delete).
--   ai_memories      : mémoire contextuelle DURABLE par administrateur
--                       (décisions, préférences, travaux en cours) —
--                       résumée régulièrement par le modèle (qwen), bornée.
--
-- La suppression d'une conversation supprime EFFECTIVEMENT ses messages
-- (ON DELETE CASCADE — aucune corbeille) ; la mémoire reste (les décisions
-- demeurent valables après suppression d'une conversation).
-- Durcissement grants (leçon 0031) : anon = RIEN ; authenticated = CRUD
-- rows (TRUNCATE/REFERENCES/TRIGGER/EXECUTE jamais accordés).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Conversations ──────────────────────────────────────────────────────────
create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Nouvelle conversation'
    check (length(btrim(title)) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ai_conversations_owner_idx
  on public.ai_conversations (owner_user_id, updated_at desc);

alter table public.ai_conversations enable row level security;

-- Visibilité et écriture : LE PROPRIÉTAIRE UNIQUEMENT (RLS stricte —
-- un autre admin/éditeur ne voit QUE les siennes ; l'identité vient du
-- JWT, jamais d'un argument client).
create policy ai_conversations_owner_select
  on public.ai_conversations for select to authenticated
  using (owner_user_id = auth.uid());

create policy ai_conversations_owner_insert
  on public.ai_conversations for insert to authenticated
  with check (owner_user_id = auth.uid());

create policy ai_conversations_owner_update
  on public.ai_conversations for update to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy ai_conversations_owner_delete
  on public.ai_conversations for delete to authenticated
  using (owner_user_id = auth.uid());

grant select, insert, update, delete on public.ai_conversations to authenticated;

-- Durcissement (0031) : les rôles de base reçoivent ALL par défaut —
-- TRUNCATE n'est PAS couvert par RLS ; anon ne doit RIEN avoir.
revoke all on public.ai_conversations from anon;
revoke truncate, references, trigger on public.ai_conversations from authenticated;

drop trigger if exists ai_conversations_touch on public.ai_conversations;
create trigger ai_conversations_touch
  before update on public.ai_conversations
  for each row execute function public.touch_updated_at();

-- Journal : audit_row_change ne consigne QUE (actor, action, entité, id) —
-- jamais de contenu (pas de duplication de données privées).
drop trigger if exists ai_conversations_audit on public.ai_conversations;
create trigger ai_conversations_audit
  after insert or update or delete on public.ai_conversations
  for each row execute function public.audit_row_change('ai_conversations');

-- ─── Messages (historique complet, restauré à l'identique) ─────────────────
create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null
    references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (length(btrim(content)) between 1 and 20000),
  created_at timestamptz not null default now()
);

create index ai_messages_conversation_idx
  on public.ai_messages (conversation_id, created_at);

alter table public.ai_messages enable row level security;

-- Accès : uniquement via UNE conversation dont on est le propriétaire
-- (sous-requête corrélée — le propriétaire du message est celui de la
-- conversation, jamais transmis par le navigateur).
create policy ai_messages_owner_select
  on public.ai_messages for select to authenticated
  using (
    exists (
      select 1 from public.ai_conversations c
      where c.id = conversation_id and c.owner_user_id = auth.uid()
    )
  );

create policy ai_messages_owner_insert
  on public.ai_messages for insert to authenticated
  with check (
    exists (
      select 1 from public.ai_conversations c
      where c.id = conversation_id and c.owner_user_id = auth.uid()
    )
  );

-- AUCUN update : l'historique est immuable (intégrité des souvenirs —
-- pas de réécriture possible, même par un rôle plus élevé).

create policy ai_messages_owner_delete
  on public.ai_messages for delete to authenticated
  using (
    exists (
      select 1 from public.ai_conversations c
      where c.id = conversation_id and c.owner_user_id = auth.uid()
    )
  );

grant select, insert, delete on public.ai_messages to authenticated;

revoke all on public.ai_messages from anon;
revoke update, truncate, references, trigger on public.ai_messages from authenticated;

drop trigger if exists ai_messages_audit on public.ai_messages;
create trigger ai_messages_audit
  after insert or delete on public.ai_messages
  for each row execute function public.audit_row_change('ai_messages');

-- ─── Mémoire contextuelle durable (UNE par administrateur) ─────────────────
create table public.ai_memories (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  -- Texte résumé borné (décisions, préférences, travaux en cours) —
  -- généré par le modèle à partir des SEULS échanges réels, jamais inventé.
  content text not null default '' check (length(content) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_memories enable row level security;

create policy ai_memories_owner_select
  on public.ai_memories for select to authenticated
  using (user_id = auth.uid());

create policy ai_memories_owner_insert
  on public.ai_memories for insert to authenticated
  with check (user_id = auth.uid());

create policy ai_memories_owner_update
  on public.ai_memories for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy ai_memories_owner_delete
  on public.ai_memories for delete to authenticated
  using (user_id = auth.uid());

grant select, insert, update, delete on public.ai_memories to authenticated;

revoke all on public.ai_memories from anon;
revoke truncate, references, trigger on public.ai_memories from authenticated;

drop trigger if exists ai_memories_touch on public.ai_memories;
create trigger ai_memories_touch
  before update on public.ai_memories
  for each row execute function public.touch_updated_at();

drop trigger if exists ai_memories_audit on public.ai_memories;
create trigger ai_memories_audit
  after insert or update or delete on public.ai_memories
  for each row execute function public.audit_row_change('ai_memories');
