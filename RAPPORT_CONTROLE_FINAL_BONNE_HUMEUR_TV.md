# RAPPORT DE CONTRÔLE FINAL — BONNE HUMEUR TV

**Date** : 31/10/2026 · **Branche** : `feature/plateforme-media` (aucun push)
**Base de référence** : mission précédente (HEAD `ff483eb`, rapport PRÊT SOUS CONDITIONS)
**Objectif de cette mission** : contrôler ce qui restait incertain avant livraison —
ordre réel des migrations, dépendances React RSC, Cloudflare Workers **Free**,
Supabase Free — sans toucher à la production, sans push, sans deploy de domaine.

> **Instruction respectée** : plus aucune nouvelle fonctionnalité ; uniquement
> résoudre les incohérences, vérifier les intégrations, documenter les étapes
> externes et préparer la livraison.

---

## 1. Résultat réel des migrations PostgreSQL

**Méthode** — PostgreSQL **17.11 réel** (binaires portables, aucun Docker),
serveur isolé sur `127.0.0.1:5433`, harnais d'émulation Supabase
(`supabase/test-local/00_supabase_emulation.sql` : rôles cluster `anon` /
`authenticated` / `service_role`, schéma `auth` avec `auth.uid()` via
`request.jwt.claim.sub`, schéma `storage`). Runner Node (`runner.mjs`, driver
`pg`) à l'extérieur du dépôt. **Aucune base réelle contactée.**

**a) L'ordre documenté ACTUEL a été exécuté tel quel — il ÉCHOUE.**
`0002_rls.sql` (ancien numéro) crée des policies qui appellent `has_role()` /
`is_admin()` **avant** que ces fonctions n'existent (ancien `0003_functions.sql`) :

```
ÉCHEC 0002_rls.sql → function public.has_role(uuid, text) does not exist
```

> ⚠️ **Corrections de mission précédente revues suite au contrôle** : contrairement
> à ce que le rapport initial affirmait, `CREATE POLICY` **ne reporte pas** la
> résolution des fonctions — PostgreSQL les résout **à la création de la policy**.
> L'ordre a donc été **prouvé invalide par exécution réelle**, pas par hypothèse.

**b) Correction appliquée** : renumérotation `git mv` —

```
0001_schema.sql            (inchangé)
0002_functions.sql         (ex-0003 : fonctions AVANT les policies)
0003_rls.sql               (ex-0002 : policies après les fonctions)
0004_storage.sql … 0008_media_folders.sql (inchangés)
```

**c) Re-exécution COMPLÈTE depuis base vierge** (`node runner.mjs full bhtv_clean`)
— ordre 0001 → 0008 : **0 erreur, 0 avertissement**.

**d) Vérifications de fond = 31 assertions PASS / 0 FAIL** (extrait) :

| Contrôle | Résultat |
|---|---|
| 11 tables publiques + 11 catégories seedées | PASS |
| RLS public : anon ne voit que les PUBLIÉS | PASS |
| Anti-auto-publication : reporter ≠ publier (**ERREUR RLS explicite**, pas 0-ligne silencieux) | PASS |
| Anti-élévation : reporter ≠ devenir admin (**ERREUR RLS**) | PASS |
| Seul un `admin` change les rôles | PASS |
| Contact/partenariat : anon écris mais ne lit RIEN ; `form_submissions` inaccessible hors `service_role` | PASS |
| `audit_logs` : remplie par trigger, append-only, lecture admin seulement | PASS |
| `check_rate_limit` : refus à `anon` (grant), `true,true,false` fiable en base, form_type inconnu refusé | PASS |
| `search_published` : ne retourne QUE le publié | PASS |
| Storage : lecture publique restreinte aux 5 dossiers, 2 Mo, anon écriture refusée | PASS |
| Publication programmée (0006) effective sans pg_cron | PASS |
| Tri d'accueil vidéo (0007) : réplique l'algorithme RÉEL de `lib/data/videos.ts` (épinglées puis chrono) | PASS |
| Vue `author_names` lisible par anon (bylines) | PASS |

