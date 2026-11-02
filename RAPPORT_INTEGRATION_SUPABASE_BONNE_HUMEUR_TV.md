# RAPPORT D'INTÉGRATION RÉELLE SUPABASE — BONNE HUMEUR TV

**Date** : 2 novembre 2026
**Projet** : Bonne Humeur TV — La Télé de la nouvelle génération (Conakry, Guinée)
**Branche** : `feature/plateforme-media` · **Dossier** : `bonne-humeur-tv`
**Budget** : 0 USD/mois respecté — Supabase plan Free uniquement, aucun abonnement, aucun déploiement de production.

---

## 1. Contexte et périmètre

À la suite du verdict « PRÊT POUR CONFIGURATION EXTERNE » (rapport du 31/10/2026), la
direction a créé le compte et le projet Supabase Free **dédiés à Bonne Humeur TV**
(compte Google distinct : `bonnehumeur877@gmail.com`, ≠ compte des autres projets).
La mission demandée : intégration réelle du backend — liaison CLI, application des
migrations, vérification complète, configuration des clés, création du premier
administrateur et préparation des tests du CMS — **sans dépasser 0 USD et sans
déploiement de production**.

## 2. Projet Supabase créé par la direction

| Élément | Valeur |
|---|---|
| Compte | `bonnehumeur877@gmail.com` (compte dédié, vérifié par la liste des projets de l'API Management) |
| Référence projet | `beinalmwqkxbqitvuobr` |
| URL | `https://beinalmwqkxbqitvuobr.supabase.co` |
| Plan | **Free** (budget 0 USD) |
| Dashboard | https://supabase.com/dashboard/project/beinalmwqkxbqitvuobr |

Vérification effectuée que la liste des projets du compte ne contient que ce projet
(aucun mélange avec les projets d'autres comptes).

## 3. Liaison CLI et application des migrations

**Outil** : Supabase CLI 3.0.0 via `npx supabase`.

1. `npx supabase init` — création de `supabase/config.toml` (commité, c81e460) et
   de `supabase/.gitignore`.
2. `npx supabase login` — authentification par jeton d'accès personnel (généré par
   la direction ; stocké dans `~/.supabase/access-token`, jamais dans Git).
3. `npx supabase link --project-ref beinalmwqkxbqitvuobr` — référence vérifiée **identique**.
4. `npx supabase migration list --remote` — base **vierge** confirmée (0 migration appliquée).
5. `npx supabase db push --remote --yes` — **feu vert explicite donné par la direction**
   avant toute écriture : **8/8 migrations appliquées, zéro erreur**, `applied_at` cohérent
   et `migration list` = **local = remote (8/8)**.

| # | Fichier | Contenu |
|---|---|---|
| 0001 | schema.sql | 11 tables (profiles, categories, tags, articles, article_tags, videos, breaking_news, partnership_requests, contact_messages, form_submissions, audit_logs) |
| 0002 | functions.sql | Fonctions rôles, trigger création profil, audit, check_rate_limit, search_published |
| 0003 | rls.sql | RLS intégrale, 27 policies |
| 0004 | storage.sql | Bucket `media` (public en lecture, images uniquement, upload serveur uniquement) |
| 0005 | seed_categories.sql | 11 catégories éditoriales |
| 0006 | scheduled_publish.sql | Publication programmée + job pg_cron `bhtv-publish-scheduled` (*/5 * * * *) |
| 0007 | video_position.sql | Colonne `videos.position` (épinglage accueil) |
| 0008 | media_folders.sql | Plafond bucket 2 Mo + restriction lecture aux 5 dossiers logiques |

## 4. Vérification complète de la base (API Management, SQL réel)

Exécution de requêtes SQL via le point d'entrée officiel de l'API Management
`POST /v1/projects/{ref}/database/query` (superuser). Résultats :

- **11 tables** publiques présentes et RLS activée sur chacune.
- **11 fonctions** : `has_role`, `is_admin_or_editor`, `handle_new_user`, trigger audit,
  `check_rate_limit(p_form_type, p_identifier, p_max_requests, p_window_seconds)`,
  `search_published(p_query)`, `publish_scheduled_articles()`, etc.
- **27 policies RLS** relevées par `pg_policies`.
- **Bucket `media`** : public en lecture, plafond **2 Mo** (0008), lecture restreinte aux
  5 dossiers logiques (`articles/`, `categories/`, `thumbnails/`, `reporters/`, `branding/`).
- **Vue `author_names`** (bylines) présenta ; seed **11 catégories** confirmé.
- **Colonne `videos.position`** présente.
- **Job cron `bhtv-publish-scheduled` (`*/5 * * * *`) ACTIF** — pg_cron fonctionne
  *d'emblée* sur ce projet Free sans aucun toggle manuel : la publication programmée
  est donc **opérationnelle dès le premier jour** (point longtemps incertain, tranché par
  la réalité).
- **Grants exacts** : `search_published` exécutable par anon+authenticated ;
  `check_rate_limit` et `publish_scheduled_articles` réservés à postgres/service_role
  (le public ne peut ni contourner le rate limiting ni déclencher la publication).

## 5. Clés API et variables d'environnement

Clés lues par moi via `GET /v1/projects/{ref}/api-keys` et écrites **directement dans
`.env.local`** (le PDG avait demandé que je le fasse à sa place). **Aucune clé n'a jamais
été affichée dans l'interface ou commitée.**

| Variable | Clé utilisée | Rôle |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet | — |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Publishable** (`sb_publishable_…`) | navigateur, autorisé par design |
| `SUPABASE_SERVICE_ROLE_KEY` | **JWT legacy `service_role`** | serveur uniquement |

**Constat important (quirk plateforme)** : les **nouvelles clés `sb_secret_*` de ce projet
sont rejetées partout** (« Invalid API key » 401, y compris sur les endpoints où elles
devraient fonctionner). Le JWT legacy `service_role` (équivalent sémantique exact) est
donc utilisé à sa place, conformément à la table de correspondance fournie par Supabase.
À re-tester plus tard : le rejet pourrait disparaître quand la plateforme fiabilisera
les nouvelles clés.

- La clé Secret / service_role : **jamais dans le navigateur, jamais dans Git**
  (`.env.local` et `~/.supabase` couverts par les `.gitignore`).
- Le code du projet utilise les noms d'environnement ci-dessus (vérifié dans
  `lib/supabase/config.ts`, `public-config.ts`, `admin.ts`).

