# AUDIT TECHNIQUE COMPLET — BONNE HUMEUR TV
## Compatibilité Next.js · Supabase · Cloudflare Workers Free

**Date** : 3 novembre 2026 · **Auditeur** : architecte logiciel senior (revue indépendante)
**Branche auditée** : `feature/plateforme-media` (HEAD 9c83c3f) — **code actuel**, intégré
à la base Supabase réelle. La branche `experimental/cloudflare-workers` n'a été lue que
pour référence (elle n'est PAS fusionnée et n'a pas servi de base à cet audit).
**Mode** : audit uniquement — **aucun fichier modifié, aucune dépendance installée,
aucun déploiement, aucune donnée distante altérée.**
**Budget contraint** : 0 USD/mois.

---

## 1. RÉSUMÉ EXÉCUTIF

| Question | Réponse |
|---|---|
| Site compatible Cloudflare Workers Free ? | **OUI, dans son état actuel, avec 2 adaptations mineures documentées** |
| Versions | Next.js 15.5.28 + React 19.2.8 — **dans la fenêtre de support officielle d'@opennextjs/cloudflare** (« latest minors of Next.js 14 and 15 » ; 15.5 est le dernier minor de Next 15) |
| Vérification la plus forte | **Un déploiement TEMPORAIRE RÉEL sur un compte Cloudflare Free a déjà été effectué** (31/10/2026, branche expérimentale) : 11 routes 200/404, Worker Startup **17 ms**, zéro erreur 1102, CSP et ISR préservés |
| Architecture déjà Workers-friendly | Toutes les images `next/image` sont **`unoptimized`** → l'optimiseur d'images Next (incompatible Workers) n'est **jamais** invoqué ; la compression d'images se fait **dans le navigateur** (canvas) ; tout le reste passe par `fetch` (Supabase REST, Auth, Storage, YouTube, Turnstile) |
| Point faible réel | L'ISR (`revalidate = 120`) et les 30 appels `revalidatePath` exigent une configuration de cache OpenNext (incremental cache + tag cache + queue) — sans elle, rien ne casse mais chaque requête re-rend la page (site toujours frais, CPU par requête plus élevé) |
| Cron | **pg_cron Supabase suffit** — publication programmée 100 % côté base, VÉRIFIÉE active sur le projet réel (`bhtv-publish-scheduled`, */5). **Aucun Cloudflare Cron Triggers nécessaire, aucun doublon créé** |
| Risque 10 ms CPU | Non certifiable sans le vrai compte Cloudflare Free de la direction (procédure documentée §10) ; tous les signaux observés (déploiement réel réussi, requêtes REST courtes, pas de traitement image serveur) sont favorables |
| Verdict | **PRÊT APRÈS CORRECTIONS** (2 adaptations mineures, 0 correction bloquante) |

## 2. ARCHITECTURE ACTUELLE DU PROJET

```
Navigateur ── Next.js 15.5 (App Router, 24 pages) ──┬── Supabase REST (RLS, clé publishable)
   │    │                                            ├── Supabase Auth (cookies @supabase/ssr)
   │    └── canvas compression WebP                  └── Server Actions ── service_role (REST/RPC,
   └── Turnstile (challenges.cloudflare.com)                                   jamais au navigateur)
```

- **Stack** : Next.js 15.5.28 · React 19.2.8 · TypeScript 5.7 · Tailwind 3.4 ·
  Zustand 5 (1 store : `store/theme.ts`) · @supabase/ssr 0.12 · @supabase/supabase-js 2.47 ·
  zod 4.6 (validation) · marked 18.1.2 (Markdown, échappé avant parse) · lucide-react.
- **4 clients Supabase séparés** : public (sans cookies, pour ISR/SSG) ·
  serveur cookie-lié (`@supabase/ssr`) · middleware · admin (`service_role`,
  serveur exclusivement, `null` si non configuré → états dégradés honnêtes).
- **Aucun Route Handler API** (`app/**/route.ts` : 0 fichier) — tout passe par
  Server Components + Server Actions.