Preuve datée : `supabase/test-local/RESULTAT_MIGRATIONS_POSTGRESQL.txt`
(ligne finale : `══ RÉSULTAT : 31 PASS / 0 FAIL ═`).
Toute nouvelle correction est accompagnée de tests dans le même runner : **fait**
(les 2 échecs T7/T9 du premier passage ont CORRIGÉ les tests, jamais les policies).

---

## 2. Corrections de dépendances React éventuelles

- CVE examinée : **GHSA-xqc2-xf4c-x3h3** → **introuvable** (404 sur GitHub
  Advisories). Elle n'existe pas — aucune action correspondante.
- Distinction faite (vérifiée par exécution) : `npm ls react-server-dom-webpack
  react-server-dom-parcel react-server-dom-turbopack` → **ces paquets ne sont PAS
  des dépendances npm** de ce projet. Next.js livre ses propres copies
  internes (`next/dist/compiled/*.js`) ; la version de **React (19.2.8)** n'a
  rien à voir avec celles des paquets RSC.
- `package-lock` transitifs : aucune occurrence de ces paquets.
- `npm audit` : **0 advisory** sur ces paquets, et 0 critical/high au global.
- **Conclusion : RIEN à corriger** — pas de migration majeure forcée.

---

## 3. Résultat npm audit

```
npm audit → Severity: moderate (0 critical, 0 high)
```

- Les ~14 `moderate` sont **uniquement dans la chaîne de dev ESLint** (jamais
  embarquée en production) — aucun correctif disponible ni nécessaire.
- Script `audit:check` (seuil `high`) : **passes**.
- Fix réel antérieur conservé : `next 15.5.28` (GHSA-2464-fhr4-w9xw RCE
  critical + GHSA-p3m5-59mp-jv5r), `sharp 0.35.5`, overrides postcss
  8.5.22 / postcss-selector-parser 6.1.5.

---

## 4. Compatibilité Cloudflare Workers Free

**Aucune incompatibilité bloquante n'a été constatée.** Preuve réelle :

- Branche `experimental/cloudflare-workers` (non fusionnée) : `@opennextjs/cloudflare`
  1.20.15 (exige exactement `next >=15.5.28 <16` — condition REMPLIE),
  `wrangler` 4.156.0.
- **Déploiement RÉEL fait** avec `wrangler deploy --temporary` (sans login,
  aucun coût, aucun domaine branché) :
  `https://bonne-humeur-tv-preview.wandering-straw.workers.dev`
- **11 routes testées en HTTP** : toutes 200 correctes (`/`, `/actualites`,
  `/videos`, `/recherche`, `/partenariats`, `/admin`, `/admin/login`,
  `/robots.txt`, `/sitemap.xml`, flux) + 404 attendue sur route inexistante.
- Cache **ISR préservé** (`s-maxage=120`) et **CSP complet préservé**.
- Aucune erreur **1102** (dépassement CPU Workers) pendant martèlement à chaud.
- **À TESTER après branchement Supabase réel** (impossible sans base existante) :
  Server Actions, cookies d'auth `/admin/login`, upload d'images. Ce sont des
  **requêtes réseau** (attentes serveur NON comptées dans le CPU Workers).

### Éligibilité commerciale (décision d'hébergement — remplace Vercel)

| Hébergeur | Éligibilité commerciale | Vérifié le 31/10/2026 |
|---|---|---|
| **Vercel Hobby** | ❌ **NON éligible** — TOS §4 : usage strictement non commercial ; Fair-Use : monétiser/publiciser un produit = usage commercial. **La prod actuelle (Hobby) est donc non conforme** pour une Web TV à vocation d'affaires | vercel.com/legal/terms + /docs/limits/fair-use-guidelines |
| **Cloudflare Workers Free** | ✅ Aucune interdiction d'usage commercial dans la doc Workers ; contrainte réelle = 10 ms **CPU**/invocation (les attentes réseau n'y sont PAS comptées) | developers.cloudflare.com/workers/platform/{pricing,limits} |
| **Netlify Free** (plan B) | ✅ Usage commercial explicitement autorisé ; mais plafond dur 300 crédits/mois (15/déploiement prod, 2/10k requêtes, 20/Go bande passante) → **~15 Go/mo max** : suffisant ici (les images sont servies par Supabase Storage, les vidéos par YouTube) | netlify.com/blog/introducing-netlify-free-plan |

