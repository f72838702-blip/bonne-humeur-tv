-- ═══════════════════════════════════════════════════════════════════════════
-- BONNE HUMEUR TV — Migration 0004 : Médiathèque (Supabase Storage)
-- À appliquer APRÈS 0001-0003
--
-- Bucket « media » : lecture publique (images de couverture, miniatures),
-- écriture UNIQUEMENT côté serveur (Server Action + client service_role,
-- cf. lib/actions/media.ts qui valide type MIME et taille).
-- Aucun policy d'upload pour anon/authenticated : pas d'envoi arbitraire.
-- ═══════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  true,
  5242880, -- 5 Mo max
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- Lecture publique des objets du bucket media (nécessaire pour l'API de listing
-- et les URL signées/public ; les fichiers servis via /storage/v1 sont publics).
create policy "media_public_read" on storage.objects
  for select using (bucket_id = 'media');