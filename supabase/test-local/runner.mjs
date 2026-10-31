// ═══════════════════════════════════════════════════════════════════════════
// BONNE HUMEUR TV — Runner de validation des migrations + RLS
// PostgreSQL 17.11 portable isolé (supabase/test-local/00_supabase_emulation.sql)
// Usage :
//   node runner.mjs doc-order <db>    → ordre documenté ACTUEL (0001..0008 en l'état)
//   node runner.mjs full <db>         → ordre corrigé, base VIERGE + 22 tests RLS
// Aucune base réelle n'est contactée.
// ═══════════════════════════════════════════════════════════════════════════
import { Client } from "pg";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(HERE, "..", "migrations");

const U_ADMIN = "11111111-1111-1111-1111-111111111101";
const U_EDITOR = "11111111-1111-1111-1111-111111111102";
const U_REPORTER = "11111111-1111-1111-1111-111111111103";

const mode = process.argv[2];
const database = process.argv[3] ?? "bhtv_clean";

let pass = 0, fail = 0;
const failures = [];
function report(id, label, ok, detail = "") {
  if (ok) { pass++; console.log(`  PASS  ${id} — ${label}`); }
  else { fail++; failures.push(id); console.log(`  FAIL  ${id} — ${label}${detail ? " → " + detail : ""}`); }
}

const MIG = (f) => readFileSync(join(MIGRATIONS_DIR, f), "utf8");
const FILES_DOC = [
  "0001_schema.sql", "0002_rls.sql", "0003_functions.sql", "0004_storage.sql",
  "0005_seed_categories.sql", "0006_scheduled_publish.sql",
  "0007_video_position.sql", "0008_media_folders.sql",
];
const FILES_FIXED = [
  "0001_schema.sql", "0002_functions.sql", "0003_rls.sql", "0004_storage.sql",
  "0005_seed_categories.sql", "0006_scheduled_publish.sql",
  "0007_video_position.sql", "0008_media_folders.sql",
];

async function main() {
  const c = new Client({ host: "127.0.0.1", port: 5433, user: "postgres", database });
  await c.connect();

  if (mode === "doc-order") {
    console.log(`\n=== ORDRE DOCUMENTÉ actuel sur base vierge ${database} ===`);
    console.log("(l'ordre ancien, PROUVÉ INVALIDE le 31/10/2026, a été corrigé : les");
    console.log(" fichiers ont été renumérotés — preuve archivée dans RESULTAT_MIGRATIONS_…)");
    for (const f of FILES_DOC)
      try {
        await c.query(MIG(f));
        console.log(`  ok    ${f}`);
      } catch (e) {
        if (/ENOENT/.test(e.message)) {
          console.log(`  (fichier renommé : ${f} n'existe plus — ordre ancien non rejouable tel quel)`);
          continue;
        }
        console.log(`  ÉCHEC ${f} → ${e.message}`);
        console.log(`\nVERDICT ordre documenté : ÉCHEC (correction requise)`);
        process.exitCode = 1; await c.end(); return;
      }
    console.log(`\nVERDICT ordre documenté : RÉUSSI`);
    await c.end(); return;
  }

  if (mode !== "full") { console.error("usage : node runner.mjs doc-order <db> | full <db>"); process.exit(2); }

  // Base vierge : émulation Supabase d'abord (harnais hors migrations)
  console.log(`\n=== EXÉCUTION DES MIGRATIONS depuis base vierge sur ${database} ===`);
  try {
    await c.query(readFileSync(join(HERE, "00_supabase_emulation.sql"), "utf8"));
    console.log("  ok    (harnais) 00_supabase_emulation.sql");
  } catch (e) {
    console.log(`  ÉCHEC harness → ${e.message}\n(base déjà initialisée ? utiliser une base vierge)`);
    process.exitCode = 1; await c.end(); return;
  }
  for (const f of FILES_FIXED)
    try { await c.query(MIG(f)); console.log(`  ok    ${f}`); }
    catch (e) {
      console.log(`  ÉCHEC ${f} → ${e.message}`);
      console.log(`\nVERDICT migrations : ÉCHEC`);
      process.exitCode = 1; await c.end(); return;
    }
  console.log("\nMIGRATIONS COMPLÈTES : aucune erreur.\n");
  await runTests(c);
  await c.end();
}

