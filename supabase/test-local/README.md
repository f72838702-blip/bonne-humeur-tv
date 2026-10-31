# Test local des migrations — PostgreSQL isolé (harnais d'émulation Supabase)

Validation RÉELLE des 8 migrations + de la RLS sur un PostgreSQL quelconque, **sans
aucun contact avec une base réelle**. Exécuté avec PostgreSQL 17.11 (binaires portables
zonky) lors du contrôle final — cf. `RESULTAT_MIGRATIONS_POSTGRESQL.txt` (31/31 PASS).

## Usage

1. Un PostgreSQL atteignable (local ou de test) + une base **vierge** (`bhtv_clean`) ;
2. Dans ce dossier : `npm install` (dépendance `pg`) ;
3. `node runner.mjs full <database>` — applique `00_supabase_emulation.sql` (rôles
   Supabase, schémas `auth`/`storage`, fonction `auth.uid()`) puis les 8 migrations
   dans l'ordre, puis les 21 assertions PASS/FAIL (RLS, anti-élévation,
   anti-auto-publication, rate limiting, Storage, recherche, publication programmée,
   épinglage 0007…) — code de sortie 0 seulement si tout passe ;
4. `node runner.mjs doc-order <database>` — rejoue l'ancien ordre documenté
   (0002_rls avant fonctions) pour prouver l'échec de référence.

## Différences honnêtes avec un vrai projet Supabase

- **pg_cron absent** : 0006 dégrade gracieusement (conçu pour — notice SQL) ; testée
  en exécutant directement `publish_scheduled_articles()`.
- Le rôle du harnais est superutilisateur : le test T13 (écriture d'audit par le
  trigger SECURITY DEFINER) n'exerce donc pas la policy d'insertion exacte — les
  policies d'accès anon/authenticated, elles, sont pleinement exercées.
- Service Auth/Storage HTTP absent : le harnais écrit `auth.users` et
  `storage.objects` directement en SQL (l'appli ne les écrit jamais elle-même).