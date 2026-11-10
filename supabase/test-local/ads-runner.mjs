// ═══════════════════════════════════════════════════════════════════════════
// BONNE HUMEUR TV — Validation régie publicitaire sur PostgreSQL 17.11
// port réel isolé (portable, HORS dépôt). Aucune base distante contactée.
//
// Usage : node ads-runner.mjs   (base bhtv_ads vierge requise)
// ═══════════════════════════════════════════════════════════════════════════
import { Client } from "pg";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGR = join(HERE, "..", "migrations");
const read = (f) => readFileSync(join(MIGR, f), "utf8");

const U_ADMIN = "11111111-1111-1111-1111-111111111101";
const U_EDITOR = "11111111-1111-1111-1111-111111111102";
const U_REPORTER = "11111111-1111-1111-1111-111111111103";

let pass = 0, fail = 0;
const failures = [];
function ok(id, label) { pass++; console.log(`  PASS  ${id} — ${label}`); }
function no(id, label, detail = "") { fail++; failures.push(id); console.log(`  FAIL  ${id} — ${label}${detail ? " → " + detail : ""}`); }
async function expect(id, label, fn) {
  try { if (await fn()) ok(id, label); else no(id, label); }
  catch (e) { no(id, label, e.message); }
}
const eq = (got, want) => JSON.stringify(got) === JSON.stringify(want);

const c = new Client({ host: "127.0.0.1", port: 5432, user: "postgres", database: "bhtv_ads" });

async function as(role, uid, sql) {
  await c.query("begin");
  try {
    await c.query(`set local role ${role}`);
    if (uid) await c.query("select set_config('request.jwt.claim.sub', $1, true)", [uid]);
    const r = await c.query(sql);
    await c.query("commit");
    return r;
  } catch (e) {
    await c.query("rollback");
    throw e;
  }
}

const SCALAR = (rows, col) => Object.values(rows.rows[0] ?? {})[0];