- **Backend réel opérationnel** : 8 migrations appliquées, 11 tables, 11 fonctions,
  27 policies RLS, pg_cron actif, admin connecté, 18/18 tests d'intégration réels.

## 3. INVENTAIRE COMPLET DES FONCTIONNALITÉS (vérifiées dans le code)

### A. Site public — 12 routes, toutes réelles (aucun mock)

| Route | Contenu | Données |
|---|---|---|
| `/` | Accueil : HeroPlayer, BreakingNews (flash-infos), Articles à la une, VideosGrid, B2BCta | 5 requêtes REST anon |
| `/actualites` | Liste articles, pagination (200 max affichée/tranche), filtre | REST anon |
| `/actualites/[slug]` | Article détaillé : Markdown échappé, byline (`author_names`), image, JSON-LD | REST anon |
| `/actualites/categorie/[slug]` | Catégorie éditoriale | REST anon |
| `/videos` · `/videos/[slug]` | Vidéos YouTube (iframe nocookie), épinglage (`position`), partage | REST anon |
| `/recherche?q=` | Recherche : RPC `search_published` (titre + extrait, design validé par test T9) | RPC anon |
| `/contact` | Formulaire (action `submitContact`) : rate limit + Turnstile optionnel + honeypot | Server Action |
| `/partenariats` | Formulaire B2B (action `submitPartnership`) | Server Action |
| `/mentions-legales` · `/confidentialite` | Pages légales | statique |
| `/sitemap.xml`, `/robots.txt` | dynamiques (200 articles + 200 vidéos réels) | REST anon |

### B. CMS `/admin` — 10 routes, entièrement cablé à Supabase (aucun mock restant)

