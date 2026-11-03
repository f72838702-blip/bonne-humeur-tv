-- ─────────────────────────────────────────────────────────────
-- 0024 — NIVEAUX ÉDITORIAUX DES FLASH-INFOS (breaking_news.level)
-- Réf. refonte durée/flash-infos (03/11/2026).
--
-- Utilité : le formulaire demande un niveau « normal / important /
-- urgent » (couleur du bandeau public). La table n'a AUCUNE colonne
-- de niveau aujourd'hui → colonne additive.
--
-- Propriétés :
--  • ADDITIVE : aucune donnée existante modifiée (défaut 'normal') ;
--  • pas de doublon : start_at/end_at (0001) réutilisés, rien de créer ;
--  • policies RLS intactes (aucun grant/policy touché) ;
--  • compatibles anciens flash-infos : défaut 'normal' (comportement
--    historique conservé).
-- À APPLIQUER UNIQUEMENT sur autorisation explicite de la direction
-- (db push --dry-run doit n'afficher QUE cette migration).
-- ─────────────────────────────────────────────────────────────

alter table public.breaking_news
  add column level text not null default 'normal'
    check (level in ('normal', 'important', 'urgent'));

comment on column public.breaking_news.level is
  'Niveau éditorial du flash : normal / important / urgent (ton du bandeau public)';