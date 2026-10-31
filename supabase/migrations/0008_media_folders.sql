-- ═══════════════════════════════════════════════════════════════════════════
-- BONNE HUMEUR TV — Migration 0008 : Dossiers logiques du Storage
-- (directive §2 : optimisation vidéo, images et bande passante)
-- À appliquer APRÈS 0001-0007
--
-- • Lecture publique restreinte aux 5 dossiers logiques autorisés :
--   articles/, categories/, thumbnails/, reporters/, branding/.
--   Tout objet hors de ces dossiers devient inaccessible publiquement,
--   même si un upload erroné l'avait placé ailleurs.
-- • Plafond de poids du bucket aligné sur les limites serveur
--   (2 Mo absolus ; les variantes compressées sont bien en dessous).
-- • Aucun policy d'écriture ajoutée : les uploads restent réservés au
--   serveur (client service_role via Server Action validée).
-- ═══════════════════════════════════════════════════════════════════════════

update storage.buckets
  set file_size_limit = 2097152 -- 2 Mo
  where id = 'media';

drop policy if exists "media_public_read" on storage.objects;

create policy "media_public_read" on storage.objects
  for select using (
    bucket_id = 'media'
    and (
      name like 'articles/%'
      or name like 'categories/%'
      or name like 'thumbnails/%'
      or name like 'reporters/%'
      or name like 'branding/%'
    )
  );