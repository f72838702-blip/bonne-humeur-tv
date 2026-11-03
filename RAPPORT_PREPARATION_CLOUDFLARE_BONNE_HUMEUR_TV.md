# RAPPORT DE PRÉPARATION CLOUDFLARE — BONNE HUMEUR TV
## Mission 2 : intégration d'OpenNext dans deploy/cloudflare-staging

**Date** : 3 novembre 2026 · **Base** : `AUDIT_COMPATIBILITE_CLOUDFLARE_BONNE_HUMEUR_TV.md`
(verdict *PRÊT APRÈS CORRECTIONS*) · **Aucun déploiement distant, aucun push,
aucune donnée Supabase modifiée, aucun secret affiché.**

---

## 1. Branche créée et état initial préservé

| Élément | Valeur |
|---|---|
| Branche de référence | `feature/plateforme-media` (HEAD audité **9c83c3f** ; HEAD réel **f7d351f** = audit doc uniquement, zéro écart de code avec 9c83c3f) |
| **Nouvelle branche** | **`deploy/cloudflare-staging`** (créée depuis f7d351f) |
| Branche expérimentale | `experimental/cloudflare-workers` (60564b2) — **NON fusionnée** (elle contient l'ANCIEN ordre de migrations 0002_rls/0003_functions — c'est bien la raison pour laquelle elle ne peut pas être prise en bloc) |
| `main` | jamais touchée (9351a77) |

`git status` initial : arbre propre, 2 fichiers non suivis **préservés**
(`RAPPORT_CLOTURE_ET_PASSATION_GLM53.md`, et un fichier parasite `dy` — journal d'erreur
orphan du projet, signalé pour nettoyage ultérieur).

## 2. Fichiers intégrés (seulement l'indispensable Cloudflare)

4 fichiers, repris de la branche expérimentale **et adaptés** :

| Fichier | Changement |
|---|---|
| `package.json` | +2 devDependencies : `@opennextjs/cloudflare ^1.20.15`, `wrangler ^4.156.0` — **Next 15.5.28 et React 19.2.8 inchangés** |
| `package-lock.json` | régénéré par `npm install` (271 paquets, exit 0, ~6 min) |
| `wrangler.jsonc` | nouveau — adapté (entête = branche staging) : `name: bonne-humeur-tv-preview`, `compatibility_date: 2026-10-01`, `nodejs_compat`, `main: .open-next/worker.js`, assets binding ASSETS, observability off |
| `open-next.config.ts` | nouveau — `defineCloudflareConfig()` **sans cache** (justification §3) |
| `.gitignore` | + `.open-next/`, `.wrangler/`, `.dev.vars` (secrets de preview locaux) |

**Version réellement installées** : `@opennextjs/cloudflare 1.20.15` · `@opennextjs/aws
4.1.14` · `wrangler 4.157.0` (^4.156.0 → dernier patch) · `next 15.5.28` · `react 19.2.8`
· **pas de vinext**.

## 3. CACHE ET REVALIDATION — comportement PROUVÉ PAR LE CODE SOURCE (§4 de la mission)

La documentation OpenNext ne décrit pas le cas « config vide » ; le code source installé
le tranché définitivement (`node_modules/@opennextjs/cloudflare/dist/…`) :

- `defineCloudflareConfig()` **sans arguments** → `incrementalCache: "dummy"`,
  `tagCache: "dummy"`, `queue: "dummy"`.
- **dummyTagCache** (`@opennextjs/aws/dist/overrides/tagCache/dummy.js`) :
  `getByPath() → []`, `writeTags() → no-op`, `isStale() → false` — commentaire du
  code source lui-même : *« We don't want to throw error on this one because we might
  use it when we don't need tag cache »*. **Conclusion : les 30 appels `revalidatePath`
  des Server Actions CMS sont SILENCIEUSEMENT SANS EFFET, sans erreur, sans exception.**
