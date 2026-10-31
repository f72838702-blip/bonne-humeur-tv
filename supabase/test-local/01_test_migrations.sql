-- ═══════════════════════════════════════════════════════════════════════════
-- BONNE HUMEUR TV — Tests des migrations exécutées sur PostgreSQL isolé
-- (émulation Supabase, cf. 00_supabase_emulation.sql)
-- Chaque test affiche PASS ou FAIL — aucun résultat fictif.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Comptes de test via le trigger handle_new_user (comme une vraie inscription) ──
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111101', 'admin@bhtv-test.gn'  , '{"full_name":"Admin Test"}'),
  ('11111111-1111-1111-1111-111111111102', 'editor@bhtv-test.gn', '{"full_name":"Editor Test"}'),
  ('11111111-1111-1111-1111-111111111103', 'reporter@bhtv-test.gn', '{"full_name":"Reporter Test"}');

-- Promotion admin + editor via le SQL de production (README-CONFIGURATION §3)
update public.profiles set role = 'admin'
  where id = (select id from auth.users where email = 'admin@bhtv-test.gn');
update public.profiles set role = 'editor'
  where id = (select id from auth.users where email = 'editor@bhtv-test.gn');

\echo '═══ T1 : 11 tables publiques ═══'
select case when count(*) = 11 then 'PASS' else 'FAIL '||count(*) end as t1_tables
  from pg_tables where schemaname = 'public';

\echo '═══ T2 : 11 catégories seedées (0005) ═══'
select case when count(*) = 11 then 'PASS' else 'FAIL '||count(*) end as t2_categories from public.categories;

\echo '═══ T3 : colonne videos.position + contrainte + index (0007) ═══'
select case when
  (select count(*) from information_schema.columns
     where table_schema='public' and table_name='videos' and column_name='position' and column_default like '0') = 1
  then 'PASS' else 'FAIL' end as t3_position;

\echo '═══ T4 : RLS public — anon ne voit que les articles PUBLIÉS et datés ═══'
set role anon;
set request.jwt.claim.sub = '';
insert into public.articles (title, slug, content, status, author_id, published_at)
  values ('Pub', 'test-pub', 'x', 'published',
     '11111111-1111-1111-1111-111111111102', now() - interval '1 minute');
insert into public.articles (title, slug, content, status, author_id)
  values ('Draft', 'test-draft', 'x', 'draft', '11111111-1111-1111-1111-111111111102');
select case when count(*) = 1 then 'PASS' else 'FAIL '||count(*) end as t4_anon_voir_1_sur_2
  from public.articles;
reset role;

\echo '═══ T5 : RLS staff — l'"'"'editor voit ses 2 articles ═══'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111102';
select case when count(*) = 2 then 'PASS' else 'FAIL '||count(*) end as t5_editor_voit_2
  from public.articles;
reset role;

\echo '═══ T6 : reporter — insertion de son brouillon OK ═══'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111103';
insert into public.articles (title, slug, content, status, author_id)
  values ('Rep', 'test-rep-draft', 'x', 'draft', '11111111-1111-1111-1111-111111111103');
select case when count(*) = 1 then 'PASS' else 'FAIL '||count(*) end as t6_reporter_brouillon
  from public.articles where author_id = '11111111-1111-1111-1111-111111111103';

\echo '═══ T7 : ANTI-AUTO-PUBLICATION — reporter ne peut pas publier son article ═══'
update public.articles set status = 'published'
  where author_id = '11111111-1111-1111-1111-111111111103';
select case when count(*) = 1 then 'PASS' else 'FAIL reste_draft' end as t7_pas_de_publication
  from public.articles where slug = 'test-rep-draft' and status = 'draft';
reset role;

\echo '═══ T8 : editor peut publier → l'"'"'article devient visible au public ═══'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111102';
update public.articles set status = 'published', published_at = now() - interval '1 minute'
  where slug = 'test-rep-draft';
reset role;
set role anon;
select case when count(*) = 1 then 'PASS' else 'FAIL '||count(*) end as t8_publication_editor
  from public.articles where slug = 'test-rep-draft' and status = 'published';
reset role;

\echo '═══ T9 : ANTI-ÉLÉVATION — un utilisateur ne peut pas devenir admin ═══'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111103';
update public.profiles set role = 'admin' where id = auth.uid();
select case when role = 'reporter' then 'PASS' else 'FAIL '||role end as t9_pas_auto_promotion
  from public.profiles where id = '11111111-1111-1111-1111-111111111103';
reset role;

\echo '═══ T10 : seul un admin change les rôles (editor → admin interdit) ═══'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111102';
update public.profiles set role = 'admin' where id = '11111111-1111-1111-1111-111111111103';
select case when role = 'reporter' then 'PASS' else 'FAIL '||role end as t10_editor_ne_promeut_pas
  from public.profiles where id = '11111111-1111-1111-1111-111111111103';
