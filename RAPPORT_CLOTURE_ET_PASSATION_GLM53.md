# RAPPORT DE CLÔTURE ET PASSATION TECHNIQUE — BONNE HUMEUR TV

**Date :** 31 octobre 2026
**Projet :** Transformation de Bonne Humeur TV en plateforme Web TV et d'information
**Dossier local :** `C:\Users\alpha\bonne-humeur-tv`
**Branche :** `feature/plateforme-media` (créée depuis `main`)
**Production actuelle :** https://bonne-humeur-tv.vercel.app (NON modifiée pendant toute la mission)
**Destinataire :** GLM 5.3 Flash (reprise du développement)
**Rédigé par :** Claude Code (fin de mission)

---

## 1. HISTORIQUE ET TRAVAUX RÉALISÉS

### 1.1 État initial du dépôt (avant la mission master)

Le site existait en trois commits fondateurs (`5c10acc` plateforme Next 15, `3c05d04` contact WhatsApp, `9351a77` design polices/OG/animations). C'était une **vitrine entièrement fictive** :

- 8 vidéos « mock » identiques (film libre *Big Buck Bunny*, Blender Foundation) présentées comme des émissions réelles de la chaîne ;
- badge « En direct », compteurs de vues, flash-infos : **tous inventés** ;
- formulaires en **mode démo** : le bundle déployé contenait `NEXT_PUBLIC_SUPABASE_URL` non résolue — aucune donnée réellement enregistrée ;
- aucune architecture éditoriale (ni articles, ni CMS, ni rôles) ;
- 6 vulnérabilités npm (dont Next.js critique et Zod high GHSA-mrhx-c7xc-m3w5), aucun en-tête de sécurité, aucun test, aucun ESLint, aucun sitemap/robots, lien plaquette PDF mort, bug FOUC du thème.

### 1.2 MISSION MASTER (4 commits) — finalisation et transformation

