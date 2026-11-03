-- 0023_featured_image_alt.sql
-- ALT de l'image de couverture des articles (accessibilité + SEO).
--
-- Nécessité démontrée (mission « upload image + YouTube ») : le champ
-- featured_image (URL) existe, mais AUCUN champ ne peut porter le texte
-- alternatif ; l'exigence explicite « champ ALT pour l'accessibilité et
-- le SEO » impose une colonne. Aucune autre table ni policy n'est touchée
-- : les policies RLS existantes (lignes) continuent de s'appliquer aux
-- nouvelles colonnes sans modification.
--
-- NB : texte alternatif = description HUMAINE de l'image, jamais de HTML,
-- jamais d'URL (max 300 caractères, validé aussi côté application).

alter table public.articles add column featured_image_alt text;

comment on column public.articles.featured_image_alt is
  'Texte alternatif (ALT) de featured_image — accessibilité et SEO. Texte simple, sans HTML ni URL.';