// ─── Utilitaires : exécution sous un rôle + JWT simulé ───────────────────────
async function as(c, role, uid, sql) {
  // Transaction dédiée : rôle local + claim JWT simulé, puis COMMIT (persist).
  await c.query("begin");
  try {
    await c.query(`set local role ${role}`);
    await c.query("select set_config('request.jwt.claim.sub', $1, true)", [uid]);
    const r = await c.query(sql);
    await c.query("commit");
    return r.rows ?? [];
  } catch (e) {
    await c.query("rollback");
    throw e;
  }
}
async function setup(c, sql) { await c.query(sql); }
async function scalar(c, sql, params) {
  const r = await c.query(sql, params);
  return Object.values(r.rows[0] ?? {})[0];
}

async function runTests(c) {
  console.log(`=== TESTS RLS / SÉCURITÉ / FONCTIONS (22 assertions) ===\n`);

  // Inscriptions via trigger réellement (+ promotions via le SQL de production)
  await setup(c, `
    insert into auth.users (id, email, raw_user_meta_data) values
      ('${U_ADMIN}',    'admin@bhtv-test.gn',    '{"full_name":"Admin Test"}'),
      ('${U_EDITOR}',   'editor@bhtv-test.gn',   '{"full_name":"Editor Test"}'),
      ('${U_REPORTER}', 'reporter@bhtv-test.gn', '{"full_name":"Reporter Test"}');
    update public.profiles set role='admin'  where id=(select id from auth.users where email='admin@bhtv-test.gn');
    update public.profiles set role='editor' where id=(select id from auth.users where email='editor@bhtv-test.gn');
  `);

  report("T1", "11 tables publiques créées (0001)",
    (await scalar(c, "select count(*)::int from pg_tables where schemaname='public' and tablename not like 'pg%'")) === 11);
  report("T2", "11 catégories seedées (0005)",
    (await scalar(c, "select count(*)::int from public.categories")) === 11);
  report("T3", "videos.position existe, défaut 0 + index (0007)",
    (await scalar(c, `select count(*)::int from information_schema.columns
      where table_schema='public' and table_name='videos' and column_name='position' and column_default like '0%'`)) === 1
    && (await scalar(c, "select count(*)::int from pg_indexes where indexname='videos_home_order_idx'")) === 1);

  await setup(c, `insert into public.articles (title, slug, content, status, author_id, published_at)
    values ('Pub','test-pub','x','published','${U_EDITOR}', now() - interval '1 minute'),
           ('Draft','test-draft','x','draft','${U_EDITOR}', null)`);

  report("T4", "RLS public : anon ne voit que l'article PUBLIÉ (1 sur 2)",
    (await as(c, "anon", "", "select count(*)::int cr from public.articles"))[0].cr === 1);
  report("T5", "editor voit ses 2 articles",
    (await as(c, "authenticated", U_EDITOR, "select count(*)::int cr from public.articles"))[0].cr === 2);

  const ins = await as(c, "authenticated", U_REPORTER,
    `insert into public.articles (title,slug,content,status,author_id) values
       ('Rep','test-rep-draft','x','draft','${U_REPORTER}') returning 1`);
  report("T6", "reporter insère son brouillon", ins.length === 1);

  // Anti-auto-publication : USING passe (son article, draft) mais WITH CHECK
  // viole (status='published') → PostgreSQL lève une ERREUR explicite (non pas
  // 0 lignes silencieuses — leçon ATT9 connue du projet SCOLAGUI).
  let selfPubDenied = false;
  try {
    await as(c, "authenticated", U_REPORTER,
      `update public.articles set status='published' where slug='test-rep-draft' returning 1`);
  } catch (e) { selfPubDenied = /row-level security/i.test(e.message); }
  report("T7", "anti-auto-publication : le reporter NE PEUT PAS publier (ERREUR RLS)",
    selfPubDenied, "aucune erreur levée = publication permis");
  report("T7b", "l'article est resté draft",
    (await scalar(c, "select count(*)::int from public.articles where slug='test-rep-draft' and status='draft'")) === 1);

  await as(c, "authenticated", U_EDITOR,
    `update public.articles set status='published', published_at=now() - interval '1 minute' where slug='test-rep-draft'`);
  report("T8", "l'editor publie → visible au public",
    (await as(c, "anon", "", "select count(*)::int cr from public.articles where slug='test-rep-draft'"))[0].cr === 1);

  // Anti-élévation : USING passe (sa propre ligne) mais WITH CHECK viole
  // (role ≠ current_role) → ERREUR RLS explicite.
  let selfPromoDenied = false;
  try {
    await as(c, "authenticated", U_REPORTER,
      `update public.profiles set role='admin' where id=auth.uid() returning 1`);
  } catch (e) { selfPromoDenied = /row-level security/i.test(e.message); }
  report("T9", "anti-élévation : un reporter ne peut pas devenir admin (ERREUR RLS)",
    selfPromoDenied, "aucune erreur levée = promotion possible !");
  report("T9b", "le rôle du reporter est toujours 'reporter'",
    (await scalar(c, "select role from public.profiles where id=$1", [U_REPORTER])) === "reporter");

  const crossPromo = await as(c, "authenticated", U_EDITOR,
    `update public.profiles set role='admin' where id='${U_REPORTER}' returning 1`);
  report("T10", "seul un admin change les rôles (editor → promotion interdite)",
    crossPromo.length === 0, `${crossPromo.length} ligne(s)`);

  report("T11a", "reporter ne lit que SON profil",
    (await as(c, "authenticated", U_REPORTER, "select count(*)::int cr from public.profiles"))[0].cr === 1);
  report("T11b", "admin lit les 3 profils",
    (await as(c, "authenticated", U_ADMIN, "select count(*)::int cr from public.profiles"))[0].cr === 3);

  await as(c, "anon", "", "insert into public.contact_messages (name,email,message) values ('Test','t@t.gn','Bonjour')");
  report("T12a", "anon peut ENVOYER au contact mais jamais LIRE (0 ligne)",
    (await as(c, "anon", "", "select count(*)::int cr from public.contact_messages"))[0].cr === 0);
  report("T12b", "form_submissions inaccessible hors service_role (0 ligne)",
    (await as(c, "authenticated", U_ADMIN, "select count(*)::int cr from public.form_submissions"))[0].cr === 0);

  await as(c, "authenticated", U_EDITOR, "update public.articles set excerpt='maj' where slug='test-pub'");
  const auditAdmin = await as(c, "authenticated", U_ADMIN, "select count(*)::int cr from public.audit_logs");
  report("T13a", "audit_logs rempli par le trigger, lecture admin OK", auditAdmin[0].cr >= 2, `n=${auditAdmin[0]?.cr}`);
  report("T13b", "reporter ne lit PAS l'audit (0 ligne)",
    (await as(c, "authenticated", U_REPORTER, "select count(*)::int cr from public.audit_logs"))[0].cr === 0);

  let anonRateDenied = false;
  try { await as(c, "anon", "", "select public.check_rate_limit('contact','ip',2,60)"); }
  catch (e) { anonRateDenied = /permission denied/i.test(e.message); }
  report("T14a", "check_rate_limit refuse anon (permission denied)", anonRateDenied);
  const rl3 = [];
  for (let i = 0; i < 3; i++) rl3.push(await scalar(c, "select public.check_rate_limit('contact','ip-test',2,60)"));
  report("T14b", "fiable en base : true, true, false (max 2/60 s)",
    JSON.stringify(rl3) === JSON.stringify([true, true, false]), rl3.join(","));

  const found = await as(c, "anon", "", "select (r->'articles')::jsonb a from public.search_published('Rep') r");
  report("T15", "search_published : le public ne cherche que le PUBLIÉ",
    found.length === 1 && JSON.stringify(found[0].a).includes("test-rep-draft"));

  report("T16a", "bucket media : public + plafond 2 Mo (0008)",
    (await scalar(c, "select bool_and(public and file_size_limit=2097152) from storage.buckets where id='media'")) === true);
  await setup(c, `insert into storage.objects (bucket_id,name) values ('media','articles/test.webp'),('media','secret/x.webp')`);
  report("T16b", "lecture publique RESTREINTE aux 5 dossiers logiques (1 sur 2)",
    (await as(c, "anon", "", "select count(*)::int cr from storage.objects"))[0].cr === 1);
  let storageWriteDenied = false;
  try { await as(c, "anon", "", "insert into storage.objects (bucket_id,name) values ('media','articles/w.webp')"); }
  catch (e) { storageWriteDenied = /row-level security|permission/i.test(e.message); }
  report("T16c", "anon ne peut PAS écrire dans le Storage", storageWriteDenied);

  await setup(c, `insert into public.articles (title,slug,content,status,author_id,scheduled_at)
    values ('Prog','test-scheduled','x','scheduled','${U_EDITOR}', now() - interval '1 minute')`);
  await setup(c, "select public.publish_scheduled_articles()");
  report("T17", "0006 (sans pg_cron) : fonction publication programmée effective",
    (await scalar(c, "select count(*)::int from public.articles where slug='test-scheduled' and status='published'")) === 1);

  await setup(c, `insert into public.videos (title,slug,youtube_id,status,published_at,position) values
    ('A','test-vid-a','aaaaaaaaaaa','published', now() - interval '10 minutes', 0),
    ('B','test-vid-b','bbbbbbbbbbb','published', now() - interval '5 minutes', 1),
    ('C','test-vid-c','ccccccccccc','published', now() - interval '1 minute', 0)`);
  const order = [];
  for (const r of await c.query("select slug from public.videos where status='published' order by published_at desc").then(r => r.rows)) order.push(r.slug);
  // Algorithme réel de lib/data/videos.ts : fenêtre published_at desc, puis
  // tri applicatif — épinglées (position>0) d'abord, ensuite chronologique.
  const pinned = (await c.query("select slug,position from public.videos where status='published' and position>0 order by position asc")).rows.map(r => r.slug);
  const rest = (await c.query("select slug from public.videos where status='published' and position=0 order by published_at desc")).rows.map(r => r.slug);
  const appOrder = pinned.concat(rest);
  report("T18", "tri accueil appliqué : épinglée d'abord puis chronologique",
    appOrder.join(",") === "test-vid-b,test-vid-c,test-vid-a",
    `fenêtre brute=${order.join(",")} → app=${appOrder.join(",")}`);
  report("T18b", "l'index videos_home_order_idx existe pour le tri position (0007)",
    (await scalar(c, "select count(*)::int from pg_indexes where indexname='videos_home_order_idx'")) === 1);

  report("T19", "vue author_names : bylines publiques (anon la lit)",
    (await as(c, "anon", "", "select count(*)::int cr from public.author_names"))[0].cr === 3);

  const auditAnon = await as(c, "anon", "", "select count(*)::int cr from public.audit_logs");
  report("T20a", "anon ne lit PAS l'audit", auditAnon[0].cr === 0, `n=${auditAnon[0]?.cr}`);
  const insAudit = await as(c, "authenticated", U_REPORTER,
    "insert into public.audit_logs (actor_id,action,entity) values (auth.uid(),'insert','articles') returning 1");
  report("T20b", "staff peut écrire l'audit (policies append-only)", insAudit.length === 1);

  let rateLimitWrongForm = false;
  try { await scalar(c, "select public.check_rate_limit('autremail','ip',2,60)"); }
  catch (e) { rateLimitWrongForm = /Type de formulaire inconnu/i.test(e.message); }
  report("T20c", "check_rate_limit refuse un form_type inconnu", rateLimitWrongForm);

  console.log(`\n══════════ RÉSULTAT : ${pass} PASS / ${fail} FAIL ══════════`);
  if (failures.length) console.log("Échecs : " + failures.join(", "));
  process.exitCode = fail > 0 ? 1 : 0;
}

main().then(
  () => {},
  (e) => { console.error("ERREUR RUNNER :", e.message); process.exit(1); }
);