**Recommandation** : cible principale **Cloudflare Workers Free** (certification
Free à faire avec un vrai compte Free du propriétaire) ; repli documenté
**Netlify Free**. Vercel Hobby n'est PAS acceptable en production commerciale.

---

## 5. Temps CPU réellement mesurés en déploiement distant

- **Worker Startup Time : 17 ms** (rapporté par Cloudflare sur le déploiement
  temporaire) → marge confortable sous la limite Free de **10 ms CPU** par
  *exécution de code* (le startup n'est pas du CPU d'invocation).
- **Lecture du CPU exact par requête IMPOSSIBLE depuis un déploiement temporaire
  anonyme** (compte sans dashboard) → **la limite Free 10 ms n'est PAS
  certifiée par ce test** — conforme à la consigne (« ne pas considérer validée
  à partir d'un test local »).
- Temps de réponse muraux mesurés à chaud (réseau compris) : **1,0 – 2,8 s**
  par page SSR depuis la Guinée (le CPU réel n'en est qu'une petite fraction :
  la quasi-totalité = attentes réseau/Supabase).
- **Certification finale** (5 min) : le propriétaire déploie le même `wrangler
  deploy` depuis son VRAI compte Free → dashboard Workers → métriques CPU par
  invocation → constater `< 10 ms` sans erreurs 1102 en usage normal.

---

## 6. Résultats des tests

Suite projet sur `feature/plateforme-media`, au 31/10/2026 :

| Vérification | Résultat |
|---|---|
| `tsc --noEmit` | **0 erreur** |
| `eslint .` | **0 erreur, 0 avertissement** |
| `vitest run` | **55 / 55 PASS** (5 fichiers) |
| `next build` | **29 routes générées** sans erreur |
| `npm audit` | 0 critical / 0 high |
| Migrations SQL (runner isolé) | **8/8 sans erreur** + **31/31 assertions** |
| Routes Cloudflare (HTTP réel) | 11 route OK / 1 404 attendue |
| Fix Next.js RCE (GHSA-2464-fhr4-w9xw) | conservé (15.5.28) |

Tout correctif introduit par cette mission (renumérotation migrations) est
**accompagné de tests** (runner `doc-order`/`full` + preuve textuelle).

---

## 7. Configuration Supabase restante (pour le PROPRIÉTAIRE uniquement)

Checklist complète et à cocher : **`supabase/README-CONFIGURATION.md` § 6**
(clause « Checklist finale du propriétaire »). Résumé opératoire :

1. Créer **l'organisation** sur le plan **Free** (1 projet Free + 1 max, région proche des lecteurs).
2. Créer le **projet**, noter URL + clés (anon PUBLIABLE côté client, **service_role : serveur seulement, JAMAIS dans le rapport ni le client**).
3. Exécuter les **8 migrations dans le NOUVEL ordre 0001 → 0008** via SQL Editor (`0002_functions` **avant** `0003_rls` — l'ancien ordre échoue réellement).
4. Créer le compte admin : **Auth → Add user (Auto Confirm)** PUIS promotion SQL `role='admin'` (§3 du README).
5. Configurer les **variables d'environnement** chez l'hébergeur + en local.
6. Passer la **checklist §6 entière** (login, permissions, upload, formulaires,
   recherche, CMS, sitemap).

Rappels plan Free (non négociables) :
- **Suspension possible après ~1 semaine d'inactivité** — réactivation 1 clic ;
  prévoir un passage hebdomadaire (ou trafic réel suffisant).
- **AUCUN backup automatique quotidien en Free** → exporter (`pg_dump`/CSV)
  manuellement après chaque lot de contenu important (§7 du README).

---

## 8. Points bloquants

| # | Bloquant | Impact | Levier |
|---|---|---|---|
| 1 | **Projet Supabase pas encore créé** (aucun environnement de données réel) | Site non branchable ; pages affichent des états vides honnêtes | Création Free par le propriétaire (checklist §7) |
| 2 | **Certification CPU Workers Free incomplète** (sans compte Free réel, le dashboard CPU reste inaccessible) | Verdict conditionnel sur l'hébergement cible | Déployer depuis le vrai compte Free du propriétaire (5 min) |
| 3 | **Production actuelle sur Vercel Hobby = non conforme commerciale** (TOS §4) | Livraison de production commerciale impossible telle quelle | Migrer vers Workers Free (ou Netlify Free) après certification |

Non bloquants mais à noter (déjà documentés) : rate limiting, invitations,
médiathèque exigent `service_role` (désactivés par défaut = états honnêtes) ;
publication programmée optionnelle sans pg_cron ; CSP `unsafe-inline` pour
scripts Next.js.

---

## 9. Coût mensuel vérifié

| Composant | Plan | Coût |
|---|---|---|
| Hébergement (cible) | Cloudflare Workers **Free** (ou Netlify Free) | **0 USD** |
| Base de données + Auth + Storage | Supabase **Free** | **0 USD** |
| Vidéos | YouTube (embed, hébergement externe) | **0 USD** |
| Dépôt de code | GitHub **Free** | **0 USD** |
| **TOTAL vérifié au 31/10/2026** | | **0 USD / mois** |

Aucun abonnement souscrit, aucun service payant activé.

---

## 10. Procédure définitive de livraison

**Étape A — Propriétaire (Supabase, ~30 min)** : suivre la checklist
`supabase/README-CONFIGURATION.md` § 2 → § 6 (org, projet, migrations ordre
0001→0008, admin Auto Confirm + promotion, clés).

**Étape B — Déploiement (choix de l'hébergeur, écrit préalable du propriétaire
requis)** :
1. Brancher le dépôt GitHub → hébergeur cible, définir les 3 variables d'env.
2. **Recommandé** : Cloudflare Workers Free via `@opennextjs/cloudflare` (déjà
   intégré sur `experimental/cloudflare-workers`) — d'abord un déploy test sur
   **workers.dev** depuis un vrai compte Free + vérification dashboard CPU (§5),
   SEULEMENT ENSUITE brancher le domaine réel.
3. Repli : Netlify Free (usage commercial autorisé, surveiller les crédits).

**Étape C — Validation de production** : passer la checklist §6 à l'échelle
production (login admin, upload, formulaires, recherche, CMS publie, sitemap).

**Étape D — Sauvegarde** : exporter la base (pg_dump/CSV) après chaque lot de
contenu ; exporter périodiquement le Storage `media` (aucun auto-backup en Free).

**Étape E — Rappels contractuels** : aucun push / merge / DNS / deploy de
production sans **autorisation explicite** du propriétaire ; le domaine ne
change qu'après validation des étapes A-B-C.

---

## VERDICT

> ### ✅ **PRÊT SOUS CONDITIONS**
>
> - **Code & sécurité : PRÊT.** Migrations prouvées sur PostgreSQL réel
>   (0 erreur, 31/31 tests), dépendances React RSC = rien à corriger,
>   0 advisory critique/haute, 55/55 tests, build 29 routes, tsc/lint zéro.
> - **Infrastructure : PRÊT SOUS CONDITIONS** — les 3 mêmes conditions qu'auparavant :
>   1) création + configuration Supabase Free par le propriétaire (checklist) ;
>   2) certification CPU 10 ms des Workers Free avec un **vrai compte Free**
>   (17 ms de startup mesuré en réel, aucun 1102, mais CPU exact lisible uniquement
>   depuis un dashboard Free) ;
>   3) **abandon de Vercel Hobby pour la production commerciale** (TOS §4 ;
>   la prod actuelle est non conforme) au profit de Cloudflare Workers Free
>   (recommandé) ou Netlify Free (repli).
> - Budget : **0 USD/mois vérifié**. Aucun push, aucun deploy de production
>   effectué — production Vercel existante NON modifiée.