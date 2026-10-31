-- ═══════════════════════════════════════════════════════════════════════════
-- BONNE HUMEUR TV — Migration 0005 : Rubriques éditoriales initiales
--
-- Ce sont des structures (catégories), PAS du contenu : aucun article ni
-- vidéo fictif n'est créé ici. Les catégories restent administrables
-- depuis /admin (à condition que la migration 0002 soit appliquée).
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.categories (name, slug, description) values
  ('Politique',       'politique',       'Actualité politique et vie des institutions en Guinée'),
  ('Société',         'societe',         'Vie quotidienne, initiatives citoyennes et faits de société'),
  ('Économie',        'economie',        'Entreprises, financement, marchés et entrepreneuriat'),
  ('Culture',         'culture',         'Musique, arts, patrimoine et festivals'),
  ('Éducation',       'education',       'Écoles, universités, examens et formation'),
  ('Sport',           'sport',           'Football, compétitions et sport guinéen'),
  ('Santé',           'sante',           'Santé publique, hôpitaux et prévention'),
  ('Religion',        'religion',        'Vie religieuse et temps forts spirituels'),
  ('Institutions',    'institutions',    'Présidence, gouvernement, ministères et services publics'),
  ('Environnement',   'environnement',   'Climat, nature et cadre de vie'),
  ('International',   'international',   'L''actualité du monde vue de la Guinée')
on conflict (slug) do nothing;