| Fonctionnalité | Implémentation réelle |
|---|---|
| Connexion | `signIn` (`lib/actions/auth.ts`) — **testée réellement** (JWT émis, direction connectée) |
| Déconnexion | `signOut` — Server Action |
| Garde UX | `middleware.ts` (redirection si pas de session) + **double vérification** session+rôle dans chaque page/action + **RLS en base** (trois couches, prouvées par tests 18/18) |
| Tableau de bord `/admin` | Compteurs réels (`lib/data/dashboard.ts`) — vérifiés à 0 avec base propre |
| Articles : créer / modifier / publier / dépublier / supprimer | `saveArticle`, `deleteArticle` (brouillon→à valider→publié→programmé, RLS admin/editor) |
| Publication programmée | statut `scheduled` + `scheduled_at` → pg_cron toutes les 5 min (VÉRIFIÉ actif sur le projet) |
| Catégories | `saveCategory`, `deleteCategory` |
| Vidéos + épinglage | `saveVideo` (import métadonnées YouTube optionnel via `YOUTUBE_API_KEY`), `deleteVideo`, champ `position` |
| Flash informations | `saveBreakingNews`, `deleteBreakingNews` |
| Demandes B2B + contact | `setRequestStatus`, pages `/admin/demandes` |
| Utilisateurs + rôles | `changeRole`, `inviteUser`, `setUserDisabled` (admin uniquement, RLS) |
| Médiathèque | `uploadMediaAction`, `deleteMediaAction` — upload **serveur uniquement** via service_role (design 0004, pas d'upload navigateur), compression **navigateur** (canvas), sniff serveur (`lib/media/sniff.ts` : signature/MIME/dimensions réelles) |
| Journal d'audit | **table + trigger VÉRIFIÉS en base** (test T15) — ⚠️ **pas d'interface de consultation** dans `/admin` (fonctionnalité ABSENTE du CMS, voir §13) |

### C. Fonctionnalités NOTAMMENT ABSENTES (état honnête)

- Consultation des `audit_logs` en UI (données produites, jamais affichées).
- Route Handlers → ni `/api/*`, ni endpoint health-check (les vérifications passent par les pages).
- Newsletter, commentaires : hors périmètre du projet.

## 4. AUDIT SUPABASE

- **Connexion** : REST PostgREST exclusivement (supabase-js = `fetch`) → ✅ compatible Workers.
- **Auth** : `@supabase/ssr` (cookies + refresh en middleware). Le rafraîchissement de
  session est fait par le middleware (pattern officiel Supabase pour serverless) —
  fonctionne en Workers (cookies de requête/réponse, pas de filesystem).
- **Clés** : `NEXT_PUBLIC_*` (publishable + URL) au navigateur — normal par design ;
  `SUPABASE_SERVICE_ROLE_KEY` lu **uniquement** dans `lib/supabase/admin.ts` (client
  instancié seulement dans des Server Actions, jamais importé par un composant client —
  vérifié par grep sur les 18 fichiers `"use client"` : aucun n'importe `admin.ts`).
  **Aucune clé privilégiée exposable côté navigateur.** (Rappel opérationnel : sur ce
  projet, les clés `sb_secret_*` sont rejetées par la plateforme → JWT legacy
  `service_role` utilisé, équivalent sémantique.)
- **RPC** : `check_rate_limit` (via service_role, fallback « degraded » documenté),
  `search_published` (anon), `publish_scheduled_articles` (service_role seulement,
  pg_cron). Paramètres nommés conformes, tests réels 18/18.
- **Rate limiting** : état en **base** (`form_submissions`) → fiable en serverless ✅.
- **Storage** : upload par Server Action + service_role (fetch multipart) → ✅
  Workers-compatible ; lecture publique CDN Supabase ✅ ; plafond 2 Mo en base.
- **Publication programmée** : 100 % pg_cron côté Supabase. **Le Worker n'intervient
  pas du tout.** Aucune tâche Node côté hébergement n'y est liée.

## 5. AUDIT NEXT.JS (fonctionnalités utilisées vs adaptateur Cloudflare)

| Mécanisme Next.js | Utilisé ? | Support OpenNext Cloudflare |
|---|---|---|
| App Router / RSC / Server Components | ✅ | ✅ supporté |
| Client Components (18 fichiers `"use client"`) | ✅ | ✅ |
| Server Actions (22 actions exportées) | ✅ | ✅ |
| Dynamic Routes / `generateStaticParams` | `[slug]`, `[id]` (aucun generateStaticParams) | ✅ |
| Middleware (Edge, `next/server`) | ✅ `/admin/:path*` | ✅ (le « Node Middleware » 15.2+ non supporté n'est PAS utilisé) |
| Cookies /Headers (`next/headers`) | ✅ (auth, rate limit, IP) | ✅ |
| ISR `export const revalidate = 120` | ✅ 6 pages | ⚠️ voir §7 : sans cache configuré, re-rendu par requête |
| `revalidatePath` | ✅ 30 appels (contenus, demandes, médias) | ⚠️ exige un Tag Cache — voir §7 |
| SSR dynamique (recherche, admin) | ✅ | ✅ |
| Streaming | implicite (App Router) | ✅ |
| Erreurs/404/redirections | middleware redirect + not-found par défaut | ✅ |
| `next/image` | **`unoptimized` partout** (7 usages vérifiés) | ✅ (l'optimiseur d'images, non supporté sur Workers, n'est jamais invoqué) |
| `sitemap.ts` / `robots.ts` / JSON-LD | ✅ | ✅ |

## 6. AUDIT OPENNEXT (@opennextjs/cloudflare)

- **Version installée** : `^1.20.15` (branche expérimentale uniquement) + `wrangler ^4.156.0`.
- **Build et déploiement** : **déjà prouvés en réel** — build OpenNext réussi, déploiement
  temporaire (31/10) sur Workers Free : `bonne-humeur-tv-preview.…workers.dev`, 11 routes
  200/404, Worker Startup 17 ms, 0 erreur 1102, headers/CSP/ISR conservés.
- **wrangler.jsonc** : `nodejs_compat` ✅ (requis) · `compatibility_date` récente ·
  `main: .open-next/worker.js` + assets binding ASSETS · observability off.
- **open-next.config.ts** : `defineCloudflareConfig()` **minimal — sans cache** :
  c'est le point d'adaptation n°1 (voir §7).

## 7. AUDIT APIs NODE.JS (usage réel vs runtime Workers)

Recherche systématique (`fs|path|crypto|stream|http|https|net|tls|child_process|worker_threads|zlib|os|dns|vm|require(...)`) sur tout `app/`, `lib/`, `components/` :

| Usage | Fichier | Verdict Workers (nodejs_compat) |
|---|---|---|
| `createHash("sha256")` (node:crypto) | `lib/actions/helpers.ts:1,47` (hachage IP rate-limit) | ✅ `createHash` implémenté par le runtime workersd |
| `headers()`/`cookies()` | actions + pages | ✅ |
| `fetch` (Supabase, YouTube en 8 s timeout, Turnstile siteverify) | `lib/supabase/*`, `lib/youtube/api.ts`, `helpers.ts:91` | ✅ natif Workers |
| `AbortSignal.timeout(8000)` | `lib/youtube/api.ts:56` | ✅ API web standard supportée |
| `ArrayBuffer/Uint8Array` (sniff images serveur) | `lib/data/media.ts`, `lib/media/sniff.ts` | ✅ Web APIs |
| Canvas compression | `lib/media/compress.ts` — **côté navigateur uniquement** | ✅ sans objet côté serveur |
| `sharp` | présent dans node_modules **uniquement comme dépendance optionnelle de next lui-même** ; jamais importé par le projet ; optimiseur jamais invoqué (`unoptimized` partout) | ✅ non concerné |
| `process.env` | 18 variables, toutes lues côté serveur ou NEXT_PUBLIC | ✅ |
| fs / path / http / http / stream / net / tls / child_process / worker_threads | **0 usage** | ✅ |

Conclusion : **le code serveur du projet est 100 % fetch + Web APIs + un seul import
node:crypto supporté.** C'est précisément why il tourne déjà sur le runtime réel.

## 8. AUDIT IMAGES ET STOCKAGE

| Opération | Où | Compatibilité |
|---|---|---|
| Compression WebP/JPEG, redimensionnement, suppression EXIF | **navigateur** (canvas, `lib/media/compress.ts`) | ✅ indépendant de l'hébergeur |
| Validation serveur (signature/MIME/dimensions/poids) | `lib/media/sniff.ts` (octets purs) | ✅ |
| Upload → Supabase Storage | Server Action + service_role (fetch) | ✅ |
| Lecture publique | CDN Supabase (`*.supabase.co` autorisé par la CSP) | ✅ |
| Optimiseur Next (`/_next/image`) | **jamais utilisé** (7x `unoptimized`) | ✅ le seul point incompatible Workers n'est jamais déclenché |
| **R2** | **NON requis** — Supabase Storage reste l'architecte des médias. Ne pas migrer vers R2 : rien n'exige un changement | — |

## 9. AUDIT CLOUDFLARE WORKERS FREE (limites officielles vérifiées)

| Limite (plan Free) | Valeur | Situation du projet |
|---|---|---|
| Requêtes | **100 000/jour** (reset minuit UTC, erreur 1027 au-delà) | Largement suffisant au lancement (presse guinéenne locale) |
| **CPU par requête et par Cron** | **10 ms** | ⚠️ non certifiable à distance — un déploiement temporaire RÉEL a tourné sans erreur 1102 (11 routes) ; certification exige le vrai compte (§10) |
| Wall time (durée réponse) | illimité tant que le client est connecté | ✅ |
| Mémoire | 128 Mo/isolate | ✅ (rendus légers, pas de traitement image serveur) |
| Startup | 1 s | ✅ **17 ms mesurés en réel** |
| Sous-requêtes/invocation | **50** | Page la plus riche ≈ 5–7 fetch REST (accueil) + fetches du RSC → marge confortable ; sitemap : 2 fetches batch ✅ |
| Taille Worker | 3 MiB compressé (Free) | ✅ **déployé en réel** sans refus de taille |
| Cron Triggers | 5 max / compte | ✅ **0 nécessaire** (pg_cron suffit) |
| Connexions simultanées | 6/requête | ✅ fetchs séquentiels/groupés du projet |

**Distinction temps CPU vs temps réseau** : le temps d'attente Supabase/YouTube/Turnstile
n'est PAS du CPU facturable. Le CPU consommé = parsing JSON + rendu RSC. Une page
d'actualité rendue = exécution JSX + lecture d'un JSON léger → typiquement quelques ms ;
**mais aucune valeur précise ne sera jamais avancée sans mesure réelle** (interdiction
d'inventer des métriques, respectée).

## 10. PROCÉDURE DE CERTIFICATION CPU (à exécuter par le propriétaire, compte Free réel)

1. Déployer (`wrangler deploy` — autorisation requise) puis naviguer sur les 7 routes critiques.
2. Dashboard → Workers → métriques par Worker : **CPU Time par invocation (p50/p99)** —
   jamais « Worker Startup Time ».
3. `wrangler tail --format=pretty | grep -i cpu` pendant la navigation (recherche,
   admin, publication d'un article).
4. Si p99 > 30–40 % de 10 ms sur une page → ajouter les caches (§12 plan d'action).

## 11. MATRICE DE COMPATIBILITÉ

| Fonctionnalité | Fichier / Route | Backend | Compatibilité Cloudflare | Adaptation nécessaire | Priorité |
|---|---|---|---|---|---|
| Pages publiques statiques (`/`, listes, légales) | `app/page.tsx`, `app/actualites`, `app/videos`, légales | REST anon, ISR 120 | **COMPATIBLE** (déployé en réel, 200) | — | — |
| Article détaillé `[slug]` | `app/actualites/[slug]/page.tsx` | REST anon | **COMPATIBLE** | — | — |
| Catégorie `[slug]` | `app/actualites/categorie/[slug]` | REST anon | **COMPATIBLE** | — | — |
| Recherche | `app/recherche` → RPC `search_published` | RPC anon | **COMPATIBLE** | — | — |
| Flash-infos / à la une / épinglés | `BreakingNews.tsx`, `HeroPlayer.tsx`, `videos.position` | REST anon | **COMPATIBLE** | — | — |
| Lecteur YouTube (+ nocookie + JSON-LD) | `HeroPlayer.tsx`, `VideoCard.tsx` | iframe CDN | **COMPATIBLE** | — | — |
| Contact / Partenariat | `submitContact`, `submitPartnership` | Server Action + rate limit en base + Turnstile optionnel | **COMPATIBLE** | — | — |
| SEO (metadata, OG, sitemap, robots, JSON-LD, canonical) | `app/layout.tsx`, `sitemap.ts`, `robots.ts`, `JsonLd.tsx` | REST anon | **COMPATIBLE** | — | — |
| Middleware garde `/admin` | `middleware.ts` | @supabase/ssr cookies | **COMPATIBLE** | — | — |
| Connexion/Déconnexion admin | `signIn`, `signOut` | Supabase Auth | **COMPATIBLE** (réel 18/18) | — | — |
| Tableau de bord + compteurs | `/admin`, `dashboard.ts` | REST authenticated | **COMPATIBLE** | — | — |
| CRUD articles (draft/published/scheduled) | `content.ts:saveArticle/deleteArticle` | REST + RLS + revalidatePath | **COMPATIBLE AVEC ADAPTATION** | tag cache OU accepter fraîcheur par ISR-naturel (§7) | IMPORTANTE |
| Publication programmée | pg_cron `*/5` côté Supabase | base | **COMPATIBLE** (aucune intervention Worker) | aucune | — |
| Catégories / Vidéos / Flash-infos / Demandes / Utilisateurs | `content.ts`, `admin.ts` | REST + RLS | **COMPATIBLE AVEC ADAPTATION** | idem `revalidatePath` | IMPORTANTE |
| Upload médias | `uploadMediaAction` (+sniff) | Storage via service_role (fetch) | **COMPATIBLE** (design navigateur-compressé) | — | — |
| Hachage IP rate limit | `createHash` (node:crypto) | — | **COMPATIBLE** (nodejs_compat) | vérifier au build | MINEURE |
| Cache 1 h YouTube en mémoire | `lib/youtube/api.ts` | Map en isolat | **COMPATIBLE** (efficacité réduite : isolat éphémère) | aucune | MINEURE |
| ISR 120 s sans incremental cache | 6 pages | — | **COMPATIBLE AVEC ADAPTATION** | chaque requête re-rend : ajout des caches OpenNext (KV/D1/DO — gratuits) sinon | IMPORTANTE |
| Optimiseur d'images Next | — | — | **COMPATIBLE** (non utilisé : `unoptimized` ×7) | — | — |
| sharp | node_modules (dep optionnelle de next) | — | **COMPATIBLE** (jamais importé) | — | — |
| Route Handlers API | — | — | — | — | NON VÉRIFIÉ car inexistant |

## 12. PROBLÈMES IDENTIFIÉS & CORRECTIONS NÉCESSAIRES

### CRITIQUE — aucun

### IMPORTANT
1. **`revalidatePath` sans Tag Cache** — `lib/actions/content.ts` (30 appels). Origine :
   config OpenNext minimale. Conséquence : après une publication CMS, la page publique
   n'est mise à jour que par l'expiration naturelle (re-rendu systématique sans cache ;
   si on active un incremental cache SANS tag cache, la page resterait périmée — pire).
   Solution recommandée : **n'activer l'incremental cache qu'ensemble avec le tag cache**
   (`d1NextTagCache` — D1 Gratuit) ou, plus simple et déjà prouvé, **rester sans cache**
   (tout re-rend chaque requête : site toujours frais, correct pour un site d'info à
   faible trafic) jusqu'à mesure CPU. Coût : 0 USD. Non bloquant pour un déploiement.
2. **ISR sans cache = re-rendu chaque requête** — 6 pages `revalidate=120`. Origine :
   même config. Conséquence : CPU par requête un peu plus élevé qu'avec cache (les
   limites Free ne sont pas consommées pendant les attentes réseau) ; contenu toujours
   frais. Solution : selon mesures CPU réelles — ajouter incremental cache (Workers KV,
   gratuit) + queue (Durable Objects, tier gratuit) UNIQUEMENT si la CPU mesurée s'en
   rapproche. Coût : 0 USD (KV 100 k lectures/1000 écritures/jour gratuits, DO tier
   gratuit).

### MINEUR
3. `node_modules` contient **`miniflare` (extraneous)** et les paquets de la branche
   expérimentale (résidu d'installation) — aucune incidence runtime ; nettoyer à la
   prochaine installation propre.
4. Cache mémoire YouTube non partagé en serverless (isolate éphémère) — comportement
   dégradé documenté dans le code ; aucune action.
5. `/sitemap.xml` rendu dynamique à chaque requête → 2 fetches ; acceptable, cache CDN
   possible plus tard.

### Rappels permanents (hors périmètre code)
- Projet Supabase Free suspendu après ~1 semaine d'inactivité (visite hebdomadaire).
- **Zéro sauvegarde automatique** en Free → export manuel après chaque lot de contenu.

## 13. ESTIMATION DES COÛTS

| Poste | Coût | Note |
|---|---|---|
| Hébergement Cloudflare Workers | **0 USD/mois** | plan Free (100 k req/j) |
| Supabase | **0 USD/mois** | plan Free actuel |
| Supabase Storage | 0 (1 Go inclus) | bucket media, plafond 2 Mo/fichier |
| Caches optionnels OpenNext (KV/D1/DO) | **0 USD/mois** | tiers gratuits existants (si activés un jour) |
| Domaine (optionnel) | ~0,10 USD/mois si acheté / peut resté en `workers.dev` gratuit | seule dépense possible, et elle est optionnelle |
| Cloudflare Images | **NON requis** | ne pas acheter |
| **Total obligatoire** | **0 USD/mois** | ✅ respecté |

## 14. ARCHITECTURE RECOMMANDÉE

```
Domaine (ouworkers.dev) → Cloudflare Workers Free (OpenNext, nodejs_compat, config minimale)
  ├── Pages publiques : re-rendu par requête (config minimale) — contenu toujours frais
  ├── CMS + Server Actions : inchangés (auth cookies + RLS + service_role serveur)
  ├── Médias : compression navigateur → Supabase Storage (inchangé, PAS de R2)
  ├── Publication programmée : pg_cron Supabase (SEULE source de vérité, pas de Cron Cloudflare)
  └── Phase 2 (si CPU mesurée critique) : + incremental cache KV + tag cache D1 + queue DO (0 USD)
```

Alternative écartée par les faits : ni Netlify Free (300 crédits ≈ 15 Go/mois, hard cap)
ni Vercel Hobby (interdit commercialement) — Workers Free reste le meilleur des plans
gratuits pour ce site, **et le déploiement temporaire réel l'a déjà prouvé**.

## 15. VERDICT FINAL (12 questions obligatoires)

1. **Site complet compatible Workers Free ?** OUI — déployé déjà partiellement en réel (11 routes 200).
2. **Fonctionnalités publiques fonctionnelles ?** OUI, toutes (12 routes vérifiées).
3. **CMS intégral ?** OUI (auth, tous les CRUD, médias, utilisateurs) — sauf consultation UI des audit_logs (absente, §3C : écart fonctionnel, pas un écart Workers).
4. **Supabase Auth sur Workers ?** OUI (cookies middleware + actions — pattern officiel ; prouvé réel).
5. **Server Actions ?** OUI (22 actions, supportées et déjà déployées en temporaire).
6. **Images ?** OUI — compression navigateur + Storage ; l'optimiseur incompatible n'est jamais invoqué.
7. **Cron Supabase sans Worker ?** OUI — pg_cron complet, aucune dépendance à l'hébergeur, aucun doublon.
8. **Risque > 10 ms CPU ?** Faible mais **non certifiable sans le vrai compte** — procédure §10 ; aucun signe d'échec en déploiement réel.
9. **Adaptations requises ?** 2 mineures : stratégie `revalidatePath`/tag cache, et éventuellement caches OpenNext (décision → mesures CPU). 0 adaptation coûteuse.
10. **Fonctionnalités impossibles sur Workers Free ?** AUCUNE fonctionnalité utilisée. Seuls l'optimiseur d'images Next (non utilisé) et les caches éventuels nécessitent des composants gratuits ajoutés.
11. **Sans abonnement ?** OUI — 0 USD/mois tout compris.
12. **Architecture recommandée ?** §14 — Workers Free + OpenNext config minimale, Supabase tout-fait, phase 2 caches conditionnelle.

### **VERDICT GLOBAL : PRÊT APRÈS CORRECTIONS**
*(2 adaptations mineures non bloquantes, aucune correction de code urgente ; justification :
code 100 % fetch/Web-APIs vérifié ligne par ligne + OpenNext 1.20 compatible Next 15.5 +
déploiement temporaire réel déjà réussi sur un compte Free + backend Supabase réel 18/18.
Les deux adaptations touchent la fraîcheur de cache, pas le fonctionnement.)*

## 16. PLAN D'ACTION ORDONNÉ AVANT DÉPLOIEMENT

1. **(direction)** Autoriser le déploiement de `experimental/cloudflare-workers` → merge
   de la config wrangler/OpenNext dans `feature/plateforme-media` (autorisation explicite requise).
2. **(code, 1 h)** Mettre à jour `.env` cible : `NEXT_PUBLIC_SITE_URL` + variables Supabase
   déjà en `.env.local` ; **jamais** la clé service_role côté navigateur (déjà respecté).
3. **(build local)** `npm run build` + `npx opennextjs-cloudflare build` + `wrangler dev` —
   vérifier les 24 routes + login admin + publication d'un article en preview.
4. **(déploiement temporaire)** `wrangler deploy` sur le sous-domaine `workers.dev` —
   vérifier 8 routes critiques + CMS connecté depuis le sous-domaine.
5. **(certification CPU, propriétaire)** procédure §10 — p50/p99 CPU time par route.
6. **(décision caches)** si p99 > ~30 % de 10 ms → activer KV+D1+DO (0 USD) ; sinon rester minimal.
7. **(domaine, optionnel, autorisation requise)** : configurer DNS + `Cache Purge` (zone).
8. **(récurrence)** visite hebdomadaire Dashboard Supabase (suspension) + export pg_dump périodique.

---

*L'audit n'a modifié, installé, déployé ou fusionné **rien**. Les seuls artefacts créés
sont ce document et son commit associé.*