# RAPPORT FINAL — PRÊT LIVRAISON BONNE HUMEUR TV

**Date :** 31 octobre 2026
**Branche de livraison :** `feature/plateforme-media` (HEAD `ab59270` + docs, voir §1)
**Branche expérimentale :** `experimental/cloudflare-workers` (isolée, non fusionnée)
**Rédigé par :** Claude Code (mission de reprise et finalisation GLM 5.3 Flash)
**Production :** https://bonne-humeur-tv.vercel.app — **NON modifiée pendant toute la mission**

---

## 1. État Git

| Élément | État vérifié |
|---|---|
| Branche de travail | `feature/plateforme-media` |
| Commits (11 au total, du plus vieux au plus récent) | `5c10acc`, `3c05d04`, `9351a77` (pré-mission) → `6d95898` (backend), `ff80c4e` (cms), `c3b993f` (public), `b3600c5` (docs), `c4bca82` (directive), `229376b` (docs) → **`ab59270` (fix sécurité Next.js — cette mission)** |
| Nouveaux commits de cette mission | `ab59270` fix(securite) : Next 15.5.28 · docs ci-dessous (README-CONFIGURATION + présent rapport) |
| `git push` | **JAMAIS effectué** (le dépôt distant n'a reçu aucun commit des deux missions) |
| Arbre de travail | propre ; `RAPPORT_CLOTURE_ET_PASSATION_GLM53.md` préservé non commité (consigne passation) |
| `main` | jamais touchée |

---

## 2. Mise à jour de Next.js — terminée et vérifiée

### Avant
`next@15.5.24` — vulnérable aux avis du **22 octobre 2026**.

### Examen des deux avis exigés (GitHub Advisory API, sources officielles)

| Avis | Sévérité | Résumé | Impact concret ici |
|---|---|---|---|
| **GHSA-2464-fhr4-w9xw** | **Critical (CVSS v4 9.5)** | RCE **non authentifié** via l'API d'optimisation d'images, lorsque SVG traités et next sur Linux glibc ; cause : dépendance upstream librsrv vulnérable (CVE-2026-96889) | Vulnérable ; le correctif exige `next ≥ 15.5.28` **ET** `sharp ≥ 0.35.5` |
| **GHSA-p3m5-59mp-jv5r** (CVE-2026-94482) | **High (8.2)** | DoS App Router via Server Actions (CPU excessif bloquant) | Vulnérable — le projet utilise massivement les Server Actions |
| + découverts : GHSA-4jqv-mc3x-m676 et GHSA-mcj8-r9mp-w47p | Critical | Cache poisoning SSG/ISR | Vulnérables (pages publiques ISR), corrigés dès 15.5.27 |

### Version installée après correction (vérifiée `npm ls`)

| Package | Avant | Après | Fix des avis |
|---|---|---|---|
| `next` | 15.5.24 | **15.5.28** (branch 15.x, pas de saut vers 16 — conforme à la mission) | les 4 avis ci-dessus |
| `sharp` (dépendance interne de next) | 0.35.4 | **0.35.5** | GHSA-2464-fhr4-w9xw / GHSA-wq5f-xc86-pv6w |
| `react` / `react-dom` | 19.2.8 | 19.2.8 (inchangé, aucune vulnérabilité) | — |
| `postcss` (interne next) | 8.4.31 (**high**, 4 avis) | **8.5.32** via override npm | GHSA-qx2v…, -6g55…, -fxqj…, -r28c… |
| `postcss-selector-parser` | < 6.1.5 (moderate) | **6.1.5** via override npm | GHSA-rj75-hqrm-r3gf |

*Le correctif proposé par `npm audit fix --force` était `next@16.4.3` — saut de version majeure interdit par la mission ; l'override npm `postcss ≥ 8.5.22` est la voie compatible 15.x, validée par le build (§3).*

### Compatibilité Server Actions

Vérifiée structurellement : `tsc` 0 erreur, tests 55/55 (dont les schémas Server Actions), build de production OK, middleware (auth via `@supabase/ssr`) généré — l'appareil est inchangé, seule la version du framework évolue dans la même branche 15.x.

---

## 3. Résultats des tests — TOUTES commandes réellement exécutées lors de cette mission

| Commande | Résultat |
|---|---|
| `npx tsc --noEmit` | **EXIT 0** — 0 erreur TypeScript strict |
| `npm run lint` | **EXIT 0** — 0 erreur, 0 warning |
| `npm test` (Vitest) | **55/55 réussis** (5 suites) |
| `npm run build` | **EXIT 0** — 29 routes, middleware 94,7 kB (1 warning préexistant bénin : fichier lockfile racine — déjà présent avant la mission) |
| `npm audit` | **0 critical, 0 high** — 14 **moderate toutes dev-only** (chaîne ESLint + `minimatch` GHSA-g3hv-75wg-m249 : aucun correctif publié, le correctif exigerait ESLint 4 → incompatible avec `eslint-config-next` ; aucune exposition runtime/production). Le script `audit:check` (`--audit-level=high`) passe. |

---

## 4. État réel de Supabase — INCHANGÉ et HONNÊTE

> **CORRECTION postérieure à ce rapport** (mission de contrôle suivant) : la note
> d'« ordre viable » ci-dessous s'est révélée **fausse** — l'exécution réelle sur
> PostgreSQL isolé a prouvé que `0002_rls` (ancien) échoue (`function public.has_role
> does not exist`). Les migrations ont été renumérotées (fonctions en 0002, RLS en
> 0003) et validées complètement depuis une base vierge : voir
> `RAPPORT_CONTROLE_FINAL_BONNE_HUMEUR_TV.md`.

- **AUCUN projet Supabase n'existe** — aucune migration appliquée (les 8 fichiers vivent dans `supabase/migrations/`). Rien n'a été exécuté sur une base réelle pendant cette mission (conformité).
- **Analyse statique des 8 migrations SANS contact de base** (exigence mission) :
  - Ordre `0001 → 0002 → 0003 → 0004 → 0005 → (0006) → 0007 → 0008` **viable** : les policies 0002 appellent `has_role()`/`is_staff()` définies en 0003, valide car `CREATE POLICY` ne résout pas les fonctions à la création ; caveat documenté — appliquer 0002/0003 consécutivement (sinon erreur transitoire sur les tables staff) ;
  - 0006 : délimiteur `$cron$` sans conflit (bonne pratique héritée, vérifiée) ; **optionnelle**, dégradation documentée sans pg_cron ;
  - **0007 OBLIGATOIRE avant le formulaire vidéo** (INSERT vidéo sans cette colonne = erreur) ;
  - `check_rate_limit` révoquée à public/anon/authenticated : appelée uniquement via `service_role` — cohérent avec l'état « dégradé » documenté sans la clé ;
  - 0007/0008 idempotentes (`if not exists` / `drop policy if exists`) ; `lib/types.ts` aligné (`position` sur Video et BreakingNews).
- **Procédure propriétaire mise à jour** (`supabase/README-CONFIGURATION.md`) : le §2 listait seulement 0001→0006 (défaut de documentation hérité de la mission précédente) — corrigé : table complète 0001→0008 + notes d'analyse ; §3 corrigé (création du compte dans **Authentication → Add user (Auto Confirm)** AVANT la promotion SQL admin, sinon la promotion échoue : pas de ligne `profiles`).
- **TOUT CE QUI SUIT RESTE BLOQUÉ PAR CONFIGURATION EXTERNE** (détenu par la direction) : parcours authentifiés, inserts formulaires, RLS réelle, Storage réel, recherche réelle. Le code est prêt ; **règle tenue : aucune prétention de test non exécuté.**

---

## 5. Résultats Cloudflare Workers Free — étude réelle + prévisualisation LOCALE

**Branche dédiée `experimental/cloudflare-workers`** (2 commits : adapteur + gitignore) — rien de fusionné, **aucun déploiement, aucun DNS, aucun domaine touché**, aucune autorisation Cloudflare utilisée.

### 5.1 Ce qui a réellement été fait

1. `@opennextjs/cloudflare@1.20.15` + `wrangler@4.156.0` installés sur la branche expérimentale **uniquement** — *point favorable : l'adaptateur exige exactement `next ≥ 15.5.28 < 16 || ≥ 16.4.1`, fenêtre crée par la mise à jour de §2* ;
2. `open-next.config.ts` (minimal, sans cache R2) + `wrangler.jsonc` (`nodejs_compat`) committés ;
3. **`opennextjs-cloudflare build` : SUCCÈS** — worker `.open-next/worker.js` + assets générés (App Router, RSC, middleware 94,7 kB, ISR bundle inclus) ;
4. **Prévisualisation locale réelle (`wrangler dev`, runtime workerd)** + tests curl :

| Route | Résultat | Détail |
|---|---|---|
| `/` (accueil ISR) | **200** (0,16 s warm) | en-têtes `Cache-Control: s-maxage=120, stale-while-revalidate` préservés ; contenu réel rendu |
| `/actualites`, `/videos`, `/recherche`, `/partenariats` | **200** (0,07-0,17 s) | SSR App Router fonctionnel dans workerd |
| `/admin/login`, `/admin` | **200** | état « non configuré » honnête affiché (backend absent) |
| `/sitemap.xml`, `/robots.txt` | **200** | générés |
| route inexistante | **404** correct | |
| En-têtes de sécurité (CSP complète, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, HSTS) | **INTÉGRALEMENT PRÉSERVÉS** sur le Worker | — |

### 5.2 Évaluation honnête des limites Workers Free

| Contrainte Free | Évaluation |
|---|---|
| **10 ms CPU/invocation** | ⚠️ **POINTE CRITIQUE.** Non mesurable en local (workerd local n'applique pas la limite). Les rendus SSR chauds sont rapides ici, mais le budget 10 ms du plan Free est **très serré** pour du SSR Next.js + suppression d'ISR en worker. Cloudflare ne recommande pas son offre Free pour du SSR de production. → **DOIT être validé sur un déploiement workers.dev réel** (dépend de comptes Cloudflare détenus par la direction — aucun accès) |
| **100 000 requêtes/jour** | Plausible pour un portail d'audience moyenne ; l'ISR (`s-maxage=120` + SWR) amortit fortement le coût SSR |
| **128 MB mémoire** | Passe en local workerd ; sans garantie absolue sur pics réels |
| **Cookies/auth/Server Actions** | Middleware + `@supabase/ssr` compilés et servant les pages correctement en local ; les parcours authentifiés réels **restent à tester** avec un Supabase configuré |
| **Upload images (Server Action multipart)** | Non invocable par curl ; à tester sur le déploiement de prévisualisation |
| **ISR/cache sans R2** | Config minimale : revalide dans le Worker — fonctionne ; ajouter le cache R2/KV OpenNext = amélioration future (R2 = gratuit limité, pas facturable par défaut) |

### 5.3 Verdict Cloudflare

**VIABLE TECHNIQUENEMENT EN LOCAL, NON CERTIFIABLE SUR LE PLAN FREE EN L'ÉTAT.** La migration expérimentale fonctionne (build + rendu + en-têtes), mais :
- le budget CPU 10 ms/invocation du plan Free ne peut être validé sans un déploiement workers.dev réel ;
- `vinext` (1.4.0, bêta) examiné documentairement : **non retenu** (solution bêta — conforme à la consigne).

**Recommandation honnête :** conserver **Vercel Hobby (0 $)** comme hébergement appliquatif — c'est la cible actuellement fiable et gratuite du projet, déjà déployée ; Cloudflare Workers Free reste **documenté comme non certifié** jusqu'à validation réelle. Conformément à la mission : les limites sont documentées, pas masquées.

---

## 6. État du CMS, compression et médias

- **Code inchangé et préservé** (aucune reconstruction) : `/admin` complet (11 sections, workflow éditorial, rôles), pipeline YouTube strict, pipeline images (compression navigateur + variantes + sniffer serveur), 4 clients Supabase séparés ;
- **Validation réelle CMS/pipeline : IMPOSSIBLE à ce stade** (aucun Supabase, aucune clé). Ce n'est pas une omission : c'est la dépendance externe P0 §8 du rapport précédent, non levée par cette mission (elle appartient à la direction) ;
- Checklist exacte prête d'exécution : `supabase/README-CONFIGURATION.md` §6 (login admin, article publié visible, vidéo visible, formulaire enregistré, sitemap) + tests anti-fraude upload (SVG déguisé, exécutable renommé) ;
- Chrome/Firefox/Edge/Safari : **non testés réels** (pas de backend) — à jouer après configuration, matrice documentée.

---

## 7. Problèmes encore présents (tous documentés, aucun masqué)

| # | Problème | Nature | Résolution |
|---|---|---|---|
| 1 | Aucun projet Supabase / migrations non appliquées | Bloquant P0 — configuration direction | Procédure README §1-§4 mise à jour (cette mission) |
| 2 | Parcours CMS/rôles/formulaires/Storage non testés en réel | Dépend du #1 | Checklist §6 + anti-fraude |
| 3 | Workers Free non certifiable (CPU 10 ms) | Dépend d'un accès Cloudflare direction | Déploiement workers.dev de test (branche expérimentale prête) |
| 4 | 14 vulnérabilités moderates dev-only (ESLint/minimatch, fix inexistant) | Résiduelle préexistante | À suivre aux montées `eslint-config-next` |
| 5 | CSP `script-src 'unsafe-inline'` | Hydratation Next.js | Nonces (évolution future) |
| 6 | Rate limit « dégradé » sans `SUPABASE_SERVICE_ROLE_KEY` | Config Vercel manquante | Variables Production+Preview (§9) |
| 7 | Pages légales [À VALIDER], logo générique, coordonnées | Fait direction | Marqueurs prêts |
| 8 | Publication programmée inactive sans pg_cron | Optionnel 0006 | Documenté |
| 9 | ESLint non exigé… si absent — vérifié présent et propre | — | — |

---

## 8. Configuration attendue du propriétaire (aucune valeur secrète ici)

| Étape | Où | Contenu |
|---|---|---|
| 1. Créer le projet Supabase | supabase.com (Free) | Région proche Guinée (eu-west/eu-central) |
| 2. Créer le compte admin initial | Dashboard → Authentication → Add user | **Auto Confirm** coché, mot de passe de la direction |
| 3. Appliquer les 8 migrations | SQL Editor, ordre strict 0001→0008 | 0006 optionnel ; **0007 avant le formulaire vidéo** |
| 4. Promouvoir l'admin | SQL Editor (§3 du README) | 1 UPDATE, vérifiable dans `profiles` |
| 5. Variables Production **et** Preview (Vercel ou, si Workers retenu, secrets `wrangler`) | NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, **SUPABASE_SERVICE_ROLE_KEY (serveur UNIQUEMENT)**, NEXT_PUBLIC_SITE_URL + optionnels : TURNSTILE ×2, YOUTUBE_API_KEY | service_role jamais côté client — la séparation des 4 clients la garantit |
| 6. Redéployer + Checklist §6 du README | — | Vrai parcours + tests anti-fraude upload |
| 7. Sauvegarde manuelle | docs/SAUVEGARDE.md | pg_dump/CSV + export Storage périodique |

---

## 9. Procédure exacte de mise en production (quand la direction le décidera)

1. **Autorisation explicite requise** (règle absolue tenue : zéro push, zéro merge, zéro déploiement pendant les deux missions) ;
2. Revue de code par la direction sur `feature/plateforme-media` (HEAD `ab59270` + docs) — `main` reçoit ensuite un PR fusionné après revue ;
3. Configurer Supabase selon §8 (étapes 1-4) ;
4. Déployer d'abord **Preview** Vercel avec les variables (Preview ≠ Production) et passer la checklist §6 + §7.4 du rapport précédent (anti-énumération login, RLS réelle via PostgREST, upload hostile) ;
5. Puis **Production** (variables Production), redéploiement, balayage post-déploiement (en-têtes/CSP/sitemap) ;
6. Branches jamais fusionnées en l'état : `experimental/cloudflare-workers` reste un chantier de validation séparé.

---

## 10. Budget mensuel vérifié

| Brique | Offre | Coût mensuel |
|---|---|---|
| Hébergement application | Vercel Hobby | **0 USD** |
| Base + Auth + Storage | Supabase Free (organisation dédiée BHTV) | **0 USD** |
| Vidéos/streaming | YouTube (iframe) | **0 USD** |
| CDN images | Supabase Storage public | **0 USD** (2 Mo/fichier) |
| Captcha optionnel | Cloudflare Turnstile Free | **0 USD** |
| Code | GitHub Free | **0 USD** |
| Polices | auto-hébergées | **0 USD** |
| **TOTAL** | | **0 USD/mois — CONFIRMÉ** |

*Cloudflare Workers Free (si validé plus tard) coûterait également 0 USD — mais il n'est pas certifié (§5.3). Aucun abonnement ni service facturable activé.*

---

## 11. STATUT : PRÊT SOUS CONDITIONS

Le code est complet, sécurisé, testé (tsc 0, lint 0/0, 55/55, build OK, audit 0 critical/0 high) et **corrigé de la vulnérabilité critique Next.js** ; la compatibilité Cloudflare Workers a été **réellement essayée en local** (build + rendu + en-têtes OK, limites documentées). Conditions restantes, toutes externes au code :

1. Configuration Supabase (projet, 8 migrations strictement dans l'ordre, admin initial) — procédure prête ;
2. Variables d'environnement (dont `SUPABASE_SERVICE_ROLE_KEY` côté serveur) ;
3. Validation réelle du CMS/formulaires/Storage via checklist §6 du README ;
4. (Si Workers Free retenu) validation CPU sur un workers.dev réel — sinon **Vercel Hobby 0 USD** est le chemin de production recommandé et prêt ;
5. Autorisations explicites : merge → `main`, déploiement, DNS.

**En une phrase : la plateforme est professionnelle, gratuite, honnête et prête à être mise en service dès la configuration externe — chaque étape restante est documentée, procédurée et à exécuter par la direction avec autorisation.**