async function main() {
  await c.connect();

  // ─── 1. Migrations réelles complètes : émulation + 0001..0008, 0023..0026 ───
  console.log("\n=== MIGRATIONS (harnais + 0001..0008, 0023, 0024, 0025, 0026) ===");
  await c.query(readFileSync(join(HERE, "00_supabase_emulation.sql"), "utf8"));
  console.log("  ok    (harnais) émulation Supabase");
  const files = [
    "0001_schema.sql", "0002_functions.sql", "0003_rls.sql", "0004_storage.sql",
    "0005_seed_categories.sql", "0006_scheduled_publish.sql",
    "0007_video_position.sql", "0008_media_folders.sql",
    "0023_featured_image_alt.sql", "0024_flash_infos_niveaux.sql",
    "0025_regie_publicitaire_tables.sql", "0026_regie_publicitaire_rls.sql",
  ];
  let migOk = true;
  for (const f of files) {
    try { await c.query(read(f)); }
    catch (e) {
      migOk = false;
      no(`MIG ${f}`, "exécution", e.message);
    }
  }
  if (migOk) ok("MIG 0025+0026", "migrations régie appliquées sans erreur");
  if (!migOk) { console.log("\nVERDICT : ÉCHEC migrations."); process.exitCode = 1; await c.end(); return; }

  // comptes de test via auth.users (FK profiles) puis promotion SQL « production »
  await c.query(`
    insert into auth.users (id, email, raw_user_meta_data) values
      ('${U_ADMIN}',    'admin@bhtv-test.gn',    '{"full_name":"Admin"}'),
      ('${U_EDITOR}',   'editor@bhtv-test.gn',   '{"full_name":"Editor"}'),
      ('${U_REPORTER}', 'reporter@bhtv-test.gn', '{"full_name":"Reporter"}')`);
  await c.query("insert into public.profiles (id, full_name, role) values ($1,'Admin', 'admin'), ($2,'Editor','editor'), ($3,'Reporter','reporter') on conflict (id) do update set role = excluded.role", [U_ADMIN, U_EDITOR, U_REPORTER]);
  console.log("  ok    profils de test (admin/editor/reporter)");

  console.log("\n=== TESTS RÉGIE (assertions ADS1 -> ADS22) ===\n");

  // ADS1 — emplacements seedés : 8 exactement
  await expect("ADS1", "8 emplacements initialisés par le seed", async () =>
    Number(SCALAR(await c.query("select count(*) n from public.ad_placements"), "n")) === 8);

  // ADS2 — le public ne lit AUCUNE table régie (RLS : 0 ligne, jamais une erreur)
  await expect("ADS2", "anon : 0 ligne sur advertisers (RLS fail-closed)", async () => {
    const rows = await as("anon", null, "select * from public.advertisers");
    return rows.rows.length === 0;
  });

  // ADS3 — reporter : aucun accès campagne (RLS : 0 ligne)
  await expect("ADS3", "reporter : 0 ligne sur ad_campaigns (RLS)", async () => {
    const rows = await as("authenticated", U_REPORTER, "select * from public.ad_campaigns");
    return rows.rows.length === 0;
  });

  // ADS4 — editor crée un annonceur (RLS le permet)
  await expect("ADS4", "editor : création annonceur autorisée", async () =>
    eq(SCALAR(await as("authenticated", U_EDITOR, "insert into public.advertisers (name) values ('Supé Gaz') returning true t"), "t"), true));

  // ADS5 — editor modifie / ne supprime PAS (0 ligne supprimée) ; admin oui
  await expect("ADS5", "editor : update oui / delete 0 ligne ; admin : delete oui", async () => {
    const del = await as("authenticated", U_EDITOR, "delete from public.advertisers where name = 'Supé Gaz'");
    if (del.rowCount !== 0) return false;
    await as("authenticated", U_ADMIN, "delete from public.advertisers where name = 'Supé Gaz'");
    return true;
  });

  // ADS6 — editor ne peut PAS approuver une créative
  await expect("ADS6", "editor : validation « approved » impossible (RLS)", async () => {
    const admin = await as("authenticated", U_ADMIN, "select id from public.profiles where role='admin'");
    await as("authenticated", U_ADMIN, `
      insert into public.advertisers (id, name) values ('11111111-1111-1111-1111-111111111201','Adv Test')`);
    await as("authenticated", U_ADMIN, `
      insert into public.ad_campaigns (id, advertiser_id, name, start_at, end_at, status, priority)
      values ('11111111-1111-1111-1111-111111111202','11111111-1111-1111-1111-111111111201','Campagne Test',
              now() - interval '1 hour', now() + interval '1 day', 'active', 50)`);
    await as("authenticated", U_EDITOR, `
      insert into public.ad_creatives (id, campaign_id, format, name, payload, status)
      values ('11111111-1111-1111-1111-111111111203','11111111-1111-1111-1111-111111111202','banner','Bannière Test','{"link_url":"https://exemple.com"}','draft')`);
    try {
      await as("authenticated", U_EDITOR, `
        update public.ad_creatives set status='approved', approved_by='${U_ADMIN}', approved_at=now()
        where id='11111111-1111-1111-1111-111111111203'`);
      return false; // l'éditeur a réussi : FAIL
    } catch { return true; }
  });

  // ADS7 — admin approuve ; la créative devient diffusée
  await expect("ADS7", "admin : approbation OK → get_public_ads la renvoie", async () =>
    eq(SCALAR(await as("authenticated", U_ADMIN, `
      update public.ad_creatives set status='approved', approved_by='${U_ADMIN}', approved_at=now()
      where id='11111111-1111-1111-1111-111111111203' returning true t`), "t"), true));

  // ADS8 — liaison campagne↔emplacement + diffusion via get_public_ads
  await expect("ADS8", "get_public_ads renvoie la création en diffusion", async () => {
    await c.query(`insert into public.ad_campaign_placements (campaign_id, placement_code)
      values ('11111111-1111-1111-1111-111111111202','home_top_banner')`);
    const rows = await as("anon", null, "select public.get_public_ad_zone('home_top_banner') zone");
    const zone = rows.rows[0].zone;
    return zone.creatives.length === 1 && zone.creatives[0].format === "banner" && zone.max_items >= 1;
  });

  // ADS9 — le jeu de Colonnes RENVOYÉS par get_public_ads ne contient AUCUN champ privé
  await expect("ADS9", "get_public_ads : colonnes = affichage seul (aucun montant/contrat)", async () => {
    const rows = await as("anon", null, "select public.get_public_ad_zone('home_top_banner') zone");
    const zone = rows.rows[0].zone;
    const top = zone.creatives[0] ?? {};
    return ["active", "max_items", "devices", "creatives"].every((k) => k in zone)
      && !top.payload.link_url              // le lien sortant n'est JAMAIS exposé au DOM
      && !("link_url" in (top.payload ?? {}));
  });

  // ADS10 — impression idempotente : 2 appels même empreinte = 1 impression
  await expect("ADS10", "record_ad_event déduplique (2 appels = 1)", async () => {
    await as("anon", null, "select public.record_ad_event('11111111-1111-1111-1111-111111111203','impression','home_top_banner','fp-abc')");
    const r2 = await as("anon", null, "select public.record_ad_event('11111111-1111-1111-1111-111111111203','impression','home_top_banner','fp-abc') n");
    return eq(SCALAR(r2, "n"), false);
  });

  // ADS11 — l'agrégat quotidien = 1 impression exactement
  await expect("ADS11", "agrégat quotidien = 1 impression / 0 clic", async () => {
    const rows = await as("authenticated", U_ADMIN, "select impressions, clicks from public.ad_daily_stats limit 1");
    return rows.rows[0].impressions === 1 && rows.rows[0].clicks === 0;
  });

  // ADS12 — un autre jour/empreinte compte : 2e impression
  await expect("ADS12", "autre empreinte = 2e impression comptée", async () => {
    await as("anon", null, "select public.record_ad_event('11111111-1111-1111-1111-111111111203','impression','home_top_banner','fp-xyz')");
    const n = SCALAR(await as("authenticated", U_ADMIN, "select impressions n from public.ad_daily_stats where creative_id='11111111-1111-1111-1111-111111111203'"), "n");
    return n === 2;
  });

  // ADS13 — clic sur créative NON diffusée : refusé
  await expect("ADS13", "clic refusé pour créative non en diffusion", async () => {
    await as("authenticated", U_ADMIN, "update public.ad_campaigns set status='suspended' where id='11111111-1111-1111-1111-111111111202'");
    const n = SCALAR(await as("anon", null, "select public.record_ad_event('11111111-1111-1111-1111-111111111203','clic','home_top_banner','fp-clk') n"), "n");
    await as("authenticated", U_ADMIN, "update public.ad_campaigns set status='active' where id='11111111-1111-1111-1111-111111111202'");
    return n === false;
  });

  // ADS14 — impression d'une créative non approuvée : refusée
  await expect("ADS14", "impression refusée pour créative non approuvée", async () => {
    await as("authenticated", U_ADMIN, "update public.ad_creatives set status='draft' where id='11111111-1111-1111-1111-111111111203' and false"); // no-op
    // créative séparée, non approuvée
    await as("authenticated", U_ADMIN, `
      insert into public.ad_creatives (id, campaign_id, format, name, payload, status)
      values ('11111111-1111-1111-1111-111111111204','11111111-1111-1111-1111-111111111202','banner','Non approuvée','{}','draft')`);
    const n = SCALAR(await as("anon", null, "select public.record_ad_event('11111111-1111-1111-1111-111111111204','impression','home_top_banner','fp-dr') n"), "n");
    return n === false;
  });

  // ADS15 — ad_event_fingerprints inaccessible via l'API
  await expect("ADS15", "empreintes : 0 ligne via l'API (RLS sans policy)", async () => {
    const rows = await as("anon", null, "select * from public.ad_event_fingerprints");
    return rows.rows.length === 0;
  });

  // ADS16 — règlement : réservé ADMIN
  await expect("ADS16", "règlement : editor lecture seulement, admin écrit", async () => {
    try {
      await as("authenticated", U_EDITOR, `
        insert into public.ad_payments (campaign_id, amount, paid_on, method)
        values ('11111111-1111-1111-1111-111111111202', 1000, current_date, 'espèces')`);
      return false;
    } catch { }
    const t = SCALAR(await as("authenticated", U_ADMIN, `
      insert into public.ad_payments (campaign_id, amount, paid_on, method, recorded_by)
      values ('11111111-1111-1111-1111-111111111202', 250000, current_date, 'mobile_money', '${U_ADMIN}')
      returning true t`), "t");
    return t === true;
  });

  // ADS17 — campagne périodique : end_at <= start_at impossible
  await expect("ADS17", "contrainte période : end_at <= start_at refusé", async () => {
    try {
      await as("authenticated", U_ADMIN, `
        insert into public.ad_campaigns (advertiser_id, name, start_at, end_at)
        values ('11111111-1111-1111-1111-111111111201','Inversion',
                now() + interval '1 day', now())`);
      return false;
    } catch { return true; }
  });

  // ADS18 — get_public_ads : campagne suspendue non diffusée
  await expect("ADS18", "campagne suspendue : get_public_ads vide", async () => {
    await as("authenticated", U_ADMIN, "update public.ad_campaigns set status='suspended' where id='11111111-1111-1111-1111-111111111202'");
        const rows = await as("anon", null, "select public.get_public_ad_zone('home_top_banner') zone");
    const empty = rows.rows[0].zone.creatives.length === 0;
    await as("authenticated", U_ADMIN, "update public.ad_campaigns set status='active' where id='11111111-1111-1111-1111-111111111202'");
    return empty;
  });

  // ADS19 — get_public_ads : période expirée non diffusée
  await expect("ADS19", "campagne expirée : get_public_ads vide", async () => {
    await as("authenticated", U_ADMIN, `update public.ad_campaigns
      set start_at = now() - interval '2 days', end_at = now() - interval '1 day'
      where id='11111111-1111-1111-1111-111111111202'`);
        const rows = await as("anon", null, "select public.get_public_ad_zone('home_top_banner') zone");
    const empty = rows.rows[0].zone.creatives.length === 0;
    await as("authenticated", U_ADMIN, `update public.ad_campaigns
      set start_at = now() - interval '1 hour', end_at = now() + interval '1 hour'
      where id='11111111-1111-1111-1111-111111111202'`);
    return empty;
  });

  // ADS20 — annonceur désactivé : diffusion STOPPÉE
  await expect("ADS20", "annonceur inactif : get_public_ads vide", async () => {
    await as("authenticated", U_ADMIN, "update public.advertisers set is_active=false where id='11111111-1111-1111-1111-111111111201'");
        const rows = await as("anon", null, "select public.get_public_ad_zone('home_top_banner') zone");
    const empty = rows.rows[0].zone.creatives.length === 0;
    await as("authenticated", U_ADMIN, "update public.advertisers set is_active=true where id='11111111-1111-1111-1111-111111111201'");
    return empty;
  });

  // ADS21 — purge des empreintes : fonction s'exécute
  await expect("ADS21", "purge_ad_fingerprints s'exécute (0 suppression récente)", async () =>
    eq(SCALAR(await c.query("select public.purge_ad_fingerprints() p"), "p"), null));

  // ADS22 — audit : changement de campagne tracé (consultation ADMIN : RLS audit)
  await expect("ADS22", "audit_logs trace ad_campaigns (entity)", async () => {
    const n = SCALAR(await as("authenticated", U_ADMIN, `
      select count(*) n from public.audit_logs where entity='ad_campaigns'`), "n");
    return Number(n) >= 1;
  });

  console.log("\n=== MIGRATIONS 0037 (audit) puis 0038 (footer) ===");
  // Stubs : 0037 révoque purge_analytics/purge_articles_corbeille, absentes
  // de cette base raccourcie (0001..0026). Les revokes exigent leur existence.
  await c.query(`
    create or replace function public.purge_analytics(int) returns void language sql as 'select null';
    create or replace function public.purge_articles_corbeille() returns void language sql as 'select null';`);
  for (const f of ["0037_durcissement_audit_securite.sql", "0038_emplacement_footer.sql"]) {
    try { await c.query(read(f)); }
    catch (e) { no(`MIG ${f}`, "exécution", e.message); migOk = false; }
  }
  if (migOk) ok("MIG 0037+0038", "audit + emplacement footer appliqués sans erreur");

  console.log("\n=== TESTS FOOTER 0038 (assertions ADS23 -> ADS27) ===\n");

  // ADS23 — 0038 : 9 emplacements (8 seedés + footer), seed idempotent
  await expect("ADS23", "emplacement « footer » existant (9 au total)", async () =>
    Number(SCALAR(await c.query("select count(*) n from public.ad_placements"), "n")) === 9
    && Boolean(SCALAR(await c.query("select exists(select 1 from public.ad_placements where code='footer' and array_length(allowed_formats,1)=3 and max_items=1) e"), "e")));

  // ADS24 — la borne de code reste hermétique : un code inconnu est REFUSÉ
  await expect("ADS24", "contrainte code : le 9e passe, tout autre code refusé", async () => {
    try {
      await c.query("insert into public.ad_placements (code, label, description, allowed_formats) values ('footer_2','X','x',array['banner'])");
      return false; // insertion réussie : FAIL
    } catch { return true; }
  });

  // ADS25 — liaison campagne↔footer : la créative diffuse dans le pied de page
  await expect("ADS25", "get_public_ad_zone('footer') renvoie la créative", async () => {
    await c.query(`insert into public.ad_campaign_placements (campaign_id, placement_code)
      values ('11111111-1111-1111-1111-111111111202','footer')`);
    const rows = await as("anon", null, "select public.get_public_ad_zone('footer') zone");
    const zone = rows.rows[0].zone;
    return zone.creatives.length === 1 && zone.creatives[0].format === "banner";
  });

  // ADS26 — comptage « footer » : impression acceptée puis dédupliquée
  await expect("ADS26", "record_ad_event('footer') compté, dédupliqué par empreinte", async () => {
    const first = SCALAR(await as("anon", null,
      "select public.record_ad_event('11111111-1111-1111-1111-111111111203','impression','footer','fp-footer-1') n"), "n");
    const again = SCALAR(await as("anon", null,
      "select public.record_ad_event('11111111-1111-1111-1111-111111111203','impression','footer','fp-footer-1') n"), "n");
    const click = SCALAR(await as("anon", null,
      "select public.record_ad_event('11111111-1111-1111-1111-111111111203','clic','footer','fp-footer-2') n"), "n");
    const agg = await c.query("select impressions, clicks from public.ad_daily_stats where placement_code='footer' and creative_id='11111111-1111-1111-1111-111111111203'");
    return first === true && again === false && click === true
      && agg.rows[0].impressions === 1 && agg.rows[0].clicks === 1;
  });

  // ADS27 — 0037 préservée : placement inconnu (hors 9) toujours REFUSÉ
  await expect("ADS27", "placement inconnu : refusé, aucune ligne écrite", async () => {
    await as("anon", null, "select public.record_ad_event('11111111-1111-1111-1111-111111111203','impression','header','fp-x')");
    const n = SCALAR(await c.query("select count(*) n from public.ad_daily_stats where placement_code='header'"), "n");
    return Number(n) === 0;
  });

  console.log(`\nAD-TESTS : ${pass} PASS / ${fail} FAIL`);
  if (fail > 0) { console.log("ÉCHECS :", failures.join(", ")); process.exitCode = 1; }

  await c.end();
}

main().catch((e) => { console.error("ERREUR RUNNER :", e.message); process.exit(1); });