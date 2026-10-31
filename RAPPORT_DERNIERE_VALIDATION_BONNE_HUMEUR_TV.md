# RAPPORT DE DERNIÈRE VALIDATION — BONNE HUMEUR TV

**Date** : 31/10/2026 · **Branche** : `feature/plateforme-media` · **Aucun push, aucune fusion, aucun déploiement de production**
**Rapport de référence** : `RAPPORT_CONTROLE_FINAL_BONNE_HUMEUR_TV.md` (commit `13909bb`)

---

## 0. ERRATA — 4 corrections factuelles découvertes par cette mission

Aucune de ces découvertes n'a exigé de modification du code applicatif ; trois
ont exigé des corrections de documentation/dépôt, une est environnementale.

| # | Affirmation précédente (FAUSSE) | Réalité vérifiée | Correction faite |
|---|---|---|---|
| 1 | « GHSA-xqc2-xf4c-x3h3 est introuvable (404), elle n'existe pas » | **L'avis EXISTE** : RCE critique (CVSS 9.5) dans `react-server-dom-*`, publié par React le **14/10/2026**. Précisément corrigé par **Next.js 15.5.28** — le projet ÉTAIT déjà à jour (fait le 22/10/2026) | Bannière + corrections dans le rapport de référence (commit `13909bb`) ; analyse complète ci-dessous § 1 |
| 2 | « Publication programmée (0006) effective sans pg_cron » | **La fonction** l'est (test T17) ; **l'ordonnancement** exige pg_cron — **disponible en Supabase Free** | README-CONFIGURATION § 6 (nouvel item checklist cron) + § 8 re-formulés |
| 3 | `.gitignore` de la branche expérimentale ne couvrait plus `supabase/.temp/` | Risque de re-committ accident (celui déjà corrigé par `e1291e6` sur `feature`) | Restauré sur `experimental/cloudflare-workers` (commit `60564b2`) |
| 4 | `npm run audit:check` = outil de vérification | Dans CET environnement, le script échoue sur `EALLOWSCRIPTS` (config npm locale `allow-scripts=@anthropic-ai/claude-code` de Claude Code). **Le projet n'est pas en cause** : `npm audit --audit-level=high` direct = **exit 0** | Documenté ici (§ 6) |

---

## 1. Vérification React RSC

### a) Les trois avis officiels