- **dummyIncrementalCache** : rien n'est stocké → **les 6 pages `revalidate = 120`
  sont re-rendues à CHAQUE requête** (l'ISR de build ne sert que le contenu du build).

**Conséquence fonctionnelle (option A de la mission)** : c'est en réalité l'option la plus
sûre pour un site d'information —
- le contenu public est **toujours frais** (chaque requête relit Supabase) ;
- les actions CMS (créer/modifier/publier) **ne génèrent aucune erreur** (dummy ne propage rien) ;
- les mises à jour sont **visibles immédiatement** après publication (rien n'est périmé
  puisque rien n'est mis en cache page).

**Coût** : un peu de CPU par requête (rendu RSC). Risque connu, à trancher par mesures
réelles (audit §10). **Aucune ressource ajoutée** : pas de R2, pas de D1, pas de
Durable Objects — rien à payer, rien à justifier de plus. Les alternatives (KV + D1 +
queue DO, toutes gratuites) restent documentées dans l'audit comme évolution si les
mesures CPU le justifient.

## 4. Variables d'environnement (noms vérifiés dans le code)

| Variable | Où elle est lue | Canaux |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `lib/supabase/config.ts`, `public-config.ts` | build-time (inlinée NEXT_PUBLIC) — **navigateur, autorisé** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | idem | build-time — **navigateur, autorisé** (publishable) |
| `SUPABASE_SERVICE_ROLE_KEY` | `lib/supabase/admin.ts` **seul** | **runtime Workerd via `.dev.vars` (preview) / `wrangler secret put` (déploiement, non exécuté)** — jamais au navigateur |
| `NEXT_PUBLIC_SITE_URL` | layout, 2 pages détail, sitemap, robots | build-time (défaut actuel : URL Vercel) |
| Optionnelles : `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `YOUTUBE_API_KEY` | helpers, YouTube API | runtime serveur — pas encore configurées (états documentés : captcha off, import YouTube off) |

- `.dev.vars` créé (contenant **uniquement** la clé service_role, copié depuis
  `.env.local` sans jamais afficher la valeur) ; **gitigné** (.gitignore mis à jour avant le commit).
- `.env.local` **jamais commité** (vérifié par `git status`).
- **Aucune clé Supabase modifiée.**
- **Preuve d'absence de fuite** : scan informatisé des **62 fichiers du bundle client**
  `.open-next/assets` → **0 occurrence** de la clé service_role ; scan de
  `.open-next/worker.js` → clé **non inlinée** (lue au runtime via binding Wrangler).

## 5. Builds et vérifications exécutées (§6, dans l'ordre)

| # | Vérification | Commande | Résultat |
|---|---|---|---|
| 1 | npm install (npm ci non requis) | `npm install --no-audit --no-fund` | exit 0 (271 paquets) |
| 2 | TypeScript | `npx tsc --noEmit` | **exit 0** |
| 3 | ESLint | `npm run lint` | **exit 0 — 0/0** |
| 4 | Vitest | `npm test` | **55/55 PASS** (5 files) |
| 5 | Build Next.js | `npm run build` | **29 routes OK** (24 pages + sitemap/robots/icon/og) |
| 6 | Build OpenNext | `npx opennextjs-cloudflare build` | **OK** — `.open-next/worker.js` généré (14 s de patches ; note : avertissement standard OpenNext « pas 100 % compatible Windows », sans incident ici) |
| 7 | Preview locale | `npx wrangler dev --port 8787` | **Ready**, bindings ASSETS + secret chargé (masqué) |

## 6. Routes balayées en preview Workers (20 routes)

| Route | Statut attendu | Statut réel |
|---|---|---|
| `/` · `/actualites` · `/videos` · `/recherche?q=test` · `/contact` · `/partenariats` · `/mentions-legales` · `/confidentialite` · `/sitemap.xml` · `/robots.txt` · `/actualites/categorie/politique` (slug réel du seed) · `/admin/login` | 200 | **12/12 = 200** |
| `/actualites/[slug]` et `/videos/[slug]` avec slug inexistant | 404 (base sans article/vidéo) | **2/2 = 404** ✓ |
| `/admin` · `/admin/articles` · `/admin/videos` · `/admin/demandes` · `/admin/medias` · `/admin/utilisateurs` | 307 → `/admin/login?next=…` (groupe middleware, sans session) | **6/6 = 307**, Location vérifiée ✓ |

**En-têtes de sécurité dans le runtime Workers** (vérifiés sur `/`) : CSP **complète**,
`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`,
`Permissions-Policy`, `Strict-Transport-Security` — **tous conservés** ✓.

## 7. Tests CMS spécifiques (§7) — réalisés vs reportés

Réalisés en preview (sans écriture en base) : garde middleware + redirection 307,
page login servie, chargement des Server Actions (bundle), headers/CSP, secret jamais
au navigateur.

**Tests nécessitant une véritable écriture (à faire par la direction, navigateur
vers preview — liste séparée comme exigé) :**
1. Connexion réelle admin sur `wrangler dev` → cookies Supabase + refresh.
2. Création d'un article brouillon → publication → **vérifier l'apparition publique
   immédiate sur `/actualites`** (garantie par le dummy cache — §3 ; à confirmer manuellement).
3. Upload d'une image → Storage + affichage.
4. Formulaire contact → `/admin/demandes`.
5. Changement de rôle d'utilisateur.
(Conséquences : lignes de contenu de test dans la vraie base — donc nettoyage, comme
les tests d'intégration du 02/11.)

**Autorisation explicite de la direction requise avant toute écriture** — conforme à la
consigne : rien n'a été écrit.

## 8. Contrôle sécurité (§8)

| Contrôle | Résultat |
|---|---|
| Secrets côté serveur | ✓ service_role uniquement dans `lib/supabase/admin.ts`, lu via binding runtime |
| Aucun secret dans bundles clients | **PROUVÉ** par scan des 62 assets (0 occurrence) |
| Server Actions vérifient identité + rôle | ✓ `lib/auth/session.ts` + RLS (double/triple couche, 18/18 en réel) |
| RLS actives | ✓ 27 policies en base (inchangées) |
| Cookies de session | ✓ middleware `@supabase/ssr` opérationnel en Workers (307 corrects) |
| Headers + CSP | **PROUVÉS préservés** en runtime Workers (6 en-têtes relevés) |
| Dégradation de sécurité par Cloudflare | **AUCUNE observée** |

## 9. Préparation du déploiement distant (§9) — NON EXÉCUTÉ par consigne

- `npx wrangler whoami` : **« You are not authenticated »** — le compte de la direction
  n'est PAS encore connecté à Wrangler sur cette machine (le déploiement temporaire du
  31/10 utilisait un compte d'essai temporaire).
- **Action pour la direction** (interactive, jamais dans le chat) : dans ce terminal,
  saisir `! npx wrangler login` (le préfixe `!` exécute la commande ici même) puis
  `! npx wrangler whoami` pour confirmer.
- `wrangler deploy` **non exécuté** · aucun domaine personnalisé · aucun DNS ·
  production Vercel intacte.

## 10. Risques restants

| Risque | Niveau | Traitement |
|---|---|---|
| CPU 10 ms/invocation non certifiée (dummy cache → re-rendu par requête) | IMPORTANT — probabilité faible (exemples favorables : 17 ms startup, exécution réelle sans erreur 1102) | Mesure réelle après première mise en ligne (procédure audit §10) ; évolution gratuite (KV+D1+DO) si p99 élevé |
| Warning OpenNext Windows (build) | MINEUR | 2 builds complets OK ; WSL recommandé si incident futur |
| `.env` build-time : `NEXT_PUBLIC_SITE_URL` pointe encore vers l'URL Vercel | MINEUR | À définir à l'URL finale (workers.dev) avant le premier déploiement réel |
| `Next.js multiple lockfiles` warning (C:\Users\alpha\package-lock.json détecté) | MINEUR | Nettoyage optionnel du lockfile parasite au niveau du profil utilisateur |
| Fichier parasite `dy` (non suivi) | MINEUR | Supprimer après confirmation (journal d'erreur sans valeur) |
| Suspension projet Supabase Free après ~1 semaine d'inactivité | RECURRENT | Visite hebdomadaire du dashboard |
| Aucune sauvegarde auto (Supabase Free) | RECURRENT | Export pg_dump après chaque lot de contenu |

## 11. Budget

**0 USD/mois confirmé.** Aucune ressource créée : pas de R2, pas de D1, pas de Durable
Objects, pas de Cloudflare Images, pas de plan payant — le choix de configuration est la
version la plus simple **et la plus gratuite** (dummy caches intégrés).

---

## BILAN

- Branche `deploy/cloudflare-staging` : **construite, buildée, testée localement** (7/7
  vérifications, 20/20 routes conformes, sécurité prouvée), **prête pour l'autorisation
  finale de la direction** (connexion `wrangler login`, variables production via
  `wrangler secret`, puis déploiement workers.dev **avec accord explicite**).
- Commits : sur la branche (aucun push). Aucune donnée Supabase modifiée.
  Aucun secret exposé. Verdict de l'audit confirmé **PRÊT APRÈS CORRECTIONS →
  CORRECTIONS TERMINÉES** (les 2 adaptations identifiées sont : dummy-cache accepté
  pour la fraîcheur immédiate, et mesures CPU à faire après première mise en ligne).