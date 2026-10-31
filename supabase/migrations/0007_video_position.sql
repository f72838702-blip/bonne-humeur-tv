-- ═══════════════════════════════════════════════════════════════════════════
-- BONNE HUMEUR TV — Migration 0007 : position d'affichage des vidéos
--
-- Directive bande passante §1 : le CMS enregistre la « position sur la page
-- d'accueil ». Position = 0 (défaut) → ordre chronologique automatique ;
-- position 1, 2, 3… → vidéo épinglée en tête de l'accueil (ordre croissant,
-- puis date de publication décroissante).
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.videos
  add column if not exists position integer not null default 0
    check (position between 0 and 999);

create index if not exists videos_home_order_idx
  on public.videos (position asc, published_at desc)
  where status = 'published';