| Avis | Paquets | Versions vulnérables | Versions corrigées | Sévérité | Projet concerné ? |
|---|---|---|---|---|---|
| [GHSA-xqc2-xf4c-x3h3](https://github.com/react/react/security/advisories/GHSA-xqc2-xf4c-x3h3) (React) — **RCE non authentifié** dans RCS (transport de plusieurs *typed arrays* + valeur contrôlée par l'attaquant) | `react-server-dom-webpack`, `-parcel`, `-turbopack` | 19.0.0–19.0.8, 19.1.0–19.1.9, **19.2.0–19.2.8**, 19.3.0 | 19.0.9, 19.1.10, **19.2.9**, 19.3.1 | **Critique 9.5** | Voir couche ② ci-dessous |
| [GHSA-h3gv-c5rc-p453](https://github.com/react/react/security/advisories/GHSA-h3gv-c5rc-p453) (React) — **DoS** dans Server Functions (OOM/CPU excessif par requêtes forgées) | idem | 19.0.0–19.0.7, 19.1.0–19.1.8, **19.2.0–19.2.7**, 19.3.0 | idem | **High 8.2** | OUI (le CMS utilise des Server Actions) |
| [GHSA-673q-mjm6-r5xr](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr) (Next.js) — RCE via `use cache` retournant plusieurs *typed arrays* (déclinaison de GHSA-xqc2 côté Next) | `next` | ≥16.0.0–16.4.0 ; 15.x corrigé par backport | **15.5.28**, 16.4.1 | Critique 9.5 | Non applicable (aucun `use cache` dans le projet — vérifié par recherche `use cache`/`cacheComponents` : **0 occurrence**) |

Source de synthèse officielle : [blog Next.js, mise à jour sécurité du 14/10/2026](https://nextjs.org/blog/nextjs-security-update-october-14-2026) —
*« Updates are now available in v16.4.1 (Active LTS) and v15.5.28 (Maintenance LTS) »*, citant les trois avis ci-dessus.

### b) Les trois couches, distinguées (exigence de la mission)

**Couche ① — dépendances npm installées** : `npm ls` réel —

```
react@19.2.8, react-dom@19.2.8 (directes)
react-server-dom-webpack/parcel/turbopack : ABSENT de l'arbre npm
```

Aucun paquet `react-server-dom-*` n'est installé en npm — **rien à installer
manuellement** (consigne respectée). Les avis React ciblent ces paquets-là,
pas `react`/`react-dom` eux-mêmes.

**Couche ② — compilées et embarquées dans Next.js 15.5.28** (les vrais
composants RSC utilisés par l'App Router) : les copies réellement exécutées
sont dans `node_modules/next/dist/compiled/react-server-dom-*` (vérifiées :
`react-server-dom-webpack`, `react-server-dom-webpack-experimental`,
`react-server-dom-turbopack`, `react-server-dom-turbopack-experimental`).

**Preuve de patch par diff binaire réel** — tarballs officiels npm téléchargés
et comparés (MD5, l'un après l'autre, hors dépôt) :

```
next@15.5.27 vs next@15.5.28
react-server-dom-webpack                : 24 fichiers différents
react-server-dom-webpack-experimental   : 24 fichiers différents
react-server-dom-turbopack              : 24 fichiers différents
react-server-dom-turbopack-experimental : 24 fichiers différents
react (noyau vendored)                  : 0 fichier différent
react-dom (noyau vendored)              : 0 fichier différent
```

→ La seule différence entre 15.5.27 et 15.5.28 dans le noyau React vendu est
la **réécriture complète (rebuild) des 4 paquets RSC embarqués** — en
concordance exacte avec les avis du 14/10/2026 (le correctif RSC est LE
contenu de cette release). Cross-check avec l'avis Next : version corrigée
15.x = **15.5.28**.

**Couche ③ — vulnérabilités réellement applicables à Next.js 15.5.28** :

| Avis | Applicabilité | Verdict |
|---|---|---|
| GHSA-xqc2-xf4c-x3h3 (RSC RCE) | Applicable au framework (App Router RSC) mais **corrigé dans 15.5.28** ; voie d'attaque « `use cache` + typed arrays » inexistante dans le projet (aucun `use cache`) | ✔ Patché ET non exploitable |
| GHSA-h3gv-c5rc-p453 / GHSA-p3m5-59mp-jv5r (DoS Server Actions) | **Applicable** (le CMS utilise des Server Actions) — corrigé dans 15.5.28 | ✔ Patché |
| CVE-2026-96889 / GHSA-2464-fhr4-w9xw (RCE optimisation image, glibc Linux) | corrigé par `sharp ≥ 0.35.5` (projet : **0.35.5**) | ✔ Protégé |

### c) Verdict React RSC

> **Rien à corriger.** Next.js 15.5.28 embarque les copies RSC corrigées
> (preuve : diff 15.5.27↔15.5.28 + avis officiels). React 19.2.8 côté npm
> n'est pas concerné (les avis ne ciblent pas `react`/`react-dom`).
> L'affirmation précédente « avis inexistant » était **fausse** et a été
> corrigée partout où elle figurait.

---

## 2. Publication programmée : mécanisme précis et incohérence résolue

`supabase/migrations/0006_scheduled_publish.sql` examiné intégralement.

### a) Le mécanisme réel, étage par étage

1. **Saisie (CMS)** : l'éditeur choisit le statut `scheduled` + une date
   (`ArticleForm.tsx` : le champ s'affiche conditionnellement ; validation
   serveur `lib/actions/content.ts` : *date requise pour une publication
   programmée*).
2. **Base** : l'article reste en `status='scheduled'` → **invisible au public**
   (RLS/reads publics : `status='published' AND published_at <= now()`
   uniquement — vérifié dans le code `lib/data/articles.ts` + tests T4/T15).
3. **Ordonnanceur (le SEUL mécanisme d'exécution)** : **pg_cron** crée la tâche
   `bhtv-publish-scheduled` au rythme `*/5 * * * *` (toutes les 5 minutes),
   qui appelle la fonction `public.publish_scheduled_articles()`
   (`SECURITY DEFINER`, `search_path = public`, `revoke` à `public/anon/
   authenticated` — appelable uniquement depuis le contexte ordonnanceur/admin).
   La fonction passe `scheduled → published` avec
   `published_at = coalesce(published_at, scheduled_at)`.
4. **Visibilité** : dans les ≤ 5 minutes suivant `scheduled_at`, l'article
   devient public, **sans intervention manuelle**.

### b) L'incohérence signalée, résolue

« Publication programmée effective sans pg_cron » (T17) ≠ « migration
optionnelle si pg_cron absent ». **Résolution** : la migration n'est pas
optionnelle dans son contenu — la **fonction** est toujours créée, et un bloc
`DO` (avec `exception`, aucun échec de migration) **crée l'ordonnancement si
et seulement si pg_cron est disponible** ; sinon une `raise notice` explicite
déclare la publication MANUELLE uniquement.

- **Sur Supabase (Free inclus)** : pg_cron est pré-installé et activable —
  source : [docs Cron Supabase](https://supabase.com/docs/guides/cron) +
  [install](https://supabase.com/docs/guides/cron/install). Donc **l'ordonnancement
  EST opérationnel sur le backend cible** (tâche visible dans `cron.job`,
  historique dans `cron.job_run_details`). Test T17 prouvait la fonction, PAS
  l'ordonnancement — reformulé en conséquence dans le rapport de référence et
  dans le README.
- **Sur un Postgres sans pg_cron** : la fonctionnalité n'est **PAS
  opérationnelle** — consigne respectée : elle ne doit pas être présentée
  comme active (README § 8 reformulé).

### c) Vérification par le propriétaire (ajoutée à la checklist § 6)

- Extension `pg_cron` activée (Dashboard → Intégrations → Cron) ;
- `select * from cron.job;` contient `bhtv-publish-scheduled` (`*/5 * * * *`) ;
- **Test réel** : un article `scheduled` à H+5 devient visible publiquement
  dans les ~5 minutes sans aucune action.

### d) Compatibilité Cloudflare Cron Triggers (gratuits)

- Les **Cron Triggers (Scheduled handlers) existent en Workers Free** — c'est
  un mécanisme possible d'alternative : un handler programmé pourrait appeler
  une fonction/rpc Supabase avec le `service_role` (secret côté Worker).
- **Non implémenté — choix d'architecture** : pg_cron est déjà câblé dans la
  migration 0006 et vit dans la base (aucune dépendance au front). Une
  variante Cloudflare serait un complément de configuration d'OpenNext
  (évolution future si la direction le demande). Le projet n'use donc aucun
  cron Cloudflare aujourd'hui — la publication programmée ne dépend pas de
  l'hébergeur.

---

## 3. Cloudflare : vérification finale & procédure propriétaire

**Branche expérimentale CONSERVÉE, JAMAIS fusionnée** (séparation prouvée § 5).

### a) Ce qui a été réellement vérifié (déploiement temporaire du contrôle précédent)

- Déploiement réel : `wrangler deploy --temporary` →
  `https://bonne-humeur-tv-preview.wandering-straw.workers.dev` (aucun login,
  domaine intact) via `@opennextjs/cloudflare` 1.20.15 (exige
  `next >=15.5.28 <16` : **exact** avec 15.5.28).
- **Routes testées (11 requêtes réelles)** : `/`, `/actualites`, `/videos`,
  `/recherche`, `/partenariats`, `/admin`, `/admin/login`, `/robots.txt`,
  `/sitemap.xml` (+ flux XML) = **200** ; route inexistante = **404** attendue.
- **Fonctionnalités vérifiées** : rendu SSR complet, cache ISR préservé
  (`s-maxage=120, stale-while-revalidate`), **CSP complet préservé**,
  404 applicative, préchargement statique des assets.
- **Erreurs éventuelles** : **aucune** — 0 erreur 1102 (dépassement CPU
  Workers), 0 5xx, pendant un martèlement à chaud.
- **Nombre de requêtes** : quelques centaines (test) — sans incidence :
  la limite Free est **100 000 requêtes/jour**.

### b) Worker Startup Time ≠ CPU Time (distinction exigée)

- **Worker Startup Time : 17 ms** — c'est le temps de **démarrage/chargement
  de l'isolate** (cold start), rapporté par Cloudflare. **Ce N'EST PAS le CPU
  par requête** et il ne prouve PAS la limite Free à lui seul.
- **CPU Time par invocation : NON mesuré** — indisponible sur un déploiement
  temporaire anonyme (aucun dashboard). **La limite Free de 10 ms CPU
  n'est PAS certifiée à ce jour** (consigne du contrôle précédent respectée).
  Le CPU pertinent = l'exécution du Worker par requête ; la marge est
  **favorable** (17 ms de startup pour un worker Next.js SSR + le fait que
  les appels Supabase sont des attentes réseau qui ne consomment PAS du CPU
  Workers), mais cela reste à **constater sur le dashboard réel**.

### c) Procédure de vérification par le PROPRIÉTAIRE (vrai compte Cloudflare Free)

Prérequis : branche `experimental/cloudflare-workers` (ne PAS fusionner) ;
Node ≥ 18 ; compte Cloudflare **Free** (aucun abonnement, aucune carte).

```bash
git switch experimental/cloudflare-workers
npm install
npx opennextjs-cloudflare build        # génère .open-next/worker.js
npx wrangler login                     # connexion du PROPRIÉTAIRE
npx wrangler deploy                    # → https://bonne-humeur-tv-preview.<sous-domaine>.workers.dev
npx wrangler tail                      # (option) logs live pendant le test
```

Puis **Dashboard Cloudflare → Workers & Pages → bonne-humeur-tv-preview →
Métriques** :

| Élément à relever | Où | Critère de certification |
|---|---|---|
| **CPU Time par invocation** (p50 et p99) | Metrics → invocation | **p99 < 10 ms** sur les pages SSR à chaud |
| **Error 1102** (dépassement CPU) | Metrics → erreurs / `wrangler tail` | **0 occurrence** pendant un parcours complet (accueil, actus, recherche, formulaires admin) |
| **Nombre de requêtes reçues** | Metrics → requests | compteur visible (< limites du plan) |
| **Erreurs 5xx / exceptions** | Metrics | 0 |

**Limites du plan Workers Free (à connaître pendant la vérification)** :
100 000 requêtes/jour · **10 ms CPU par invocation (p50 ; p99 = 30 ms,
déclencheurs d'erreurs au-delà)** · 128 Mo de mémoire · 50 sous-requêtes par
invocation · Cron Triggers gratuits. **Les attentes réseau (Supabase, YouTube)
ne sont PAS comptées dans le CPU.** Sources :
[pricing Workers](https://developers.cloudflare.com/workers/platform/pricing/) ·
[limits Workers](https://developers.cloudflare.com/workers/platform/limits/).

**Décision** : CPU p99 < 10 ms sans 1102 → **Workers Free certifié** (cible
d'hébergement principale, usage commercial autorisé). Sinon → repli documenté
**Netlify Free** (usage commercial explicitement autorisé, plafond 300
crédits/mois). **Aucun domaine, aucun DNS, aucun merge avant cette étape.**

---

## 4. Supabase : préservation et checklist propriétaire

- **Ordre corrigé CONSERVÉ et inchangé** : `0001 → 0002_functions →
  0003_rls → 0004 → 0005 → 0006 → 0007 → 0008` (aucune migration re-touchée
  cette mission).
- **31 assertions SQL CONSERVÉES** (preuve : `supabase/test-local/
  RESULTAT_MIGRATIONS_POSTGRESQL.txt` — 31 PASS / 0 FAIL sur PostgreSQL
  17.11 réel isolé). Aucune base réelle/production contactée (consigne).
- **Checklist du propriétaire : `supabase/README-CONFIGURATION.md` § 6**
  (mise à jour cette mission : **item cron/pg_cron ajouté**). Résumé :
  org Free → projet (région proche des lecteurs) → 8 migrations dans le
  **nouvel ordre** via SQL Editor → compte admin par **Auth → Add user
  (Auto Confirm)** puis promotion SQL → 3 variables d'environnement
  (anon côté navigateur, **service_role serveur uniquement**) → checklist
  complète : connexion, permissions/RLS, **upload image WebP < 2 Mo**,
  formulaires (contact/partenariats + rate limit), recherche (publiés
  uniquement), CMS publication, publication programmée (cron, voir § 2c),
  sitemap/robots.
- Rappels plan Free (inchangés) : suspension après ~1 semaine d'inactivité
  (réactivation 1 clic) ; **aucun backup automatique quotidien** → export
  manuel `pg_dump`/CSV après chaque lot de contenu.

---

## 5. État Git et livraison (relevé réel du 31/10/2026, fin de mission)

| Élément | État |
|---|---|
| Branche courante | `feature/plateforme-media` |
| HEAD réel feature | `13909bb` avant le commit final de ce rapport (voir `git log`) |
| `main` | **intacte** à `9351a77` ; merge-base(feature, main) = `9351a77` → feature diverge de la pointe de main, main jamais re-commitée |
| `experimental/cloudflare-workers` | `60564b2` (= `ab59270` base partagée + `5c8bbbd` (OpenNext), `bbe0e0c` (gitignore artefacts), `60564b2` (gitignore supabase/.temp)) · **merge-base avec feature = `ab59270`** → **aucun commit Cloudflare n'est dans feature, aucune fusion** |
| Commits de cette mission | `13909bb` (errata rapport de contrôle) · `60564b2` (expérimentale) · commit final du présent rapport |
| Fichiers non suivis | **1 seul** : `RAPPORT_CLOTURE_ET_PASSATION_GLM53.md` (conservé NON commité, conformément à la passation) |
| Arbre de travail | propre (aucun fichier modifié non commité à la fin) ; aucun stash |
| Push / fusion / deploy | **aucun** — tout est local ; la branche distante n'a jamais reçu ces commits |

---

## 6. Résultats des tests (re-exécutés au 31/10/2026, sur `feature`)

| Vérification | Résultat |
|---|---|
| `tsc --noEmit` | **0 erreur** |
| `eslint .` | **0 erreur, 0 avertissement** |
| `vitest run` | **55/55 PASS** (5 fichiers) |
| `next build` | 26 pages statiques + routes dynamiques générées, **0 erreur** |
| `npm audit --audit-level=high` (direct) | **exit 0** — 0 critical, 0 high ; 14 moderate **dev-only** (chaîne ESLint : `minimatch` GHSA-g3hv-75wg-m249 ; aucun fix non-breaking, jamais embarqué en prod) |
| `npm run audit:check` | échec `EALLOWSCRIPTS` = anomalie **locale** (config npm de Claude Code), le projet n'est pas en cause — commande directe = exit 0 |
| Migrations SQL (réel PostgreSQL 17.11) | 8/8 **0 erreur** + **31/31 assertions** |
| Routes Cloudflare (HTTP réel, déploiement temporaire) | 11/11 réponses correctes (200/404 attendue) |

---

## 7. Points bloquants restants (tous externes au code)

| # | Bloquant | Dépend de | Action |
|---|---|---|---|
| 1 | Création + configuration **Supabase Free** (aucun projet réel n'existe) | Direction | Checklist `README-CONFIGURATION.md` § 2→§ 6 |
| 2 | **Certification CPU 10 ms** Workers Free (dashboard inaccessible depuis le déploiement temporaire) | Direction | Procédure § 3c (vrai compte Free, 5 min) |
| 3 | **Production actuelle sur Vercel Hobby = non conforme commerciale** (TOS §4 + Fair-Use) | Direction | Migrer vers Workers Free (recommandé) ou Netlify Free — jamais fusionner avant certification CPU |
| 4 | Activation **pg_cron** + vérif. tâche `bhtv-publish-scheduled` | Direction | Item ajouté à la checklist § 6 (résolu par le toggle Dashboard) |

Aucun point bloquant **technique** côté code : suite de tests intégralement verte,
migrations prouvées, dépendances à jour et patchées.

---

## 8. Coût mensuel vérifié (re-contrôlé au 31/10/2026)

Hébergement Workers Free (ou Netlify Free) **0 USD** · Supabase Free **0 USD**
· YouTube embed **0 USD** · GitHub Free **0 USD**. **Total : 0 USD/mois.**
Aucun abonnement, aucun service payant.

---

## 9. Mise en service remise à la direction

1. **Configuration externe** (direction) : Supabase Free + checklist
   `README-CONFIGURATION.md` § 2→§ 6 ; vrai compte Cloudflare Free + procédure
   § 3c ; décider Workers Free vs Netlify Free d'après la certification CPU.
2. **Tests d'intégration** : une fois Supabase branché — checklist § 6 entière
   (CMS de bout en bout, permissions, upload, formulaires, recherche, cron).
3. **Production** : uniquement après 1 et 2 + autorisation explicite de la
   direction (push, merge, DNS, deploy — chaque étape séparément).

---

## VERDICT FINAL

> ### ✅ **PRÊT POUR CONFIGURATION EXTERNE**
>
> Le code, testé et vérifié (Next 15.5.28 patché, migrations prouvées
> 31/31, 55/55 tests, audit propre), n'attend plus que les actions que
> seule la direction peut réaliser : création de Supabase Free (checklist),
> certification CPU du vrai compte Cloudflare Free (procédure) et décision
> d'hébergement (Workers Free recommandé ; Netlify Free repli ; Vercel Hobby
> **exclu** pour une production commerciale). Dès ces étapes, le projet
> passe **prêt pour tests d'intégration**, puis **prêt pour production**
> après autorisation explicite. Il n'est **pas** encore « prêt pour
> production » tant que la configuration externe n'est pas réalisée —
> conformément à l'ordre des verdicts : *Prêt pour configuration externe*.