**Commit `6d95898` — feat(backend), 47 fichiers :**
- 6 migrations SQL (`0001_schema` à `0006_scheduled_publish`) : 11 tables, RLS intégrale, fonctions PostgreSQL, Storage, seed 11 catégories, publication programmée pg_cron optionnelle ;
- Séparation stricte des clients Supabase (4 clients, voir §4) ;
- Server Actions sécurisées (`lib/actions/` : public-forms, auth, content, admin, helpers) avec garde `requireRole()` serveur + RLS en dernier ressort ;
- Rate limiting **en base** (`check_rate_limit`, table `form_submissions` — fiable en serverless, PAS un limiter mémoire locale) ;
- Anti-spam : honeypot + Turnstile optionnel + Zod 4 serveur (unique source de vérité) ;
- Markdown sûr (`lib/content/markdown.ts`) : échappement HTML intégral AVANT `marked.parse` (4 tests d'injection XSS) ;
- Middleware Edge-safe (`public-config.ts` séparé — aucun secret côté client/Edge) ;
- Tooling : ESLint 9 flat config, Vitest, CI GitHub Actions, `.env.example`, README-CONFIGURATION, docs SAUVEGARDE/DEPLOIEMENT.

**Commit `ff80c4e` — feat(cms), 27 fichiers :** back-office `/admin` complet — login, dashboard (compteurs réels), articles ×3 (workflow draft→review→scheduled→published→archived), vidéos ×3, flash-infos, demandes B2B/contact, utilisateurs & rôles, catégories, médiathèque ; 14 composants `components/admin/**`.

**Commit `c3b993f` — feat(public), 33 fichiers :** portail réel — accueil ISR (revalidate 120, client cookieless), `/actualites` (pagination, catégories, fiches Markdown sûres), `/videos`, `/recherche` (RPC `search_published`), pages légales (marqueurs [À VALIDER]), sitemap, robots, JSON-LD, formulaires réécrits `useActionState`, suppression intégrale des mocks (dont `lib/videos.ts`).

**Commit `b3600c5` — docs :** rapport final `RAPPORT_FINAL_TRANSFORMATION_BONNE_HUMEUR_TV.md` (12 sections, états honnêtes).

### 1.3 DIRECTIVE TECHNIQUE « Optimisation vidéo, images et bande passante » (2 commits)

**Commit `c4bca82` — feat(directive), 29 fichiers :**
- **YouTube UNIQUEMENT** : `lib/youtube/url.ts` (`extractYouTubeId` strict — watch / youtu.be / embed / live / shorts / v= + ID brut 11 car., liste blanche de domaines YouTube, refus de toute URL externe) ; `lib/youtube/api.ts` (Data API v3 **serveur uniquement**, clé `YOUTUBE_API_KEY` jamais exposée, cache TTL 1 h, timeout 8 s, jamais d'exception) ; action `lib/actions/youtube.ts` (`importYouTubeMeta`, editor+) ;
- `saveVideo` revalide la source serveur ; `videoSchema` (Zod) : `youtube_id` 11 car. exacts si fourni + `youtube_url` + `position` 0-999 ;
- **VideoForm réécrit** : collage d'URL, extraction/aperçu client, bouton « Importer les métadonnées YouTube » (message honnête si clé absente), affichage du **statut de direct réel** (live/upcoming/none) ;
- **Position sur l'accueil** : colonne `videos.position` (migration `0007_video_position.sql`, index partiel), tri épinglées d'abord puis chronologique (fenêtre limit ×2, max 48) ;
- **Pipeline images** : dossiers logiques Storage (`articles/`, `categories/`, `thumbnails/`, `reporters/`, `branding/`) ; compression navigateur (`lib/media/compress.ts` : canvas, ratio préservé, WebP avec repli JPEG, EXIF/GPS supprimés par ré-encodage, cibles 1920/800/480/400 px et 100-500 Ko, seconde passe qualité, GIF animés préservés sans ré-encodage) ; validation serveur (`lib/media/sniff.ts` : signature binaire JPEG/PNG/GIF/WebP + dimensions réelles, refus SVG/exécutables, fail-closed) ; variantes (`lib/media/variants.ts` : full/card/thumb/avatar, plafonds serveur par variante, `mediaVariantUrl`) ; MediaUploader réécrit (choix du dossier, compression avant envoi, aperçu des poids) ;
- Migration `0008_media_folders.sql` : plafond bucket 2 Mo + lecture publique Storage restreinte aux 5 dossiers logiques ;
- Affichage : `unoptimized` partout côté public (variantes déjà compressées, pas de réoptimisation Vercel par requête), `priority` uniquement image principale, `loading="lazy"` explicite ailleurs, alt descriptifs, vignettes YouTube mqdefault (320 px) pour les cartes, lien de repli honnête « La vidéo ne se charge pas ? Regardez-la sur YouTube » sur HeroPlayer.

**Commit `229376b` — docs :** rapport final enrichi (section 13 : checklist directive **11/11 conformes dans le code**).

### 1.4 Optimisations et SEO (mission master + directive)

- ISR 120 s sur toutes les pages publiques (client Supabase cookieless → cache possible) ;
- Zéro octet vidéo chargé avant clic (click-to-load), polices auto-hébergées `next/font` (aucune requête Google Fonts au runtime), aucun script tiers (hors Turnstile optionnel) ;
- FOUC thème corrigé (script inline avant hydratation, clé `bhtv-theme` Zustand) ;
- SEO : sitemap.ts, robots.ts, canonical, JSON-LD Organization/NewsArticle/VideoObject (uniquement sur données réelles), opengraph-image.

### 1.5 Cloudflare (dans le périmètre de la mission)

Seul usage Cloudflare : **Turnstile** (captcha optionnel des formulaires, `verifyTurnstile` → ok/invalid/inactive). Les clés ne sont **pas fournies** → protection documentée comme inactive (honeypot + rate limit base restent actifs). Aucun autre service Cloudflare n'est utilisé. Voir §6 pour Workers Free.

---

## 2. ÉTAT ACTUEL DU CODE

- **Branche actuelle :** `feature/plateforme-media` (créée depuis `main` ; `main` n'a jamais été touchée) ;
- **Dernier commit (HEAD) :** `229376b` — docs(rapport) : conformité directive, section 13, migrations 0007/0008, YOUTUBE_API_KEY, tests 55/55 ;
- **État Git :** arbre de travail **propre** au moment de la rédaction ; le présent fichier (`RAPPORT_CLOTURE_ET_PASSATION_GLM53.md`) est créé **non commité** (consigne de la mission de passation), il apparaîtra donc en `??` non suivi ;
- **`git push` : jamais effectué** — la branche n'existe que localement ; le dépôt distant GitHub (f72838702-blip/bonne-humeur-tv) n'a reçu AUCUN commit ; **la production n'a pas été modifiée**.

### Liste des commits (du plus ancien au plus récent)

| Commit | Contenu |
|---|---|
| `5c10acc` | (pré-mission) plateforme Web TV initiale — Next 15, Tailwind, Zustand, Supabase |
| `3c05d04` | (pré-mission) contact WhatsApp +224 662 860 976 |
| `9351a77` | (pré-mission) design : polices Inter/Archivo, icône SVG, image OG, animations Reveal, WhatsApp flottant |
| `6d95898` | feat(backend) : migrations, RLS, actions serveur, sécurité, tooling (47 fichiers) |
| `ff80c4e` | feat(cms) : back-office /admin complet (27 fichiers) |
| `c3b993f` | feat(public) : portail réel, formulaires sécurisés, suppression des mocks (33 fichiers) |
| `b3600c5` | docs : rapport final de transformation (12 sections) |
| `c4bca82` | feat(directive) : YouTube strict, pipeline images, position accueil (29 fichiers) |
| `229376b` | docs : rapport final — section 13 checklist directive (1 fichier) |

### Volumétrie approximative de la mission (non compris les 3 commits pré-mission)

- **Fichiers créés :** ≈ 105
- **Fichiers modifiés :** ≈ 34
- **Fichiers supprimés :** 6 (tous documentés dans le rapport final, §2 — notamment `lib/videos.ts` et son contenu mock, l'ancien client navigateur Supabase, la page mock `app/video/page.tsx`, `components/mock/*`) ;
- **Dossiers structurants :** `app/` (public + admin), `components/` (admin, home, video, shared, layout), `lib/` (actions, auth, content, data, media, supabase, validation, youtube), `supabase/migrations/`, `docs/`, `.github/workflows/`.

### Dépendances installées — versions EXACTES vérifiées (`npm ls`)

| Package | Version installée | Usage |
|---|---|---|
| `next` | **15.5.24** (branche 15.x volontaire) | framework App Router |
| `react` / `react-dom` | 19.2.8 | UI |
| `@supabase/supabase-js` | 2.118.0 | client Postgres/Auth/Storage |
| `@supabase/ssr` | 0.12.7 | cookies session côté serveur |
| `zod` | 4.6.7 (corrige GHSA-mrhx-c7xc-m3w5) | validation serveur |
| `marked` | 18.1.2 | Markdown (rendu SÛR, échappement avant parse) |
| `zustand` | 5.0.15 | thème clair/sombre |
| `lucide-react` | 0.469.0 | icônes |
| `clsx` / `tailwind-merge` | 2.1.1 / 2.6.0 | styles conditionnels |
| `tailwindcss` | 3.4.19 (v3, PAS v4) | styles (tokens guinea.*, night.*, shadow-glow) |
| `typescript` | 5.9.3 | strict |
| `eslint` / `eslint-config-next` | 9.39.5 / ^15.3.0 | lint (flat config, FlatCompat) |
| `vitest` | 5.0.5 (montée depuis 4.x pour corriger GHSA path-traversal) | tests |

**Aucune autre dépendance n'a été ajoutée. En particulier : pas de framer-motion** (les animations utilisent IntersectionObserver maison — `Reveal.tsx`). **Ne pas en installer sans justification.**

---

## 3. FONCTIONNALITÉS TERMINÉES — états honnêtes

Légende : ✅ développée et testée · 🟡 développée mais non testée (en réel) · 🟠 partiellement développée · 🔒 bloquée par configuration externe · ❌ non développée.

| Fonctionnalité | État | Détail honnête |
|---|---|---|
| Suppression intégrale des mocks / faux contenus | ✅ | vérifiée au build ; aucun mock résiduel |
| Portail public — accueil réel (flash-infos, direct réel, à la une, actualités, B2B) | 🟡 | code terminé, rendu/build OK, ISR 120 s ; **jamais testé contre une base réelle** (aucune base n'existe) |
| Portail `/actualites` (pagination, catégories, fiches Markdown sûres, articles liés) | 🟡 | idem |
| Web TV `/videos` + fiches (embed youtube-nocookie click-to-load) | 🟡 | idem |
| Recherche globale `/recherche` (RPC `search_published`) | 🟡 | fonction SQL fournie ; **migration non appliquée** |
| Formulaires contact & partenariats sécurisés | 🟡 | honeypot + Zod + rate limit base + Turnstile ; inserts jamais exécutés en réel |
| CMS `/admin` complet (11 sections) | 🟡 | navigation/états vérifiés par build ; parcours authentifiés jamais joués en réel |
| Authentification & rôles (admin/editor/reporter) | 🔒 | code complet (Auth Supabase + RLS + trigger) ; **bloqué par la création du projet Supabase** |
| Ajout vidéo par URL YouTube (4 formats) + import métadonnées | 🟡 | extraction strictement testée (55/55) ; parcours complet non joué en base réelle ; import API inactif sans `YOUTUBE_API_KEY` |
| Position d'épinglage vidéo sur l'accueil | 🔒 | code + tri terminés ; **exige l'application de la migration 0007** (sinon l'INSERT échoue) |
| Pipeline images (compression navigateur + variantes + dossiers) | 🟡 | logique terminée et sniffer testé unitairement ; jamais éprouvé contre un Storage réel ni sur une matrice de navigateurs |
| Validation serveur images (magic bytes + dimensions + plafonds) | ✅ | `lib/media/sniff.test.ts` — JPEG/PNG/GIF/WebP, refus SVG/exécutables, testé unitairement |
| Refus des sources vidéo externes (directive §1) | ✅ | 6 tests de refus (vimeo, domaine piégé, ftp, javascript:, longueurs 10/12) |
| Médiathèque Storage (upload serveur service_role) | 🔒 | code terminé ; exige `SUPABASE_SERVICE_ROLE_KEY` en production |
| Rate limiting base + honeypot + Turnstile | 🟡/🔒 | rate limit exige service_role (sinon « degraded » documenté) ; Turnstile exige les clés Cloudflare |
| Publication programmée (pg_cron) | 🟠 | migration 0006 fournie, s'appliquera si l'extension existe ; **inactive tant que non appliquée** |
| SEO (sitemap, robots, canonical, JSON-LD, OG image) | ✅ | routes générées et vérifiées au build |
| Pages légales | 🟠 | textes structurants avec marqueurs **[À VALIDER PAR LA DIRECTION]** |
| Notifications email/SMS réelles, newsletter | ❌ | hors périmètre MVP ; aucun service configuré ; **ne pas présenter comme existant** |
| Plaquette PDF | ❌ | lien mort retiré ; aucun faux fichier créé |
| Compteurs de vues / statistiques d'audience | ❌ | volontairement absents (donnée inexistante → jamais de chiffre fictif) |
| Tests E2E / intégration réelle | ❌ | aucun (aucune base pour les jouer) |

**Règle de vérité appliquée partout : un message « envoyé avec succès » n'apparaît QUE si le serveur a confirmé l'écriture ; un état vide est affiché honnêtement ; aucun contenu fictif n'est présenté comme réel.**

---

## 4. BACKEND ET SUPABASE

### 4.1 Migrations SQL — ATTENTION : il y en a HUIT, pas six

Les migrations 0007 et 0008 ont été ajoutées par la directive vidéo/images (postérieures à la mission master). **AUCUNE des huit n'a été appliquée** — elles n'existent que comme fichiers dans `supabase/migrations/` (aucune connexion à une base, conformément à l'interdiction de toucher une base sans autorisation).

| Fichier | Contenu | Appliquée ? |
|---|---|---|
| `0001_schema.sql` | 11 tables, contraintes, index partiels | **NON** |
| `0002_rls.sql` | RLS intégrale + policies + vue `author_names` | **NON** |
| `0003_functions.sql` | `current_role()`, `has_role()`, `is_admin()`, `is_staff()`, trigger `handle_new_user` (rôle reporter forcé), triggers d'audit, `check_rate_limit`, `search_published`, `revoke` PUBLIC | **NON** |
| `0004_storage.sql` | bucket `media` public en lecture, 5 Mo (durci ensuite par 0008), MIME allowlist, policy lecture publique | **NON** |
| `0005_seed_categories.sql` | 11 catégories structurelles (`on conflict do nothing`) | **NON** |
| `0006_scheduled_publish.sql` | publication programmée pg_cron (OPTIONNEL, dégradation documentée si l'extension est absente) | **NON** |
| `0007_video_position.sql` | colonne `videos.position` (0-999, check) + index partiel `videos_home_order_idx` | **NON** — **OBLIGATOIRE avant d'utiliser le formulaire vidéo** (sinon l'INSERT échoue) |
| `0008_media_folders.sql` | plafond bucket 2 Mo + lecture publique restreinte aux 5 dossiers logiques | **NON** |

**Ordre d'application strict : 0001 → 0002 → 0003 → 0004 → 0005 → (0006) → 0007 → 0008.** Procédure détaillée : `supabase/README-CONFIGURATION.md` §2.

### 4.2 Les onze tables (0001)

`profiles` (rôles admin/editor/reporter, trigger d'inscription force reporter) · `categories` · `tags` + `article_tags` (N-N) · `articles` (5 statuts, `published_at` figé à la 1re publication, `scheduled_at`, `is_featured`) · `videos` (`youtube_id` 11 car., `is_live`, `is_featured`, `position`) · `breaking_news` (périodes, `position`) · `partnership_requests` · `contact_messages` · `form_submissions` (rate limiting, **aucune policy** → inaccessible hors RPC/service_role) · `audit_logs` (append-only).

### 4.3 RLS (0002) — points clés

- Activée sur TOUTES les tables ; le public ne lit que le publié/périodes actives ; anon **INSERT only** sur les 2 formulaires ;
- **Anti-élévation** : `profiles_update` compare avec `current_role()` — impossible de s'attribuer un rôle privilégié (testable) ;
- `articles_update` : un reporter ne peut pas s'auto-publier ;
- `audit_logs` : append-only, lecture admin uniquement ;
- vue `author_names` (id + nom complet, rien d'autre) pour les bylines publiques.

### 4.4 Fonctions PostgreSQL (0003)

`current_role()`/`has_role()`/`is_admin()`/`is_staff()` (security definer) · `handle_new_user` · `audit_row_change` (6 tables) · `check_rate_limit(p_form_type, p_identifier, p_max, p_window)` (état partagé → fiable en serverless ; `revoke` PUBLIC/anon/authenticated) · `search_published(p_query, p_limit)`.

### 4.5 Rôles

| Rôle | Droits |
|---|---|
| `reporter` | ses articles uniquement, brouillon/soumission — jamais publier |
| `editor` | tout le contenu + médiathèque + demandes |
| `admin` | tout + utilisateurs (rôles, invitations, désactivation) + audit |

Premier admin : à promouvoir via SQL (l'inscription publique ne crée que des reporters) — script dans `README-CONFIGURATION.md` §3.

### 4.6 Authentification

Supabase Auth (email/mot de passe) via `@supabase/ssr` (cookies de session). Login : `/admin/login` → action `signIn` (message générique anti-énumération). Middleware : gate sur `/admin/*` (sauf login), Edge-safe via `public-config.ts`. **Jamais une protection frontend n'est le seul contrôle** : chaque page/action revalide `requireRole()`, la RLS tranche en dernier.

### 4.7 Les quatre clients Supabase (`lib/supabase/`) — NE JAMAIS CASSER CETTE SÉPARATION

| Client | Clé | Cookies | Usage |
|---|---|---|---|
| `getSupabasePublicClient` | anon | **non** | lectures publiques ISR (pages publiques) |
| `getSupabaseServerClient` | anon | oui | Server Actions, back-office, formulaires |
| `getSupabaseAdminClient` | **service_role** | non | serveur uniquement : rate limit, invitations, Storage — `null` si clé absente |
| client navigateur | — | — | **supprimé** (inutile) |

`lib/supabase/config.ts` (serveur, référence les secrets) ; `lib/supabase/public-config.ts` (client/Edge-safe : URL, anon key, site Turnstile uniquement). **Le middleware et tout composant client n'importent QUE public-config.ts.**

### 4.8 Variables d'environnement (aucune valeur secrète reproduite ici)

| Variable | Exposée navigateur | Rôle | État actuel |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | oui | URL projet | absente en local/prod |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | oui | clé publique (RLS) | absente |
| `SUPABASE_SERVICE_ROLE_KEY` | **NON** | invitations, Storage, rate limit | absente |
| `NEXT_PUBLIC_SITE_URL` | oui | SEO/canonical | absente (repli par défaut) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | oui / **non** | captcha optionnel | absentes → Turnstile inactif (documenté) |
| `YOUTUBE_API_KEY` | **NON** | import métadonnées YouTube (directive) | absente → import inactif, saisie manuelle OK |

### 4.9 Opérations nécessitant des accès externes (à faire par Bonne Humeur TV)

1. Créer le projet Supabase (région proche de la Guinée) ;
2. Appliquer les 8 migrations dans l'ordre (SQL Editor) ;
3. Promouvoir le premier admin (SQL fourni) ;
4. Renseigner les variables Vercel (Production + Preview) ;
5. (Optionnel) créer la clé YouTube Data API v3 (Google Cloud) ;
6. (Optionnel) clés Turnstile (Cloudflare) ;
7. Redéployer.

---

## 5. IMAGES ET VIDÉOS — conformité directive

### 5.1 Confirmations exigées

- **YouTube reste l'unique hébergement vidéo : OUI, confirmé.** Aucun fichier vidéo n'existe dans le projet ; aucun upload, aucun proxy, aucune route de streaming ; la table `videos` ne stocke que des métadonnées ; lecture via iframe `https://www.youtube-nocookie.com/embed/{id}` au clic uniquement ; toute URL externe est refusée par `extractYouTubeId` (testé).
- **Les images utilisent Supabase Storage : OUI.** Bucket `media`, public en lecture, écriture uniquement via Server Action + client service_role (aucune policy d'écriture) ; dossiers logiques `articles/`, `categories/`, `thumbnails/`, `reporters/`, `branding/` ; lecture publique restreinte à ces dossiers (0008) ; **rien n'est hébergé dans `public/` du serveur applicatif** (seuls l'icône SVG et l'image OG du site, générés, y vivent).
- **La compression automatique est RÉELLEMENT implémentée : OUI (côté navigateur) + validation binaire serveur.** `lib/media/compress.ts` (canvas → WebP, repli JPEG, ratio préservé, EXIF supprimés par ré-encodage, cibles par variante, seconde passe qualité si le poids visé est dépassé) ; `lib/media/sniff.ts` (magic bytes JPEG/PNG/GIF/WebP + dimensions réelles + plafonds) ; **testée unitairement** (sniff + variantes), **mais jamais éprouvée en conditions réelles** (pas de Storage, pas de matrice navigateurs). La compression client n'est jamais considérée comme un contrôle de sécurité — le serveur revalide tout (fail-closed).

### 5.2 Formats acceptés

Côté validation serveur ET bucket : **JPEG, PNG, WebP, GIF** (images uniquement). **SVG refusé** (pas dans l'allowlist, signature non reconnue → fail-closed). Exécutables refusés. Le MIME déclaré doit correspondre au MIME sniffé (un `.jpg` renommé depuis un PNG est refusé ou reclassé selon le contenu réel).

### 5.3 Limites de taille

| Garde | Valeur |
|---|---|
| Poids absolu du fichier source | **2 Mo** (bucket durci par 0008 ; constante `ABSOLUTE_MAX_BYTES`) |
| Variante `full` (grande couverture) | ≤ 600 Ko, ≤ 2000 px |
| Variante `card` | ≤ 300 Ko, ≤ 900 px |
| Variante `thumb` | ≤ 200 Ko, ≤ 600 px |
| Variante `avatar` | ≤ 200 Ko, ≤ 500 px |
| Cibles de compression navigateur | full 1920 px/500 Ko · card 800 px/200 Ko · thumb 480 px/120 Ko · avatar 400 px/100 Ko |
| Dimension absolue maximale | 4000 px |

### 5.4 Variantes générées

- `articles/` → **full + card + thumb** (main : full)
- `categories/` → **card + thumb** (main : card)
- `thumbnails/` → **thumb**
- `reporters/` → **avatar**
- `branding/` → **full**

Nommage : `{base}.webp` (variante principale), `{base}-card.webp`, `{base}-thumb.webp`. Les variantes se déduisent de l'URL via `mediaVariantUrl()` (les URLs externes/YouTube sont renvoyées inchangées — jamais retéléchargées). Affichage : cartes → variante `-card`, listes/recherche → `-thumb`, couverture d'article → full + `priority` ; tout en `unoptimized` (servi directement par le CDN Storage, aucune réoptimisation par requête).

### 5.5 Optimisations manquantes (documentées, non présentées comme faites)

- **AVIF : non implémenté** (seul WebP + repli JPEG le sont) ;
- GIF animés : pas de compression (ré-encodée, l'animation serait perdue) — l'original part tel quel sous les plafonds ;
- Compression jamais testée sur navigateurs anciens (repli `HTMLImageElement` prévu, non éprouvé) ;
- Pas de « srcset » multi-résolutions par variante (une variante par usage suffit au périmètre actuel) ;
- La variante n'existe que si le dossier la prévoit (ex. `reporters/` n'a pas de `-card`) — c'est voulu.

---

## 6. CLOUDFLARE ET INFRASTRUCTURE GRATUITE — état exact

**Contrainte respectée : ZÉRO abonnement payant.** Tout ce qui a été construit tourne sur des offres gratuites :

| Brique | Offre | Coût |
|---|---|---|
| Application (Next.js 15) | **Vercel Hobby** (déploiement actuel bonne-humeur-tv.vercel.app) | 0 € |
| Base + Auth + Storage | **Supabase Free** | 0 € |
| Hébergement vidéo + bande passante streaming | **YouTube** (iframe, coût nul pour le site) | 0 € |
| CDN images | Storage Supabase (`/storage/v1/object/public/...`) | 0 € |
| Captcha (optionnel) | **Cloudflare Turnstile** Free | 0 € |
| Polices | auto-hébergées via `next/font` | 0 € |

**Compatibilité Cloudflare Workers Free : NON ÉVALUÉE, NON TESTÉE, AUCUNE adaptation réalisée.** La cible d'hébergement retenue par la mission master ET par la directive §4 est **Vercel** (« Next.js = présentation/admin/serveur ; Vercel = hébergement applicatif »). Cloudflare n'intervient que pour Turnstile (clés absentes → inactif, dégradation documentée). Si une migration vers Workers Free devenait une exigence : Next.js sur Workers exige l'adaptateur **OpenNext/cloudflare** — ce serait un travail significatif (runtime, middleware Edge, ISR, Storage fetch), **jamais entamé** ; à traiter comme un nouveau chantier avec tests dédiés, pas comme une simple bascule DNS. Aucun problème Cloudflare n'a été rencontré faute d'avoir utilisé autre chose que Turnstile.

**Attention Vercel Hobby :** le build utilise les quotas gratuits (aucune fonction payante requise). Les images sont volontairement `unoptimized` — cela **évite** aussi la consommation des quotas d'optimisation d'images Vercel.

---

## 7. TESTS ET SÉCURITÉ

### 7.1 Commandes réellement exécutées (dernière passe, post-directive)

| Commande | Résultat |
|---|---|
| `npx tsc --noEmit` | **EXIT 0** — 0 erreur (TypeScript strict) |
| `npm run lint` (ESLint 9.39.5, `next/core-web-vitals`, flat config) | **EXIT 0** — 0 erreur, 0 warning |
| `npm test` (Vitest 5.0.5) | **55/55 tests réussis** — 5 fichiers : `lib/utils.test.ts` (slugify/échap/temps de lecture), `lib/content/markdown.test.ts` (4 tests injection XSS), `lib/validation/schemas.test.ts`, `lib/youtube/url.test.ts` (4 formats + refus externes + durées ISO), `lib/media/sniff.test.ts` (signatures binaires + variantes + dossiers) |
| `npm run build` (Next 15.5.24) | **EXIT 0** — 29 routes générées (dont sitemap.xml, robots.txt, middleware 94,7 ko) |
| `npm audit` | 1 moderate dev-only restante (voir 7.3) contre 6 initiales dont critiques |

CI GitHub Actions (`.github/workflows/ci.yml`) : rejoue lint → tsc → tests → build à chaque push/PR.

### 7.2 Sécurité implémentée

- RLS intégrale, anti-élévation, workflow reporter non auto-publiable ;
- `requireRole()` sur CHAQUE page/action admin ; middleware en UX uniquement ;
- Validation Zod 4 **serveur uniquement** (la validation client n'est jamais un contrôle de sécurité) ;
- Rate limiting **en base** (pas un limiter mémoire locale — fiable en serverless) ; identifier = SHA-256 salé de l'IP, 40 car. ;
- Honeypot `website` + Turnstile optionnel (`verifyTurnstile` → ok/invalid/inactive) ;
- Markdown sûr : échappement HTML intégral avant parsing, `javascript:`/`data:text/html` neutralisés ;
- Uploads : signature binaire + dimensions + plafonds + anti-traversée (`deleteMedia` : dossier autorisé, pas de `..`) ;
- En-têtes : CSP (YouTube-nocookie, i.ytimg, Supabase, Turnstile), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` (camera/mic/geo/browsing-topics off), HSTS ;
- Audit append-only sur 6 tables ; secrets jamais côté client (`public-config.ts` séparé) ;
- Source vidéo : liste blanche stricte de domaines (directive §1), clé YouTube serveur uniquement.

### 7.3 Vulnérabilités

**Corrigées :** 6 initiales — Next.js critiques (montée en 15.5.24 dans la branche 15.x), Zod high GHSA-mrhx-c7xc-m3w5 (→ 4.6.7), postcss/sharp/source-map-js ; vitest ≤ 4.1.10 moderate path-traversal (→ 5.0.5).

**Reste :** 1 **moderate dev-only** — `minimatch` (GHSA-g3hv-75wg-m249) dans la chaîne ESLint 9 : le correctif exige ESLint 4, incompatible avec `eslint-config-next`. Aucune exposition runtime/production. À suivre lors des montées de version d'`eslint-config-next`.

**Risques documentés (non corrigés) :** CSP `script-src 'unsafe-inline'` (hydratation Next.js sans nonce ; atténué par l'absence de script tiers) ; rate limit « degraded » sans service_role (affiché honnêtement).

### 7.4 Tests d'intégration et de sécurité ENCORE NÉCESSAIRES (après mise en service)

1. Parcours authentifiés réels : login, rôles (reporter ne publie pas, changement de rôle admin uniquement), anti-élévation en base ;
2. Inserts réels des formulaires + rate limiting effectif + honeypot ;
3. Upload réel Storage : compression navigateur (Chrome, Firefox, Safari, Edge), validation binaire contre de vrais fichiers hostiles (SVG déguisé, exécutable renommé, dimensions retouchées) ;
4. RLS en conditions réelles (comptes anonym/authentifiés via PostgREST) ;
5. Formulaire vidéo : application de 0007 puis création/édition/épinglage ;
6. `search_published` (recherche), publication programmée (0006) si pg_cron ;
7. Balayage de sécurité post-déploiement (en-têtes, CSP réelle, enumération de login) ;
8. Matrice mobile lente (Guinée) : poids réel des pages, comportement click-to-load.

---

## 8. ÉLÉMENTS BLOQUANTS — tout ce qui manque pour la mise en service

**Aucune valeur secrète n'est reproduite ici.**

| # | Élément manquant | Fournisseur | Impact sans lui | Priorité |
|---|---|---|---|---|
| 1 | Projet Supabase (création) | Supabase Free | rien ne fonctionne : CMS, formulaires, comptes | **P0** |
| 2 | Application des 8 migrations (ordre strict) | SQL Editor Supabase | schéma absent ; **0007 obligatoire avant le formulaire vidéo** | **P0** |
| 3 | `SUPABASE_SERVICE_ROLE_KEY` configurée (Vercel, serveur uniquement) | Vercel | médiathèque, invitations, rate limit désactivés (états honnêtes) | **P0** |
| 4 | Promotion du premier admin (SQL fourni) | SQL Editor | aucun compte à privilèges | **P0** |
| 5 | Variables Vercel (URL, anon key, service_role, site URL) | Vercel | back-office « non configuré », formulaires sans enregistrement | **P0** |
| 6 | Vrais IDs YouTube des émissions (saisie rédaction) | Bonne Humeur TV | Web TV vide (état honnête) | **P0** |
| 7 | Coordonnées officielles + validation des textes légaux | Direction | mentions légales avec marqueurs [À VALIDER] | **P1** |
| 8 | Logo officiel + image OG définitive | Direction | monogramme SVG générique actuel | **P1** |
| 9 | `YOUTUBE_API_KEY` (Google Cloud, Free avec quota) | Google Cloud | import métadonnées inactif — saisie manuelle fonctionnelle | **P2** |
| 10 | Clés Turnstile (Cloudflare Free) | Cloudflare | captcha inactif (honeypot + rate limit restent) | **P2** |
| 11 | Décision plaquette PDF réelle | Direction | lien retiré, rien de faux à la place | **P2** |
| 12 | Fusion `feature/plateforme-media` → `main` + déploiement | Direction (autorisation explicite) | la production n'a AUCUN des travaux | **P0** (après revue) |

---

## 9. PLAN DE FINALISATION — tâches restantes classées

### P0 — indispensable avant mise en production

1. Créer le projet Supabase (région proche Guinée) ;
2. Appliquer les migrations **0001 → 0008 dans l'ordre strict** (0006 optionnel) ;
3. Promouvoir le premier admin (script `README-CONFIGURATION.md` §3) ;
4. Configurer toutes les variables Vercel (Production **et** Preview) — cf. §4.8 ;
5. Créer les 2e/3e comptes de rédaction via invitations (ou SQL) ;
6. Saisir les vrais IDs YouTube (au moins 3-5 émissions) + créer 1-2 articles réels ;
7. Rejouer la checklist `README-CONFIGURATION.md` §6 (login, article publié visible, vidéo visible, formulaire contact enregistré, sitemap) ;
8. Revue de code sur `feature/plateforme-media` puis fusion vers `main` + déploiement Vercel — **uniquement sur autorisation explicite de la direction**.

### P1 — indispensable pour une exploitation fiable

9. Tests d'intégration réels (liste §7.4, points 1-6) ;
10. Validation navigateurs réels de la compression d'images (Chrome/Firefox/Safari/Edge, GIF, gros fichiers) + tests hostiles (SVG déguisé, exécutable renommé) ;
11. Renseigner les coordonnées officielles + valider les pages légales ;
12. Logo officiel + image OG ;
13. Vérifier le comportement mobile lente (poids, clic-to-play) depuis Conakry si possible ;
14. Activer les sauvegardes périodiques (`docs/SAUVEGARDE.md`) ;
15. Configurer la protection de la branche `main` sur GitHub + protéger le secret service_role côté Supabase (rotation si exposé) ;
16. Vérifier l'état des vulnérabilités (`npm audit`) après un éventuel `npm update` contrôlé.

### P2 — améliorations non bloquantes

17. `YOUTUBE_API_KEY` (import métadonnées) ;
18. Clés Turnstile ;
19. Nonces CSP (supprimer `unsafe-inline`) ;
20. Suivi du correctif `minimatch` (montée `eslint-config-next`) ;
21. AVIF en complément du WebP (si gain mesuré) ;
22. srcset multi-résolutions, newsletter/notifications email réelles (nouveau service), éventuelle plaquette PDF ;
23. Statistiques d'audience RÉELLES (Supabase Analytics ou Plausible) — jamais de compteurs fictifs ;
24. Éventuelle évaluation OpenNext/Cloudflare Workers (voir §6) — chantier dédié.

---

## 10. INSTRUCTIONS POUR GLM 5.3 FLASH

### 10.1 Comment reprendre le projet

1. Dossier : `C:\Users\alpha\bonne-humeur-tv` ; branche : **`feature/plateforme-media`** (HEAD `229376b`) ; `main` n'a pas reçu les travaux ;
2. **AUCUN push n'a jamais été fait** — la branche n'existe qu'en local. Premier réflexe : `git status` (propre sauf le présent rapport, non commité) puis `git log --oneline` pour confirmer les 9 commits ;
3. Installer : `npm install` (Windows 11 ; PowerShell ; Node ≥ 20 requis pour Next 15) ;
4. Créer `.env.local` depuis `.env.example` **seulement si des clés réelles existent** — sans clés, le site affiche des états « non configuré » honnêtes, c'est voulu ;
5. Lancer : `npm run dev` (dev local), vérifier http://localhost:3000.

### 10.2 Fichiers à examiner EN PREMIER (ordre conseillé)

1. `RAPPORT_FINAL_TRANSFORMATION_BONNE_HUMEUR_TV.md` (racine) — état détaillé + section 13 (checklist directive) ;
2. `supabase/README-CONFIGURATION.md` — mise en service complète ;
3. `lib/supabase/{config,public-config,server,admin}.ts` — la séparation des 4 clients ;
4. `lib/auth/session.ts` + `middleware.ts` — le modèle de garde ;
5. `supabase/migrations/0001→0003` — schéma, RLS, fonctions ;
6. `lib/actions/{helpers,public-forms,content,admin,youtube}.ts` — patterns des Server Actions ;
7. `lib/youtube/url.ts` + `lib/media/{variants,sniff,compress}.ts` — le cœur de la directive ;
8. `next.config.ts` — CSP + remotePatterns ; `app/layout.tsx` — thème/FOUC/JSON-LD ;
9. `docs/DEPLOIEMENT.md` + `docs/SAUVEGARDE.md` ;
10. `lib/types.ts` — reflet exact du schéma SQL (toute évolution SQL doit y être répercutée).

### 10.3 Décisions architecturales à CONSERVER

- **YouTube = vidéos ; Supabase PostgreSQL = métadonnées ; Supabase Storage = images ; Next.js = présentation/admin/validations serveur ; Vercel = hébergement.** Rien d'autre. Aucune vidéo/images sur le serveur applicatif ;
- Les 4 clients Supabase et la frontière `public-config.ts` (Edge/client) vs `config.ts` (serveur) ;
- **RLS en dernier ressort** sur tout, + garde `requireRole()` dans chaque action ; jamais la protection frontend seule ;
- Validation Zod **serveur uniquement** ; compression client ≠ sécurité (le serveur revalide signature/dimensions/poids) ;
- Rate limiting **en base** (jamais un limiter mémoire locale en serverless) ;
- Honnêteté radicale des états : vides affichés comme vides, « non configuré » affiché, succès uniquement après confirmation serveur, aucun faux direct/compteur/article fictif ;
- Click-to-load youtube-nocookie + images `unoptimized` servies par le CDN (pas de réoptimisation Vercel) ;
- ISR 120 s + client cookieless pour les pages publiques ;
- Échappement HTML avant `marked.parse` (jamais l'inverse) ;
- Branches : travailler sur `feature/plateforme-media` (ou une nouvelle branche), jamais directement `main`.

### 10.4 Erreurs à NE PAS reproduire (leçons réelles du projet)

1. **Ne pas importer `lib/supabase/config.ts` dans le middleware ou un composant client** (fuite potentielle de secrets) → toujours `public-config.ts` ;
2. **Ne pas utiliser de guillemets dollar `$$` imbriqués dans un bloc DO SQL** (0006 l'a corrigé : délimiteur `$cron$`) — un `$$` interne ferme le bloc externe ;
3. **Ne pas considérer un limiter mémoire comme une protection** en serverless — l'état doit vivre en base ;
4. **Ne pas mettre en place d'apostrophe/non-échappement JSX** (ESLint `react/no-unescaped-entities` casse la CI) — utiliser `’`/`&apos;` ;
5. **Ne pas importer `framer-motion`** — il n'est PAS installé ; les animations sont maison (IntersectionObserver, `Reveal.tsx`) ;
6. **Ne pas annoncer une migration comme appliquée** : les 8 migrations ne sont QUE des fichiers. Toute phrase du type « appliqué » sans exécution réelle = non-conformité à la mission ;
7. **Ne pas inventer d'IDs YouTube, logo, PDF, coordonnées ou statistiques** — la rédaction fournit le réel ;
8. **Ne pas pousser vers GitHub ni déployer sans autorisation explicite** (règle absolue, jamais levée) ;
9. Ne pas ajouter de dépendances sans justification forte (chaîne actuelle propre, 1 moderate dev-only) ;
10. Ne pas « réparer » les états vides en les remplissant de contenu fictif — c'est précisément ce qui a été éradiqué ;
11. Ne pas réoptimiser les images Storage à chaque requête (variantes déjà compressées → `unoptimized`) ;
12. Après `git add`, vérifier les warnings CRLF — inoffensifs sur ce dépôt, ne pas « corriger » les fins de lignes en masse.

### 10.5 Tâches à réaliser en premier

1. **P0 du §9** : mise en service Supabase (création projet + 8 migrations + admin + variables Vercel) — tout le reste en dépend ;
2. Puis la checklist `README-CONFIGURATION.md` §6 et les tests d'intégration §7.4 ;
3. Puis P1 (validation navigateurs compression, légal, logo, sauvegardes) ;
4. P2 en dernier.

### 10.6 Tests à exécuter après CHAQUE modification

```
npx tsc --noEmit     # 0 erreur attendu
npm run lint         # 0 erreur, 0 warning attendu
npm test             # 55/55 attendu (ajouter des tests à chaque nouvelle logique pure)
npm run build        # EXIT 0, 29 routes attendues
```

Toute régression sur l'un de ces quatre points bloque la modification. Si une migration SQL est ajoutée : la numéroter `0009…`, la documenter dans `README-CONFIGURATION.md`, répercuter `lib/types.ts`, et **ne jamais prétendre qu'elle est appliquée**. Si une nouvelle route publique est créée : vérifier sitemap/robots/canonical. Si une image externe apparaît : l'ajouter aux `remotePatterns` de `next.config.ts` + CSP.

### 10.7 Ce qui NE DOIT SURTOUT PAS être reconstruit

- **Le back-office `/admin` complet** (login, dashboard, articles, vidéos, flash-infos, demandes, utilisateurs, catégories, médiathèque) — fonctionnel, cohérent, testé au build ;
- **Les 8 migrations SQL + le socle RLS/fonctions** — versionnées, cohérentes entre SQL et `lib/types.ts` ;
- **Le pipeline formulaires** (honeypot → Zod → rate limit base → Turnstile → INSERT RLS → succès uniquement confirmé) ;
- **Le parseur YouTube strict + le client Data API v3** (`lib/youtube/`) — conforme directive, testé ;
- **Le pipeline images complet** (`lib/media/` : sniff, variantes, compression) — conforme directive, testé unitairement ;
- **La séparation des 4 clients Supabase + public-config** ;
- **Le rendu Markdown sûr** (échappement avant parse) ;
- **Le portail public** (accueil ISR, actualités, vidéos, recherche, pages légales) ;
- **Le tooling** (ESLint flat, Vitest 55 tests, CI GitHub Actions, docs) ;
- Le thème clair/sombre avec correction FOUC et les tokens de marque (`guinea.*`, `night.*`, `shadow-glow`, `.tricolor-line`).

En cas de doute sur une fonctionnalité : lire son état dans le rapport final (§4 « Fonctionnalités ») et dans le code — **ne jamais supposer** qu'un écran affiché = fonctionnalité réellement éprouvée.

---

## 11. VÉRIFICATION FINALE (au moment de la remise de ce rapport)

- Aucun fichier source modifié pour produire ce rapport (seul `RAPPORT_CLOTURE_ET_PASSATION_GLM53.md` a été créé, conformément au livrable demandé) ;
- **Aucun commit créé** pour ce rapport (consigne respectée) ;
- **Aucun push GitHub** ; **aucun déploiement** ; aucune base contactée ; aucun secret manipulé ni reproduit ;
- État Git vérifié : branche `feature/plateforme-media`, HEAD `229376b`, arbre propre **hormis le présent fichier** (`?? RAPPORT_CLOTURE_ET_PASSATION_GLM53.md`) — à commiter ou non selon la décision de la direction ;
- Commandes de vérification pour GLM 5.3 Flash au premier lancement : `git status`, `git log --oneline -9`, `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`.

**Résumé en une phrase : le code est complet, propre et testé (tsc 0, lint 0/0, 55/55, build OK), conforme aux 11 points de la directive vidéo/images/bande passante ; il ne manque QUE la configuration externe (Supabase, Vercel, contenus réels) et les tests en conditions réelles pour mettre Bonne Humeur TV en service.**