## 6. Premier administrateur

1. **Créé par la direction** : Dashboard → Authentication → Users → Add user
   (Auto Confirm) — UID `ea6b8811-3ebe-4acc-b24c-eda1dff03aae`.
2. **Promu `admin`** : `UPDATE profiles SET role='admin'` exécuté ; le trigger
   `handle_new_user` avait créé le profil en `reporter`, comme prévu (nul ne peut
   s'auto-promouvoir).
3. **`full_name` corrompu par le transport** (« Ibrahima Sory Tour**é** » mojibake) :
   corrigé via SQL `chr(233)`, **vérifié octet par octet**
   (`encode(convert_to(full_name,'UTF8'),'hex')` → `…c3a9` = é UTF-8 correct).
4. Rôle final vérifié : **admin**, e-mail confirmé.

### Incident de connexion (résolu)

À la première tentative de connexion sur `/admin/login`, les identifiants de la
direction ne fonctionnaient pas. Diagnostic via l'API : le compte existait, confirmé,
admin, **mais `last_sign_in_at = null`** — aucune connexion n'avait jamais réussi, et
le mot de passe créé au Dashboard semblait perdu. **Résolution** : à la demande
explicite de la direction, le mot de passe a été redéfini via l'API admin
(`PUT /auth/v1/admin/users/{id}`, jeton service_role) avec la valeur **choisie par la
direction elle-même**, puis **vérifié par une connexion réelle** (HTTP 200, JWT émis,
profil admin confirmé). Le script temporaire contenant le mot de passe a été **supprimé
immédiatement** après usage. La direction est depuis **connectée au CMS**.

## 7. Tests d'intégration réels — 18/18 PASS

Script `bhtv-integration-test.mjs` (hors dépôt, `pg-ctrl-test/`) : crée un compte de
test éphémère, exécute les scénarios contre le projet réel, puis **supprime tout**.

| Test | Preuve |
|---|---|
| T1 | Compte de test créé + auto-confirmé (API auth admin) |
| T2 | Promotion `admin` (profiles.role via service_role, relecture) |
| T3 | Login réel → JWT émis |
| T4 | Un membre du staff insère un brouillon (RLS authenticated) |
| T5 | Le public **ne voit pas** le brouillon (0 ligne pour anon) |
| T6 | Publication par le staff → **visible du public** (1 ligne) |
| T7 | anon ne lit **rien** des profils (RLS) |
| T7b | Vue `author_names` lisible publiquement (bylines) |
| T8a/T8b | anon **envoie** au contact mais ne peut **rien lire** |
| T9 | `search_published` (RPC anonyme) retourne l'article publié |
| T10 | Rate limiting réel : 3ᵉ appel consécutif refusé (`true,true,false`) |
| T11 | `check_rate_limit` **masqué** à anon (401/403/404) |
| T12 | Upload WebP < 2 Mo via le chemin de production (Server Action + service_role — pas d'upload navigateur, **design 0004**) |
| T12b | Lecture publique de l'image uploadée (200, image/webp) |
| T13 | anon **ne peut pas** écrire dans le Storage |
| T14 | `publish_scheduled_articles` exécutable → article visible |
| T15 | `audit_logs` rempli par le trigger au moindre update |
| Cleanup | Base remise dans l'état initial (article, objet storage, utilisateur de test supprimés) |

Les pièges documentés pendant ces tests (utile pour le futur) : les objets publics du
Storage sont **mis en cache CDN** (un GET reste 200 après suppression pendant la durée
du cache — patienter ~2 s entre une suppression et un re-téléversement, sinon
409 `KeyAlreadyExists`) ; les paramètres RPC doivent correspondre **exactement** aux
signatures (`p_query`, `p_max_requests`, `p_window_seconds`) ; PATCH PostgREST renvoie
204 vide sauf `Prefer: return=representation`.

## 8. État final de la base (après nettoyage)

- 0 article, 0 vidéo, 0 message, 0 demande, 0 ligne d'audit.
- **1 profil** : l'administrateur (Ibrahima Sory Touré, admin).
- 11 catégories éditoriales (seed structurel).
- 11 tables, 11 fonctions, 27 policies, job pg_cron actif.
- **Aucune donnée de test résiduelle.**

## 9. Vérifications d'environnement local

- Serveur de développement Next.js démarré et vérifié : `/`, `/admin/login`,
  `/actualites`, `/sitemap.xml` répondent 200.
- **Connexion réelle de la direction au CMS `/admin/login` : RÉUSSIE.**

## 10. Ce qui reste (nécessite l'action ou l'autorisation de la direction)

| Point | État |
|---|---|
| Tests CMS par le navigateur (compteurs, article → publication → `/actualites`, contact → `/admin/demandes`, rate limiting, vidéo, upload image, publication programmée H+5) | **en cours** — la direction est connectée |
| Hébergement (Cloudflare Workers Free recommandé ; Netlify Free en repli ; Vercel Hobby non conforme commercialement) | **non autorisé pour l'instant** |
| Nom de domaine / DNS | **non autorisé pour l'instant** |
| Push GitHub & fusion des branches | **non autorisé pour l'instant** (tout est local) |
| Sauvegardes (Free = zéro backup automatique) | checklist §7 `docs/SAUVEGARDE.md` après chaque lot de contenu |
| Suspension projet Free après ~1 semaine d'inactivité | prévoir une visite hebdomadaire du Dashboard (1 clic de réactivation) |
| Clés `sb_secret_*` rejetées | re-tester plus tard ; basculer si la plateforme les fiabilise |

## 11. Traceabilité

- Commits de la session d'intégration : **c81e460** (`supabase init` config + .gitignore),
  **ce commit** (mise à jour de `supabase/README-CONFIGURATION.md` : §6 enrichi des
  vérifications pg_cron et noms de variables corrigés, + ce rapport).
- Aucun push GitHub. Aucun élément secret dans le dépôt (`.env.local` non listé par
  Git, vérifié par `git status`).
- Scripts d'intégration (hors dépôt, dans `pg-ctrl-test/`) : `bhtv-integration-test.mjs`
  (tests 18/18 + mode `cleanup`), `bhtv-fix-service-key.ps1` (identification du JWT
  service_role par décodage des rôles).

---

**Verdict d'intégration : SUCCÈS COMPLET.** Le backend Bonne Humeur TV est réellement
opérationnel sur Supabase Free : migrations appliquées et vérifiées en base réelle,
sécurité RLS prouvée par tests de bout en bout, publication programmée automatisée,
administrateur connecté au CMS. Le projet entre dans sa phase de vérification
fonctionnelle par la direction.