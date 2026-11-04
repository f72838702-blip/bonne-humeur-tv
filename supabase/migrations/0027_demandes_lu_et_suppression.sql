-- 0027 — ONGLET « DEMANDES » : suivi de lecture global + suppression admin
--
-- 1) suivi de lecture GLOBAL (cohérent avec le modèle de statuts existant,
--    unique et partagé — pas de table per-admin, pas de doublon de feature) :
--    • partnership_requests.seen_at : une demande "vue" par le staff cesse
--      d'être notifiée (badge « Nouveau ») — les statuts de traitement
--      (new/processing/treated) restent inchangés.
--    • contact_messages.read_at : un message "lu" cesse d'être compté non lu.
--    NULL = jamais vu/lu. Rempli UNIQUEMENT par le staff (page Demandes) —
--    jamais par une consultation publique (RLS : anon ne peut que INSERT).
-- 2) SUPPRESSION : DELETE réservé à l'admin (has_role('admin')) — l'éditeur
--    conserve SELECT/UPDATE mais ne supprime jamais. Suppression DEFINITIVE
--    voulue : purge les données personnelles (email/téléphone) conformément
--    au besoin de nettoyage des anciennes demandes ; le journal audit_logs
--    conserve l'empreinte de l'opération (3).
-- 3) AUDIT : les triggers de ces 2 tables loguent déjà insert/update —
--    étendus à DELETE (la fonction audit_row_change gère déjà tg_op='DELETE').

alter table public.partnership_requests add column seen_at timestamptz;
alter table public.contact_messages    add column read_at timestamptz;

create policy "partnership_requests_staff_delete" on public.partnership_requests
  for delete to authenticated
  using (public.has_role('admin'));

create policy "contact_messages_staff_delete" on public.contact_messages
  for delete to authenticated
  using (public.has_role('admin'));

drop trigger partnership_requests_audit on public.partnership_requests;
create trigger partnership_requests_audit
  after insert or update or delete on public.partnership_requests
  for each row execute function public.audit_row_change('partnership_requests');

drop trigger contact_messages_audit on public.contact_messages;
create trigger contact_messages_audit
  after insert or update or delete on public.contact_messages
  for each row execute function public.audit_row_change('contact_messages');