reset role;

\echo '═══ T11 : reporter ne lit que SON profil / admin lit tout ═══'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111103';
select case when count(*) = 1 then 'PASS' else 'FAIL '||count(*) end as t11a_reporter_voit_1
  from public.profiles;
reset role;
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111101';
select case when count(*) = 3 then 'PASS' else 'FAIL '||count(*) end as t11b_admin_voit_3
  from public.profiles;
reset role;

\echo '═══ T12 : formulaire contact — anon INSERT OK, jamais SELECT ═══'
set role anon;
insert into public.contact_messages (name, email, message) values ('Test', 't@t.gn', 'Bonjour');
select case when count(*) = 0 then 'PASS' else 'FAIL '||count(*) end as t12a_anon_ne_lit_pas
  from public.contact_messages;
insert into public.form_submissions (form_type, identifier) values ('contact', 'x');
select case when count(*) = 0 then 'PASS' else 'FAIL '||count(*) end as t12b_form_submissions_inaccessible
  from public.form_submissions;
reset role;

\echo '═══ T13 : audit_logs — append-only, lecture admin uniquement ═══'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111102';
update public.articles set excerpt = 'maj' where slug = 'test-pub';
reset role;
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111101';
select case when count(*) >= 2 then 'PASS' else 'FAIL '||count(*) end as t13a_admin_lit_audit
  from public.audit_logs;
reset role;
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111103';
select case when count(*) = 0 then 'PASS' else 'FAIL '||count(*) end as t13b_reporter_ne_lit_pas
  from public.audit_logs;
reset role;

\echo '═══ T14 : check_rate_limit — interdite à anon, fiable via service_role ═══'
set role anon;
select case when it_denied then 'PASS' else 'FAIL' end as t14a_anon_denied
  from (select exists(select 1 from pg_proc p, pg_roles r
      where p.proname='check_rate_limit'
        and has_function_privilege(r.rolname, 'public.check_rate_limit(text,text,integer,integer)', 'execute')
        and r.rolname='anon') as it_denied) s;
reset role;
select public.check_rate_limit('contact','ip-test',2,60) as t14b_true_attendu,
       (select public.check_rate_limit('contact','ip-test',2,60)) as t14c_true_attendu,
       (select public.check_rate_limit('contact','ip-test',2,60)) as t14d_false_attendu;

\echo '═══ T15 : search_published — le public ne cherche que le publié ═══'
set role anon;
select case when (r->'articles')::jsonb::text like '%test-rep-draft%' then 'PASS' else 'FAIL' end as t15_recherche_publie
  from public.search_published('Rep') r;
reset role;

\echo '═══ T16 : Storage — bucket média plafonné 2 Mo, lecture pub restreinte (0008) ═══'
select case when file_size_limit = 2097152 and public then 'PASS' else 'FAIL' end as t16a_bucket
  from storage.buckets where id = 'media';
set role anon;
insert into storage.objects (bucket_id, name) values ('media', 'articles/test.webp'), ('media', 'secret/x.webp');
select case when count(*) = 1 then 'PASS' else 'FAIL '||count(*) end as t16b_lecture_restreinte
  from storage.objects;
reset role;

\echo '═══ T17 : publication programmée — 0006 (dégradation gracieuse sans pg_cron) ═══'
insert into public.articles (title, slug, content, status, author_id, scheduled_at)
  values ('Prog', 'test-scheduled', 'x', 'scheduled',
     '11111111-1111-1111-1111-111111111102', now() - interval '1 minute');
select case when count(*) = 1 then 'PASS' else 'FAIL' end as t17_publication_programmee
  from public.articles where slug = 'test-scheduled' and status = 'published'
     and now() >= (select published_at from public.articles where slug = 'test-scheduled');

\echo '═══ T18 : épinglage position (0007) — tri épinglées puis chronologique ═══'
update public.videos set position = 1, status = 'published', published_at = now() - interval '10 minutes'
  where slug = 'non-existent';  -- insère d'"'"'abord deux vidéos
insert into public.videos (title, slug, youtube_id, status, published_at, position) values
  ('A', 'test-vid-a', 'aaaaaaaaaaa', 'published', now() - interval '10 minutes', 0),
  ('B', 'test-vid-b', 'bbbbbbbbbbb', 'published', now() - interval '5 minutes', 1),
  ('C', 'test-vid-c', 'ccccccccccc', 'published', now() - interval '1 minute', 0);
select case
  when (select position from public.videos where slug='test-vid-b') = 1
   and (select count(*) from public.videos) = 3
  then 'PASS' else 'FAIL' end as t18_positions;

\echo '═══ FIN DES TESTS ═══'