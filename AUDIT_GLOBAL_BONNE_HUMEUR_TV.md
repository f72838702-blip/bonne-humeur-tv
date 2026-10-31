# AUDIT GLOBAL, TECHNIQUE, FONCTIONNEL ET SÉCURITAIRE — BONNE HUMEUR TV

**Date de l'audit :** 31/10/2026
**Auditeur :** Équipe d'audit pluridisciplinaire (architecture, backend, sécurité, DevOps, SEO, UX, performance, média)
**Périmètre :** Dépôt local `C:\Users\alpha\bonne-humeur-tv`, dépôt GitHub `f72838702-blip/bonne-humeur-tv`, production `https://bonne-humeur-tv.vercel.app`
**Mode :** LECTURE SEULE STRICTE — aucun fichier source modifié, aucun commit, aucun déploiement, aucune écriture en base

---

## 1. RÉSUMÉ EXÉCUTIF

Bonne Humeur TV est une **vitrine web statique de qualité technique réelle**, livrée le 28/08/2026 en 3 commits (~4 450 lignes, 28 fichiers de code), fonctionnelle en production (toutes les routes répondent 200, build de production réussi, TypeScript strict sans erreur).

**Mais le site est une maquette en production, pas un média.** Trois constats majeurs, tous confirmés par preuves :

1. **Aucun contenu réel.** Les 8 « émissions » affichées sont des données fictives codées en dur, et toutes pointent vers le **même ID YouTube (`aqz-KE-bpKQ`)**, identifié par vérification oEmbed comme étant… *« Big Buck Bunny 60fps 4K — Official Blender Foundation Short Film »* (film d'animation open-source). Un visiteur qui lance n'importe quelle « émission » regarde un film de lapin 3D. Les compteurs de vues, dates, durées et le badge « En direct » sont inventés.

2. **Le backend n'existe pas.** Preuve extraite du bundle JavaScript déployé : les variables `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` ne sont **pas définies sur Vercel** (références `env` non résolues dans le code compilé). Les deux formulaires (contact + devis B2B) fonctionnent donc en **mode démo** : ils affichent « Message bien reçu ! » / « Demande envoyée ! » alors que les données partent uniquement dans `console.log` du navigateur du visiteur. **Le PDG ne peut pas recevoir de demande de partenariat via son site.**

3. **Aucune administration, aucun légal, dette de dépendances.** Aucun espace d'administration (ajouter une vidéo = modifier le code + redéployer). Aucune mention légale, aucune politique de confidentialité alors que les formulaires collectent nom/email/téléphone. `npm audit` : **1 vulnérabilité CRITIQUE (Next.js) + 4 ÉLEVÉES + 1 MODÉRÉE**.

**Niveau de préparation à une exploitation professionnelle : INSUFFISANT** (~2/10). L'architecture est en revanche saine et conservable : le chemin vers un vrai média est un complément (backend + CMS + contenu réel), pas une refonte.

---

## 2. PÉRIMÈTRE ET MÉTHODOLOGIE

### 2.1 Ce qui a été inspecté

- **37 fichiers** du projet (intégralité des sources, configurations, documentation), soit 100 % des fichiers hors `node_modules/`, `.next/`, `.git/`.
- **Production** : 5 routes + 5 ressources annexes testées en HTTP (codes de statut, tailles, en-têtes).
- **Bundle JavaScript déployé** : 9 chunks téléchargés et analysés (preuves de configuration d'environnement).
- **Historique Git complet** (3 commits, 1 branche).

### 2.2 Outils et commandes réellement utilisés

| Catégorie | Commandes/actions |
|---|---|
| Inventaire | `find` (arborescence complète), lecture intégrale des 37 fichiers |
| Git | `git log`, `git status` (avant/après), `git branch`, `git remote -v` |
| Typage | `npx tsc --noEmit` (2 exécutions) |
| Build | `npm run build` (Next.js 15.5.24, production, exit 0) |
| Dépendances | `npm audit` (2 exécutions, rapport complet et prod-only) |
| Statique | `grep` ciblés : sinks XSS (`dangerouslySetInnerHTML`/`innerHTML`/`eval`), secrets en dur, dépendances inutilisées |
| Production | `curl` sur 10 URLs, `curl -I` en-têtes, téléchargement et analyse de 9 bundles JS |
| Externe | `youtube.com/oembed` (identification du contenu réel de l'ID YouTube placeholder) |

### 2.3 Tests réalisés avec succès

- Build de production : **réussi** (exit 0, 17 pages statiques générées).
- `tsc --noEmit` : **réussi** (exit 0, mode strict activé).
- HTTP production : 5/5 pages → 200 ; page inexistante → 404 correct.
- Preuve bundle : mode démo des formulaires **confirmé dynamiquement**.
- Identification YouTube : **confirmée dynamiquement** (oEmbed).

### 2.4 Limites de l'audit (vérifications impossibles)

1. **Dashboard Vercel/Supabase non accessibles** : impossible de vérifier directement les tables Supabase ou la configuration Vercel. **Atténuation** : la preuve extraite du bundle (variables non résolues) démonttre de façon décisive qu'aucun projet Supabase n'est connecté — les tables sont donc sans effet, qu'elles existent ou non.
2. **Pas de navigateur disponible** dans l'environnement : pas de Lighthouse, pas de mesures Core Web Vitals réelles, pas de test de clic interactif (filtres, recherche, dark mode testés par lecture de code uniquement).
3. **Pas d'accès Search Console** : indexation Google inconnue.
4. **Synchronisation local↔distant non vérifiée** (`git fetch` non exécuté) ; toutefois le contenu HTML déployé correspond exactement au code local (titres des mocks, flash-infos, plaquette) → le déploiement correspond bien à l'état local auditée.
5. **ESLint non exécutable** : aucune configuration ESLint n'existe dans le projet (constat, non un échec d'outil).

---

## 3. INVENTAIRE TECHNIQUE

### 3.1 Arborescence réelle

```
bonne-humeur-tv/
├─ app/                          (9 fichiers)
│  ├─ layout.tsx                 Layout racine : Header/Footer/WhatsAppFloat, metadata globales
│  ├─ page.tsx                   Accueil (hero, à la une, grille, B2B)
│  ├─ globals.css                Tailwind + utilitaires (.tricolor-line, .scrollbar-none)
│  ├─ icon.svg                   Favicon SVG générique (play rouge)
│  ├─ opengraph-image.tsx        Image OG générée dynamiquement (next/og)
│  ├─ videos/page.tsx            Galerie
│  ├─ videos/[slug]/page.tsx     Détail vidéo (SSG 8 slugs)
│  ├─ partenariats/page.tsx      Offres B2B + mot du PDG + formulaire
│  └─ contact/page.tsx           Coordonnées + WhatsApp + carte OSM + formulaire
├─ components/                   (14 fichiers, 6 familles)
│  ├─ home/     BreakingNews, HeroPlayer, VideosGrid, B2BCta
│  ├─ video/    VideoCard, VideosGallery, ShareButtons
│  ├─ partenariats/ ServicesGrid, PartnershipForm
│  ├─ contact/  ContactForm
│  ├─ layout/   Header, Footer, WhatsAppFloat
│  └─ shared/   Reveal (IntersectionObserver)
├─ lib/                          (3 fichiers)
│  ├─ videos.ts    ⚠️ 8 vidéos MOCK codées en dur (source de vérité du site)
│  ├─ supabase.ts  Client singleton null-safe
│  └─ utils.ts     cn(), formatDate(), formatViews()
├─ store/                        (2 fichiers Zustand : theme persisté, filters)
├─ configurations : package.json, package-lock.json, tsconfig.json, tailwind.config.ts,
│  next.config.ts, postcss.config.mjs, .env.local.example, .gitignore, README.md
└─ public/  ← DOSSIER ABSENT (aucune image, aucun PDF)
```

### 3.2 Stack vérifiée (conforme à la déclaration)

Next.js **15.5.24** (réel, build du 31/10) · React 19 · TypeScript **strict** · Tailwind **3.4.17** · Zustand 5 · @supabase/supabase-js 2.47 · React Hook Form 7.54 · Zod **3.24.1** · lucide-react · Vercel (projet `prj_gTzhJcHZ7i2dzInMakbKsSpxm1RR`, équipe `dk-447c`).

### 3.3 Rendu

Site **100 % statique** : 17 pages pré-générées (SSG/prerender), zéro API Route, zéro Server Action, zéro middleware. Toute la logique métier dynamique (filtres, recherche, formulaires, thème) est **côté navigateur**.

---

## 4. RÉSULTATS DÉTAILLÉS DES 12 AXES

---

### AXE 1 — Architecture et qualité du code

**État constaté : BON, avec défauts identifiés.**

**Points conformes (preuves) :**
- Organisation standard Next.js App Router exemplaire : séparation `app/` / `components/` / `lib/` / `store/`, composants courts (17-182 lignes), responsabilités claires.
- TypeScript `strict: true` (`tsconfig.json:8`), `tsc --noEmit` exit 0.
- Typage complet : interface `Video` (`lib/videos.ts:3-15`), `CategoryKey` (`store/filters.ts:3-9`), `Record<Video["category"], string>` pour les styles (`VideoCard.tsx:7-13`).
- Gestion d'état Zustand sobre : 2 stores, `persist` pour le thème (`store/theme.ts:10-18`).
- Réutilisabilité : `VideoCard` utilisé dans 3 contextes ; `Reveal` (`components/shared/Reveal.tsx`) sans dépendance ; `cn()` (`lib/utils.ts:4-6`).
- Pas de `dangerouslySetInnerHTML`, pas de `eval` (grep exhaustif : 0 occurrence) → XSS par injection React impossible par construction.

**Problèmes détectés :**
| # | Problème | Preuve | Impact |
|---|---|---|---|
| A1-1 | **Duplication des puces de filtres** : le bloc boutons catégories est copié quasi à l'identique dans `VideosGrid.tsx:27-42` et `VideosGallery.tsx:43-61` | Lecture croisée des 2 fichiers | Divergence possible à la maintenance |
| A1-2 | **Dépendance morte** : `class-variance-authority` dans `package.json:13` mais **jamais importée** (grep : 0 occurrence) | `package.json` + grep | Poids install inutile, dette |
| A1-3 | **Configuration morte** : `next.config.ts:4-10` déclare `images.remotePatterns` mais `next/image` **n'est jamais utilisé** (grep : 0 occurrence ; 0 balise `<img>` dans le HTML déployé) | `next.config.ts` + HTML déployé | Induit en erreur sur les capacités réelles |
| A1-4 | **Couplage d'état global** : `VideosGrid` (accueil) et `VideosGallery` (page /videos) partagent le même store Zustand `useFilters` — changer de catégorie sur l'accueil modifie l'état de la galerie | `store/filters.ts:27-32`, `VideosGrid.tsx:19` | Effet de bord inter-pages non voulu |
| A1-5 | **FOUC inversé du thème** : `layout.tsx:53` force `class="dark"` au SSR, mais si l'utilisateur a persisté `dark:false` (localStorage `bhtv-theme`), `Header.tsx:22-24` retire la classe **après** hydratation → flash sombre→clair | Code + `store/theme.ts` | Défaut visuel à chaque chargement en thème clair |
| A1-6 | **Zéro test** : aucun fichier `*.test.*`/`*.spec.*` (find : 0) | `find` | Aucun filet de sécurité pour toute évolution |
| A1-7 | **Aucun ESLint** : pas de config, pas de dépendance eslint (inventaire + `package.json`) | Inventaire | Le check « Linting » du build ne fait que du typage |
| A1-8 | **Source de vérité dupliquée à venir** : `lib/videos.ts` est prévu pour migrer vers Supabase (commentaire l.33) mais aucune abstraction (repository/fonction de chargement) ne prépare cette migration | `lib/videos.ts:32-35` | Migration future = toucher tous les composants |

**Recommandations :** extraire un composant `<FilterChips>`, supprimer `class-variance-authority` et la config `images`, isoler `useFilters` par page ou ajouter un reset au montage, corriger le FOUC (inline script de thème pré-hydratation), introduire ESLint + tests de base.

---

### AXE 2 — Audit fonctionnel complet

**Vérifications HTTP réelles (production, 31/10/2026) :**

| Route | Statut | Taille HTML |
|---|---|---|
| `/` | 200 | 77,4 kB |
| `/videos` | 200 | 48,2 kB |
| `/videos/grand-journal-conakry-actu` | 200 | 54,6 kB |
| `/partenariats` | 200 | 50,8 kB |
| `/contact` | 200 | 37,0 kB |
| `/videos/inexistant-xyz` | **404** (correct) | 17,3 kB |

**Matrice fonctionnelle détaillée : voir section 5.** Points notables :

- La **page 404 fonctionne** (statut + page), `notFound()` d'Next correctement branché (`app/videos/[slug]/page.tsx:45`).
- Le **lien plaquette PDF** de `/partenariats` (2 occurrences dans le HTML déployé) pointe vers `/plaquette-institutionnelle.pdf` → **404** (fichier jamais créé, dossier `public/` inexistant). CTA principal de la page B2B cassé.
- L'**email de contact** est affiché en texte simple sans `mailto:` (grep HTML contact : 0 `mailto:`) — non cliquable.
- Les formulaires affichent un **écran de succès mensonger** en mode démo (`ContactForm.tsx:45-53`) : le visiteur croit que son message est envoyé.

---

### AXE 3 — Backend, Supabase et gestion des données

**État constaté : LE BACKEND N'EXISTE PAS EN PRODUCTION.**

**Preuve centrale (décisive) :** le chunk déployé `44530001-*.js` contient le code compilé :

```
let n = r.env.NEXT_PUBLIC_SUPABASE_URL, i = r.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    l = n && i ? (0,a.UU)(n,i) : null
```

Les références `env` **non résolues** prouvent que les variables n'étaient pas définies à la date du build Vercel (sinon Next.js les remplace par les littéraux). Aucune URL `https://<projet>.supabase.co` réelle n'apparaît dans les 9 bundles analysés.

**Conséquences vérifiées :**
- `supabase === null` en production (`lib/supabase.ts:11-12`).
- `ContactForm.tsx:32-36` et `PartnershipForm.tsx:38-43` prennent la branche démo : `console.log("[DEMO] …")` puis `setSent(true)` — **aucune écriture, aucun envoi**.
- Localement : seul `.env.local.example` existe (valeur `https://votre-projet.supabase.co`) — aucun `.env.local` réel.

**Tables :**
- Documentées dans `README.md:20-45` : `partnership_requests`, `contact_messages` (avec SQL complet : RLS + policies INSERT anon).
- Table `videos` : **mentionnée en commentaire** (`lib/videos.ts:33`, README l.75) mais **aucun SQL fourni, aucune création, aucune lecture dans le code**.
- État réel côté Supabase : **non vérifiable directement** (pas d'accès dashboard — limitation assumée). Mais l'absence de clés configurées rend la question théorique : **aucune table n'est contactée par l'application**.

**Gestion des erreurs réseau :** présente mais minimale — message générique utilisateur en cas d'échec d'insert (`ContactForm.tsx:38-40`, `PartnershipForm.tsx:55-58`), pas de retry, pas de distinction réseau/permission.

**Validation des données :** Zod côté **client uniquement** (`ContactForm.tsx:10-14`, `PartnershipForm.tsx:10-20`). **Aucune validation côté serveur** (aucun serveur).

**Recommandations :** créer le projet + tables + policies (le SQL du README est un bon point de départ), configurer les variables Vercel, puis — indispensable — ajouter une couche serveur (API Route ou Server Action) avec validation Zod partagée, captcha et rate limiting **avant** d'ouvrir les insertions publiques (voir AXE 4).

---

### AXE 4 — Audit de cybersécurité

**Approche OWASP adaptée. Surface d'attaque actuelle : très réduite (site statique sans authentification, sans base connectée, sans entrée utilisateur persistée) — mais des failles de conception et de dépendances sont confirmées.**

**Points sains vérifiés :**
- Aucun sink XSS (`dangerouslySetInnerHTML`/`innerHTML`/`eval` : 0 occurrence) ; React échappe tout par construction.
- Aucune injection SQL possible (pas de SQL ; le client Supabase utilise l'API PostgREST paramétrée).
- Aucun secret exposé : grep sur le code → 0 clé en dur ; `.gitignore` exclut `.env*` (l.9-11) ; le seul hit `supabase.co` est le pattern d'hostname dans `next.config.ts:8` (config d'images inutilisée, sans danger).
- Aucune authentification → aucun IDOR, aucun CSRF exploitable (pas de session), pas de contrôle d'accès à casser.
- `youtube-nocookie.com` utilisé (`HeroPlayer.tsx:21`) — bonnes pratiques d'embed.
- HSTS actif sur Vercel (en-tête vérifié : `max-age=63072000; includeSubDomains; preload`).

**Registre des vulnérabilités : voir section 6.** Faits saillants :

1. **Dépendance critique non corrigée — CONFIRMÉ** : `npm audit` signale Next.js 15.5.24 avec 4 advisories dont **CRITIQUE** (cache poisoning SSG/ISR multi-utlisateurs, RCE non authentifié dans l'API d'optimisation d'images via SVG, DoS Server Actions). Nuance honnête : l'hébergement Vercel (plateforme gérant elle-même l'optimisation d'images) et l'absence totale de Server Actions / d'ISR dynamique **atténuent fortement l'exploitabilité sur CE site** — mais la version doit être mise à jour.
2. **Formulaires publics sans défense — CONFIRMÉ (faille latente)** : dès que Supabase sera branché avec les policies INSERT `to anon with check (true)` du README (`README.md:44-45`), n'importe qui pourra insérer en masse (pas de captcha, pas de rate limiting, pas de honeypot, pas de validation serveur). Les tables seraient remplies de spam en quelques jours.
3. **En-têtes de sécurité absents — CONFIRMÉ** : `curl -I` ne montre que HSTS. **Aucun** `Content-Security-Policy`, `X-Frame-Options`/`frame-ancestors` (clickjacking possible sur la page, qui embarque des iframes tierces YouTube + OpenStreetMap), `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
4. **Zod 3.24.1 vulnérable — CONFIRMÉ** (GHSA-mrhx-c7xc-m3w5, exhaustion mémoire sur collections surdimensionnées ; correctif = migration majeure 4.6.7).
5. **Architecture 100 % client — RISQUE DE CONCEPTION** : toute écriture future se fait depuis le navigateur avec une clé publique ; aucun secret serveur n'est utilisable dans ce schéma. Pour un média qui devra protéger des leads commerciaux, une couche serveur est nécessaire.

---

### AXE 5 — Audit du système vidéo et de la Web TV

**État constaté : façade vidéo sans système vidéo.**

**Vérifié :**
- **Lecteur** : `HeroPlayer.tsx` — couverture CSS légère, iframe YouTube chargée **au clic uniquement** (l.19-27), `youtube-nocookie.com`, `autoplay=1&rel=0`. Mécanisme anti-surcoût bande passante correct et pertinent pour la Guinée.
- **Identifiants** : les 8 champs `youtubeId` de `lib/videos.ts` portent **tous** la valeur `aqz-KE-bpKQ`. Vérification oEmbed du 31/10 : ce vidéo = *« Big Buck Bunny 60fps 4K - Official Blender Foundation Short Film »* (Blender). **Toutes les « émissions » jouent le même film d'animation étranger, sans rapport avec la Guinée.**
- **Vidéos inexistantes** : slug inconnu → `notFound()` → 404 vérifié.
- **Recherche/filtres** : client pur (`VideosGallery.tsx:16-26`, insensible à la casse, titre+extrait), pagination « Charger plus » (6 par page), état vide géré (l.63-66).
- **Recommandations** : même catégorie d'abord (`lib/videos.ts:133-138`) — logique simple, fonctionnelle.
- **Miniatures** : **il n'y a AUCUNE miniature réelle** — les cartes utilisent des dégradés CSS + halos par catégorie (`VideoCard.tsx:30-41`). Aucune balise `<img>` sur tout le site (0 dans le HTML déployé). Pour une Web TV, c'est un handicap majeur : pas d'aperçu visuel, pas d'attribut `alt`, aucun poids SEO image, aperçu médiocre sur les partages (seule l'OG image générée existe).
- **Métadonnées** : durées, vues, dates = **valeurs inventées** codées en dur.

**Fonctions média NON IMPLÉMENTÉES (ne pas considérer comme existantes) :** direct/livestream (le badge « En direct » est un simple booléen mock `live: true`, `lib/videos.ts:48`), émissions séquencées, archives, programmation éditoriale, playlists, flash-infos administrables (4 messages en dur, `lib/videos.ts:25-30`), connexion à une chaîne YouTube (aucune API, aucun parsing de chaîne), statistiques de vues réelles.

**Évolutivité :** l'interface `Video` (`lib/videos.ts:3-15`) est propre et extensible ; le remplacement de la source de données est possible mais non préparé (pas de couche d'accès). Le lazy-embed YouTube est un socle valable pour un vrai direct (une URL de live YouTube s'insère dans le même lecteur).

---

### AXE 6 — Administration et évolutivité

**État constaté : AUCUNE ADMINISTRATION N'EXISTE. Vérifié par :** absence de routes `/admin`, `/login`, absence d'authentification (aucune dépendance auth, aucun middleware), absence de page protégée.

| Élément administrable | État | Comment l'administrer aujourd'hui |
|---|---|---|
| Vidéos | ❌ NON DÉVELOPPÉ | Modifier `lib/videos.ts` → commit → déploiement Vercel |
| Flash-infos | ❌ NON DÉVELOPPÉ | Modifier `lib/videos.ts:25-30` → commit → déploiement |
| Catégories | ❌ NON DÉVELOPPÉ | Modifier `store/filters.ts:11-18` + `lib/videos.ts:17-23` |
| Images/médias | ❌ NON DÉVELOPPÉ | Dossier `public/` inexistant |
| Demandes de partenariat | ❌ NON DÉVELOPPÉ (aucune donnée reçue) | — |
| Messages de contact | ❌ NON DÉVELOPPÉ (idem) | — |
| Utilisateurs/rôles | ❌ NON DÉVELOPPÉ | — |
| Paramètres du site | ❌ NON DÉVELOPPÉ | Tout est en dur |

**Conséquence : chaque changement de contenu exige un développeur et un déploiement.** Pour un média dont la valeur est la fraîcheur du contenu, c'est le verrou principal du projet.

**Besoins pour un CMS minimal adapté :** authentification (Supabase Auth suffit), rôle `admin`/`redacteur`, CRUD vidéos + flash-infos, lecture des `partnership_requests`/`contact_messages` (interface ou simple accès dashboard), upload médias (Supabase Storage).

---

### AXE 7 — Audit UX/UI et responsive design

**État constaté : SOLIDE, avec lacunes ciblées.**

**Points conformes :**
- Identité graphique cohérente et appropriée : couleurs drapeau (`guinea.*`, `tailwind.config.ts:14-18`), filet tricolore (`.tricolor-line`), dark mode TV nocturne (`night.*`), polices Inter + Archivo 500-900.
- Responsive par classes Tailwind vérifiées dans chaque composant : grilles `sm:grid-cols-2 lg:grid-cols-3`, puces scrollables mobile (`.scrollbar-none`), menu burger mobile (`Header.tsx:86-103`).
- Hiérarchie claire : 1 seul H1 par page (vérifié HTML : home=1, partenariats=1), sémantique correcte (`article`, `blockquote`, `figcaption`, `aside`).
- États vides gérés (recherche sans résultat, catégorie vide), erreurs de formulaires inline sous chaque champ, états de soumission (`isSubmitting` + spinner).
- Accessibilité partielle réelle : 5 `aria-label` sur la home (boutons icônes), `rel="noopener noreferrer"` sur tous les liens externes, `alt` sur l'OG image, `title` sur les iframes.
- Canal local pertinent : WhatsApp omniprésent (footer, page contact, bouton flottant, partage) — 6 liens wa.me vérifiés dans le HTML.

**Problèmes détectus :**
| # | Problème | Preuve |
|---|---|---|
| U1 | Aucune miniature vidéo → les cartes se ressemblent toutes (dégradés), la page « médias » n'affiche aucune image | 0 `<img>` dans le HTML |
| U2 | Email non cliquable (pas de `mailto:`) | `app/contact/page.tsx:42`, grep HTML : 0 |
| U3 | FOUC thème (cf. A1-5) | `layout.tsx:53` + `Header.tsx:22-24` |
| U4 | CTA plaquette PDF cassé (404) en haut de la vitrine B2B | `app/partenariats/page.tsx:32-39` + HTTP 404 |
| U5 | Succès de formulaire mensonger en mode démo | `ContactForm.tsx:33-36` |
| U6 | Le marquee flash-infos défile sans jamais se mettre en pause au survol (accessibilité vestibulaire) | `BreakingNews.tsx:15` |
| U7 | Promesses invérifiables (« Audience croissante », « Partenaires institutionnels », « réponse sous 48 h ») | `B2BCta.tsx:41-44`, `PartnershipForm.tsx:68-69` |

**Tests non réalisés :** rendus réels tablette/grand écran et lecteurs d'écran (pas de navigateur disponible) — les classes responsive et le contraste théorique (texte neutre sur fonds clairs/sombres) sont conformes par construction Tailwind.

---

### AXE 8 — Audit SEO et visibilité

**Vérifié dans le HTML déployé :**

| Élément | État | Preuve |
|---|---|---|
| Titres/descriptions par page | ✅ Présents (template `%s \| Bonne Humeur TV`) | `app/layout.tsx:19-23` + pages |
| Open Graph | ✅ Présents (type video.other sur fiches, `fr_GN`, og:image ×10) | `app/layout.tsx:25-32`, HTML |
| Twitter Cards | ✅ summary_large_image | `app/layout.tsx:33-37` |
| **URL canonique** | ❌ **ABSENTE** | grep HTML : « PAS DE CANONICAL » |
| **Sitemap** | ❌ **ABSENT** (`/sitemap.xml` → 404) | HTTP 404 |
| **robots.txt** | ❌ **ABSENT** (404) | HTTP 404 |
| **Données structurées Schema.org** | ❌ **AUCUNE** (pas de `application/ld+json`) — ni `VideoObject`, ni `Organization`, ni `BreadcrumbList` | grep HTML |
| H1 uniques | ✅ (1 par page vérifiée) | HTML |
| Attributs `alt` d'images | ❌ Sans objet actuel : **0 image sur le site** | HTML |
| Maillage interne | ✅ Correct (home↔vidéos↔fiches↔B2B↔contact) | Code + HTML |
| 404 | ✅ Statut + page corrects | HTTP |
| Indexation réelle Google | ❓ NON VÉRIFIABLE (pas d'accès Search Console) | — |

**Impact :** sans canonical, sitemap, JSON-LD `VideoObject` et miniatures, le site exploite une fraction de son potentiel SEO — pour un média dont la découvrabilité est vitale, c'est un axe à traiter. Le référencement local/national (« actualité Guinée », « Conakry », noms d'émissions) est inexploité : aucun contenu textuel réel, donc rien à positionner aujourd'hui.

---

### AXE 9 — Performance et optimisation

**Mesures réelles (build local du 31/10 + HTTP production) :**

| Route | Taille HTML | First Load JS (build) |
|---|---|---|
| `/` | 77,4 kB | **117 kB** |
| `/videos` | 48,2 kB | 116 kB |
| `/videos/[slug]` | 54,6 kB | 108 kB |
| `/partenariats` | 50,8 kB | **200 kB** (la plus lourde) |
| `/contact` | 37,0 kB | 192 kB |

**Points conformes :**
- **Site 100 % statique** (prerender/SSG) : pas de calcul serveur, cache CDN Vercel (`X-Vercel-Cache: HIT` vérifié).
- **First Load JS partagé : 103 kB** — très raisonnable ; l'extra de `/partenariats` (200 kB) vient du trio React Hook Form + Zod + client Supabase (~85-90 kB), seul point d'amélioration (import dynamique du formulaire).
- **Iframes lazy** : YouTube au clic, OpenStreetMap `loading="lazy"` (`app/contact/page.tsx:66-71`) → pas de requête tierce au chargement initial.
- **Polices via `next/font`** (self-hostées, `layout.tsx:8-13`) → pas de requête Google Fonts bloquante, pas de layout shift de police.
- **0 image** = 0 octet d'image (le revers de la médaille UX/SEO).
- Animations CSS (marquee, ping, transitions) + un seul IntersectionObserver — pas de lib d'animation.

**Limites :** Lighthouse/Core Web Vitals **NON MESURÉS** (pas de navigateur dans l'environnement d'audit — aucune note inventée). Le poids des pages HTML (37-77 kB) et la stratégie statique permettent d'attendre d'excellents LCP/CLS pour une audience mobile guinéenne ; le marquee permanent et les animations `animate-ping` continues consomment du CPU/GPU sur téléphones modestes — point de vigilance INP.

---

### AXE 10 — DevOps, GitHub et Vercel

**Vérifié :**
- **Vercel** : projet lié `prj_gTzhJcHZ7i2dzInMakbKsSpxm1RR` (`.vercel/project.json`), déploiement depuis GitHub `origin/main`, production en ligne et cohérente avec le code local.
- **Build** : `npm run build` exit 0, 17 pages, Next 15.5.24. Scripts npm minimaux (`dev`, `build`, `start`).
- **Git** : branche unique `main`, 3 commits (28/08/2026), arborescence propre avant ET après audit, `.gitignore` correct (`.env*` exclus — **sauf doublon `.vercel` lignes 16 et 18**, cosmétique).
- **Journal de déploiement Vercel** : non consulté (pas d'accès dashboard) — aucune erreur de déploiement inférable : la prod sert bien le build.

**Faiblesses :**
| # | Faiblesse | Détail |
|---|---|---|
| D1 | **Variables d'environnement absentes en prod** | Preuve bundle (cf. AXE 3) — le site tourne en mode démo |
| D2 | **Aucun CI** | Pas de workflow GitHub Actions : ni test, ni lint, ni audit automatisés |
| D3 | **Aucun test automatisé** | 0 fichier de test |
| D4 | **Dépendances datées d'août + vulnérabilités** | Next 15.5.24 (advisories critiques), Zod 3.24.1, postcss, sharp, source-map-js (détails AXE 4/section 6) |
| D5 | **Aucune stratégie d'environnement** | Un seul environnement (production) ; pas de preview documentée |
| D6 | **Sauvegarde/repliement** | Sans objet actuel (site statique redéployable depuis GitHub) ; deviendra critique avec Supabase (données leads/messages non sauvegardées) |
| D7 | `next-env.d.ts` gitignoré (l.6) — écart avec la convention Next (généralement commité) ; sans impact | `.gitignore:6` |

---

### AXE 11 — Contenu éditorial et crédibilité du média

**Classement du contenu (vérifications réelles) :**

| Contenu | Classement | Preuve |
|---|---|---|
| 8 titres/résumés/dates/durées/vues des vidéos | **FICTIONNEL** | `lib/videos.ts:36-127` + oEmbed (toutes → Big Buck Bunny) |
| Badge « En direct » sur Le Grand Journal | **FICTIONNEL** (aucun live) | `lib/videos.ts:48` (`live: true`) |
| 4 flash-infos | **FICTIONNEL FIGÉ** (depuis 28/08) | `lib/videos.ts:25-30` |
| « 12 800 vues », « 19 800 vues »… | **INVENTÉS** (aucune mesure) | `lib/videos.ts` |
| Citation du PDG « Notre ambition est simple… » | **AUTHENTICITÉ NON VÉRIFIÉE** | `app/partenariats/page.tsx:48-53` |
| 4 pôles de prestations + gammes de budget | **DÉCLARATIF NON VÉRIFIÉ** | `ServicesGrid.tsx:10-39`, `PartnershipForm.tsx:139-145` |
| Téléphone/WhatsApp +224 662 860 976 | **PRÉSUMÉ RÉEL** (fourni par le client à la création, jamais re-confirmé depuis) | Footer, contact, wa.me |
| Adresse Kaloum, Sans-Fil, Immeuble Mbemba Diaby | **PRÉSUMÉE RÉELLE, NON VÉRIFIÉE** | `app/contact/page.tsx:29-31` ; carte OSM centrée approximativement |
| Email contact@bonnehumeur.tv | **PLACEHOLDER NON CONFIRMÉ** | README l.77 « à personnaliser » |
| Plaquette institutionnelle PDF | **N'EXISTE PAS** (404) | HTTP |
| « Audience croissante », « Partenaires institutionnels » | **DÉCLARATION NON PROUVÉE** | `B2BCta.tsx:41-44` |

**Risque de crédibilité : ÉLEVÉ.** Le site présente des statistiques et émissions fictives comme réelles. Pour un média — dont le capital est la confiance — si un annonceur institutionnel clique une « interview du ministère » et découvre Big Buck Bunny, le préjudice relationnel est immédiat. **Recommandation immédiate sans code : mentionner « site en préparation » ou remplacer les mocks par de vrais contenus dès disponibles.**

---

### AXE 12 — Aspects légaux et conformité

**État constaté : AUCUN CADRE LÉGAL.** Vérifié par inventaire complet : aucune route `/mentions-legales`, `/confidentialite`, `/cgu` ; aucun texte juridique dans le code.

| Élément requis | État |
|---|---|
| Mentions légales (éditeur, directeur de publication, hébergeur) | ❌ ABSENT |
| Politique de confidentialité | ❌ ABSENTE |
| Information sur le traitement des données collectées (formulaires : nom, email, tél) | ❌ ABSENTE |
| Base légale de la collecte (consentement/intérêt légitime) | ❌ NON DOCUMENTÉE |
| CGU | ❌ ABSENTES |
| Droits d'utilisation des vidéos affichées (toutes → film Blender sous **licence Creative Commons Attribution 3.0**, qui exige l'attribution — aucune attribution affichée) | ⚠️ **RISQUE RÉEL DE LICENCE** : diffusion sans crédit |
| Bandeau cookies | Non requis aujourd'hui (aucun cookie déposé ; seul `localStorage` pour le thème) — à réévaluer si analytics ajouté |
| Responsable du traitement identifié | ❌ NON |

**⚠️ Point à traiter en priorité parmi les sujets légaux : l'attribution Creative Commons du film Blender actuellement diffusé sur toutes les fiches** (exigence de la licence CC-BY : créditer l'auteur — absent, et la présentation laisse entendre qu'il s'agit d'une production Bonne Humeur TV).

**Non-conformité juridique à faire valider par un professionnel du droit guinéen** (loi guinéenne sur la protection des données à caractère personnel + obligations d'un média en ligne) — cet audit ne certifie aucune conformité.

---

## 5. TABLEAU DES FONCTIONNALITÉS

| # | Fonctionnalité | État | Preuve | Impact | Action recommandée |
|---|---|---|---|---|---|
| F1 | Navigation 4 liens (header/footer) | ✅ Fonctionnelle | HTML + HTTP 200 ×5 | — | — |
| F2 | Menu mobile burger | ✅ Fonctionnelle | `Header.tsx:86-103` (test code, pas de clic réel) | — | Test réel mobile |
| F3 | Bandeau flash-infos défilant | ⚠️ Partielle | `BreakingNews.tsx:15` — animation OK, contenu fictif figé | Crédibilité | Rendre administrable |
| F4 | Lecteur hero lazy (clic → iframe) | ⚠️ Partielle | `HeroPlayer.tsx:19-27` — technique OK, contenu = Big Buck Bunny | Crédibilité majeure | Vrais IDs YouTube |
| F5 | Badge « En direct » | ❌ Non conforme | `lib/videos.ts:48` — faux direct | Crédibilité | Retirer ou brancher un vrai live |
| F6 | Filtres catégories | ✅ Fonctionnelle | `VideosGallery.tsx:43-61`, `VideosGrid.tsx:27-42` | — | Dédupliquer le composant |
| F7 | Recherche instantanée | ✅ Fonctionnelle | `VideosGallery.tsx:16-26, 30-41` | — | Prévoir recherche serveur si volume ↑ |
| F8 | Pagination « Charger plus » | ✅ Fonctionnelle | `VideosGallery.tsx:70-83` | — | — |
| F9 | Fiche vidéo (titre, vues, date, partage) | ⚠️ Partielle | `videos/[slug]/page.tsx` OK mais données inventées | Crédibilité | Données réelles |
| F10 | Recommandations | ✅ Fonctionnelle | `lib/videos.ts:133-138` | — | — |
| F11 | Partage WhatsApp/Facebook/copier | ✅ Fonctionnelle | `ShareButtons.tsx` (wa.me, sharer, clipboard) | — | — |
| F12 | **Formulaire de contact** | ❌ **Non fonctionnelle (mode démo)** | Preuve bundle : `env` non résolues → `console.log("[DEMO]")` | **Levée commerciale bloquée** | Brancher Supabase + couche serveur |
| F13 | **Formulaire devis B2B** | ❌ **Non fonctionnelle (mode démo)** | Idem `PartnershipForm.tsx:38-43` | **Levée commerciale bloquée** | Idem |
| F14 | **Téléchargement plaquette PDF** | ❌ **Non fonctionnelle (404)** | HTTP 404, `public/` absent | CTA B2B cassé | Créer le PDF |
| F15 | Bouton WhatsApp flottant | ✅ Fonctionnelle | `WhatsAppFloat.tsx` + wa.me dans HTML | — | — |
| F16 | Carte OSM | ✅ Fonctionnelle | iframe lazy `contact/page.tsx:66-71` | — | — |
| F17 | Page 404 | ✅ Fonctionnelle | HTTP 404 + page | — | Personnaliser avec les couleurs |
| F18 | Dark mode + persistance | ⚠️ Partielle | `store/theme.ts` OK ; FOUC si thème clair (A1-5) | Mineur | Script pré-hydratation |
| F19 | SEO dynamique par vidéo | ✅ Fonctionnelle | `generateMetadata` `videos/[slug]/page.tsx:17-36` | — | Compléter canonical |
| F20 | Canonical / sitemap / robots / JSON-LD | ❌ Non développée | 404 + grep HTML | SEO | Implémenter |
| F21 | Miniatures vidéo | ❌ Non développée | 0 `<img>` sur le site | UX + SEO | `i.ytimg.com` via next/image |
| F22 | Administration (contenus, leads, messages) | ❌ Non développée | Aucune route admin/auth | Autonomie nulle | CMS minimal |
| F23 | Mentions légales / confidentialité | ❌ Non développée | Inventaire | Risque juridique | Pages légales |
| F24 | Emails cliquables | ❌ Non développée | 0 `mailto:` | Mineur | Ajouter le lien |

---

## 6. REGISTRE DES VULNÉRABILITÉS

| ID | Vulnérabilité | Gravité | Emplacement | Impact / scénario | Correction |
|---|---|---|---|---|---|
| VULN-01 | **Next.js 15.5.24 affecté par 4 advisories** : GHSA-4jqv-mc3x-m676 & GHSA-mcj8-r9mp-w47p (cache poisoning SSG/ISR inter-utilisateurs), GHSA-2464-fhr4-w9xw (**RCE non authentifié** dans l'API d'optimisation d'images via SVG), GHSA-p3m5-59mp-jv5r (DoS Server Actions) | **ÉLEVÉ** (atténué par : hébergement Vercel gérant l'optimisation d'images, aucune Server Action, aucun ISR dynamique — mais advisories CRITIQUES au sens npm audit) | `package.json:22` (`next ^15.3.0` → installé 15.5.24) | Théorique sur cette instance (statique, Vercel) ; devient concret en cas de self-hosting ou d'usage d'images/ISR | Mettre à jour Next.js (dernière 15.x patchée, puis migration 16.x planifiée) ; vérifier `npm audit` à 0 |
| VULN-02 | **Formulaires publics sans aucune protection serveur** — insertion directe navigateur→base avec policy `insert to anon with check (true)` : pas de captcha, pas de rate limiting, pas de honeypot, validation Zod **client uniquement** | **ÉLEVÉ** (faille latente : s'active au branchement Supabase) | `ContactForm.tsx:30-43`, `PartnershipForm.tsx:36-60`, `README.md:44-45` | Dès le branchement : spam massif automatisé de `contact_messages`/`partnership_requests`, pollution de la base, épuisement du quota Supabase | Couche serveur (API Route/Server Action) + validation Zod partagée + hCaptcha/Turnstile + rate limiting + policy INSERT restreinte |
| VULN-03 | **En-têtes de sécurité absents** : pas de CSP, X-Frame-Options/frame-ancestors, X-Content-Type-Options, Referrer-Policy, Permissions-Policy | **MOYEN** | `next.config.ts` (aucune section `headers()`) ; preuve `curl -I` (seul HSTS présent) | Clickjacking de la page (site embeddable en iframe, avec iframes tierces YouTube/OSM), MIME-sniffing | Ajouter `headers()` : CSP autorisant youtube-nocookie/openstreetmap, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` |
| VULN-04 | **Zod 3.24.1 vulnérable** — GHSA-mrhx-c7xc-m3w5 : exhaustion mémoire lors de la validation de collections surdimensionnées | **MOYEN** (client-only aujourd'hui → exploitabilité faible ; deviendra serveur) | `package.json:21` | DoS théorique de la validation | Migrer Zod ≥ 4.6.6 (changement majeur : planifier la migration des schémas) |
| VULN-05 | **Dépendances build affectées** : postcss ≤8.5.22 (XSS `</style>` non échappé, path traversal sourceMappingURL), sharp/librsvg CVE-2026-96889, source-map-js ≤1.2.1 (DoS event-loop), postcss-selector-parser <6.1.5 | **FAIBLE** (outils de build surtout) | `package-lock.json` | Limité au build local (les builds Vercel utilisent leur chaîne) | `npm audit fix` + mise à jour de routine |
| VULN-06 | **Architecture d'écriture 100 % client** — la seule clé utilisable est publique (anon) ; impossible de protéger un flux de leads (données commerciales sensibles) ni d'ajouter le moindre secret | **MOYEN** (conception) | `lib/supabase.ts`, absence totale de code serveur | Toute donnée future serait insérable/lisible selon les policies ; pas de logique confidentielle possible | Introduire des API Routes/Server Actions (secret côté serveur uniquement), RLS fine, service_role jamais exposé |
| VULN-07 | **Collecte de données personnelles (nom, email, téléphone, organisation) sans information légale** ni base légale documentée ; en mode démo, collecte déclarée mais non effectuée (trompeuse) | **MOYEN** (juridique) | Formulaires + absence de pages légales | Exposition à obligations de protection des données (droit guinéen + éventuels visiteurs UE) | Politique de confidentialité + mentions légales AVANT activation des insertions ; validation par un juriste |

**Vulnérabilités RECHERCHÉES et NON TROUVÉES (preuves négatives) :** XSS par injection React (0 sink), secrets en dur (0), injection SQL (0 SQL), IDOR (0 donnée à accès restreint), CSRF exploitable (0 session/cookie), clés exposées dans le dépôt Git (`.env*` ignorés, aucun historique de secret dans les 3 commits).

---

## 7. DETTE TECHNIQUE

| # | Élément de dette | Type | Emplacement |
|---|---|---|---|
| DT1 | 8 vidéos mock + 4 flash-infos codés en dur | Contenu/code mélangés | `lib/videos.ts:25-127` |
| DT2 | Backend absent (tables, clés, couche serveur) | Inachevé | `README.md:20-45`, `lib/supabase.ts` |
| DT3 | Aucun espace d'administration | Non développé | — |
| DT4 | Dépendances obsolètes/vulnérables (Next, Zod, postcss, sharp) | Maintenance | `package-lock.json` |
| DT5 | `class-variance-authority` inutilisée | Dépendance morte | `package.json:13` |
| DT6 | Config `images.remotePatterns` sans `next/image` | Config morte | `next.config.ts:4-10` |
| DT7 | Duplication des puces de filtres | Duplication | `VideosGrid.tsx` vs `VideosGallery.tsx` |
| DT8 | État global de filtres partagé accueil/galerie | Conception | `store/filters.ts` |
| DT9 | FOUC thème | Conception | `layout.tsx:53`, `Header.tsx:22-24` |
| DT10 | Aucun test, aucun ESLint, aucun CI | Processus | — |
| DT11 | SEO infra manquant (canonical, sitemap, robots, JSON-LD) | Inachevé | — |
| DT12 | Pages légales inexistantes | Inachevé | — |
| DT13 | Plaquette PDF promise/absente | Contenu manquant | `public/` |
| DT14 | Doublon `.vercel` dans `.gitignore` (l.16/l.18) | Cosmétique | `.gitignore` |
| DT15 | Attribution CC-BY manquante pour le film Blender diffusé | Licences | Toutes les fiches vidéo |

---

## 8. MATRICE DES RISQUES

| Risque | Gravité | Probabilité | Niveau | Commentaire |
|---|---|---|---|---|
| Préjudice de crédibilité (fausses émissions, Big Buck Bunny, faux direct, fausses stats) | Élevée | **Quasi certaine** (tout visiteur cliquant une vidéo) | 🔴 CRITIQUE | Risque n°1 — commercial et réputationnel |
| Perte de leads commerciaux (formulaires muets + succès trompeur) | Élevée | **Certaine** (mode démo prouvé) | 🔴 CRITIQUE | Le site ne remplit pas sa fonction B2B |
| Spam/abus des formulaires dès branchement Supabase sans protection | Élevée | Élevée (bots scannent les domaines publics) | 🟠 ÉLEVÉ | À traiter AVANT l'activation |
| Vulnérabilités dépendances (VULN-01, 04) | Moyenne-élevée | Faible sur cette instance (atténuations Vercel) | 🟠 ÉLEVÉ | Mise à jour simple |
| Risque juridique données personnelles + licence CC-BY | Moyenne | Moyenne (croît avec le trafic) | 🟡 MOYEN | Cadre légal absent |
| Clickjacking/absence d'en-têtes (VULN-03) | Faible-moyenne | Faible | 🟡 MOYEN | Correction triviale |
| Dépendance à un développeur pour tout contenu (pas d'admin) | Moyenne | Certaine (structurelle) | 🟡 MOYEN | Frein opérationnel majeur |
| Déploiement d'une régression (0 test, 0 CI) | Moyenne | Moyenne | 🟡 MOYEN | Toute modification est non protégée |
| Indépendance du média vis-à-vis de YouTube (pas d'alternative) | Faible | Moyenne | 🟢 FAIBLE | Architecturalement assumé |

---

## 9. RECOMMANDATIONS HIÉRARCHISÉES

### P0 — CRITIQUE, intervention immédiate

| # | Action | Problème → Objectif | Fichiers/modules | Dépendances | Critères de vérification |
|---|---|---|---|---|---|
| P0-1 | **Remplacer les 8 IDs YouTube + métadonnées par du contenu réel** (ou vider la grille + bandeau « Lancement prochainement ») | Big Buck Bunny sur toutes les vidéos → contenu authentique | `lib/videos.ts` | Fournir les vrais IDs par le client | oEmbed de chaque ID = vidéo de la chaîne ; titres/dates conformes |
| P0-2 | **Retirer le badge « En direct » et les compteurs de vues fictifs** | Mensonge affiché → honnêteté | `lib/videos.ts:48`, `VideoCard.tsx:60-66` | Aucune | Aucun « En direct » sans live réel |
| P0-3 | **Corriger le lien plaquette PDF** (créer le PDF ou retirer le bouton) | CTA B2B 404 → CTA fonctionnel | `app/partenariats/page.tsx:32-39`, `public/` | Plaquette du client | `GET /plaquette-institutionnelle.pdf` → 200 |
| P0-4 | **Mettre à jour Next.js** (dernière 15.x patchée) | Advisories critiques → version corrigée | `package.json` | Rebuild + test des 5 routes | `npm audit` sans advisory `next` ; prod 200 ×5 |
| P0-5 | **Ajouter l'attribution Creative Commons** si le film Blender reste temporairement en place | Licence CC-BY non respectée → conforme | Fiches vidéo | Aucune | Crédit « © Blender Foundation, CC-BY 3.0 » visible |

### P1 — HAUTE priorité

| # | Action | Problème → Objectif | Fichiers/modules | Dépendances | Critères |
|---|---|---|---|---|---|
| P1-1 | **Brancher Supabase** : créer projet + exécuter le SQL du README (tables, RLS, policies) + configurer les 2 variables sur Vercel | Formulaires muets → leads enregistrés | Dashboard Supabase + Vercel | P2-1 recommandé avant (sinon spam) | Test réel : message inséré, visible en base |
| P1-2 | **Couche serveur pour les formulaires** (API Route ou Server Action) : validation Zod partagée, hCaptcha/Turnstile, rate limiting, messages d'erreur réels | VULN-02 (spam + fausse sécurité client) | Nouveaux `app/api/*`, refactor des 2 formulaires | P1-1 | Insertion uniquement via serveur ; captcha obligatoire ; test de spam bloqué |
| P1-3 | **En-têtes de sécurité** via `headers()` dans `next.config.ts` | VULN-03 | `next.config.ts` | Aucune | `curl -I` montre CSP, X-Frame-Options, nosniff, Referrer-Policy |
| P1-4 | **Pages légales** : mentions légales (éditeur, directeur de publication, hébergeur) + politique de confidentialité | VULN-07 | Nouvelles pages + liens footer | Validation juriste (droit guinéen) | Pages accessibles depuis le footer |
| P1-5 | **Miniatures réelles** (`i.ytimg.com/vi/<id>/hqdefault.jpg` via `next/image`, `alt` = titre) | 0 image → UX + SEO | `VideoCard.tsx`, `next.config.ts` (déjà autorisé) | Vrais IDs (P0-1) | `<img>` avec `alt` sur chaque carte |
| P1-6 | **Migrer Zod ≥ 4.6.6** | VULN-04 | `package.json`, schémas | Revalidation des formulaires | `npm audit` sans advisory zod |

### P2 — PRIORITÉ NORMALE

| # | Action | Problème → Objectif | Fichiers | Critères |
|---|---|---|---|---|
| P2-1 | **SEO infra** : `sitemap.ts`, `robots.ts`, `canonical` (metadata), JSON-LD `VideoObject` + `Organization` + `BreadcrumbList` | Indexabilité médiocre → base SEO complète | `app/sitemap.ts`, `app/robots.ts`, `app/layout.tsx`, fiches vidéo | `/sitemap.xml` 200, `/robots.txt` 200, canonical dans le HTML, JSON-LD validé (Rich Results Test) |
| P2-2 | **Migrations Next 16.x + React** planifiées | Endettement de version | `package.json` | Build + 5 routes OK |
| P2-3 | **Qualité** : ESLint (config Next), CI GitHub Actions (tsc + build + npm audit), premiers tests (formatDate/formatViews, schémas Zod) | 0 filet de sécurité → CI verte | Nouveaux fichiers config/workflow | CI verte sur PR |
| P2-4 | **Nettoyage** : supprimer `class-variance-authority` et la config `images` morte ; dédupliquer `FilterChips` ; corriger le FOUC ; `mailto:` sur l'email ; reset du store filtres | Dette structurelle | `package.json`, `next.config.ts`, composants, `store/filters.ts` | grep = 0 occurence cva ; pas de flash au chargement en thème clair |
| P2-5 | **Confirmer les coordonnées réelles** (email, horaires, adresse, citation PDG) avec le client | Placeholders → informations vérifiées | `Footer.tsx`, `app/contact/page.tsx`, `app/partenariats/page.tsx` | Validation écrite du client |

### P3 — ÉVOLUTION FUTURE

| # | Action | Objectif |
|---|---|---|
| P3-1 | **CMS minimal** : Supabase Auth + rôle admin, CRUD vidéos/flash-infos via une page `/admin` protégée, table `videos` (remplace `lib/videos.ts`), lecture des leads | Autonomie éditoriale sans développeur |
| P3-2 | **Import automatique** de la chaîne YouTube (API YouTube Data v3 : dernières vidéos, miniatures, durées) | Fraîcheur du contenu sans saisie manuelle |
| P3-3 | **Vraie page direct** : lecteur YouTube live + planning des émissions | « Télé de la nouvelle génération » crédible |
| P3-4 | **Analytics** (Vercel Analytics ou Plausible) + Core Web Vitals suivis | Pilotage de l'audience |
| P3-5 | **Flux éditorial** : catégories administrables, archives, recherche serveur, articles/actualités | Plateforme média complète |
| P3-6 | **404 personnalisée** aux couleurs de la marque | Finition |

---

## 10. FEUILLE DE ROUTE DE DÉVELOPPEMENT

**Phase 1 — Stabilisation et honnêteté (complexité FAIBLE, aucune dépendance)**
P0-1 → P0-5, P2-5. Le site cesse d'afficher du faux. *Peut être livré en une session.*

**Phase 2 — Sécurité et base technique (complexité FAIBLE-MOYENNE)**
P0-4, P1-3, P2-2, P2-3, P2-4. Fondations saines avant d'ouvrir des écritures. *Dépend de rien ; conditionne la Phase 3.*

**Phase 3 — Finalisation du backend (complexité MOYENNE)**
P1-1 + P1-2 + P1-4 (légal AVANT activation des insertions collectant des données personnelles) + P1-6. **Point de non-retôle : à ce moment le site reçoit de vraies données → sauvegardes Supabase à activer.** *Dépend des Phases 1-2.*

**Phase 4 — Contenu et présentation (complexité FAIBLE-MOYENNE)**
P1-5, P2-1 (SEO), plaquette réelle, tests réels mobiles. *Dépend de P0-1 (vrais IDs).*

**Phase 5 — Administration / CMS (complexité ÉLEVÉE)**
P3-1 (+ P3-2 recommandé dès cette phase). Auth Supabase, table `videos`, interface admin, gestion des leads. *Dépend des Phases 2-3. C'est la phase qui transforme la vitrine en média exploitable.*

**Phase 6 — Exploitation professionnelle (complexité MOYENNE, continue)**
P3-3 (direct), P3-4 (analytics), P3-5 (flux éditorial), process de contenu, veille de dépendances trimestrielle. *Dépend de la Phase 5.*

---

## 11. SCORE DE MATURITÉ (0-10, justifiés par les preuves ci-dessus)

| Dimension | Note | Justification |
|---|---|---|
| Architecture | **7** | App Router canonique, composants propres, TS strict ; pénalités : duplication (A1-1), config morte (A1-3), couplage d'état (A1-4) |
| Qualité du code | **7** | `tsc` 0 erreur, code idiomatique, commentaires utiles ; pénalités : 0 test (A1-6), 0 lint (A1-7) |
| Fonctionnalités | **5** | UI complète et fonctionnelle (F1-F11, F15-F19), mais 2 formulaires muets (F12-13), CTA PDF 404 (F14), 0 admin (F22) |
| Backend | **1** | Rien en production : clés absentes (preuve bundle), tables non connectées, 0 serveur ; +1 pour le design null-safe et le SQL documenté |
| Sécurité | **4** | Surface d'attaque quasi nulle et 0 XSS par construction (+), mais advisories critiques non corrigés (VULN-01), faille latente anti-spam (VULN-02), 0 en-tête (VULN-03) |
| Administration | **0** | Rien n'existe — vérifié (AXE 6) |
| UX/UI | **7** | Identité forte, responsive soigné, états vides/erreurs gérés ; pénalités : 0 miniature (U1), FOUC (U3), email non cliquable (U2), marquee sans pause (U6) |
| SEO | **5** | Titres/OG/Twitter exemplaires (+), mais 0 canonical/sitemap/robots/JSON-LD et 0 image (AXE 8) |
| Performance | **8** | 100 % statique, JS 103-200 kB, lazy intelligent, polices optimisées ; non mesuré sur devices réels (limite d'audit) |
| DevOps | **5** | Vercel/GitHub opérationnels et déployés (+), mais 0 variable d'env, 0 CI, 0 test, dépendances vulnérables, 1 seul environnement |
| Exploitation professionnelle | **2** | Site en ligne mais : contenu 100 % fictif, leads perdus, légal absent, admin absente, coordonnées non confirmées |
| **MOYENNE GLOBALE** | **4,6 / 10** | Vitrine techniquement saine, média inexistant |

---

## 12. VERDICT FINAL

**1. Le site est-il réellement opérationnel ?**
**Oui techniquement, non fonctionnellement.** Toutes les routes répondent (200), le build passe, l'UI est complète et rapide. Mais les fonctions cardinales d'un média (recevoir des messages, recevoir des demandes de partenariat, montrer de vraies émissions) sont **inexistantes ou trompeuses** : formulaires en mode démo prouvé par le bundle, 8 vidéos qui jouent toutes *Big Buck Bunny*, badge « En direct » faux, plaquette 404.

**2. Peut-il être exploité professionnellement aujourd'hui ?**
**Non.** Il n'y a ni backend, ni administration, ni cadre légal, ni contenu réel, ni coordonnées vérifiées. Sa seule valeur professionnelle actuelle est d'exister en ligne avec une identité visuelle crédible et le WhatsApp (seul canal de contact réellement fonctionnel).

**3. Quels sont ses principaux risques ?**
① Crédibilité (contenu fictif présenté comme réel — quasi certain de survenir dès qu'un annonceur clique une vidéo). ② Perte intégrale des leads B2B (succès affiché, message perdu). ③ Spam/abus dès branchement non protégé de Supabase. ④ Vulnérabilités de dépendances non corrigées. ⑤ Risque juridique (données personnelles, licence CC-BY non respectée).

**4. Quelles sont les corrections indispensables ?**
Les P0 : vrai contenu vidéo (ou retrait honnête des mocks), fin du badge « En direct » et des compteurs fictifs, correction du lien PDF, mise à jour Next.js, attribution CC-BY. Puis les P1 : Supabase + couche serveur sécurisée, en-têtes, légal, miniatures.

**5. Faut-il conserver l'architecture actuelle ou la revoir ?**
**Conserver.** L'architecture Next.js App Router statique + Tailwind + lazy YouTube est adaptée (coût Vercel ~0, adaptée aux connexions guinéennes) et le code est sain (TS strict, tsc 0, 0 XSS sink). Il faut la **compléter** (couche serveur pour les formulaires, CMS, SEO infra), pas la réécrire. Les seuls remaniements internes nécessaires sont mineurs (déduplication, store, FOUC).

**6. Quel est le chemin le plus pertinent pour terminer le projet ?**
Suivre la feuille de route en 6 phases : **honnêteté immédiate (Phase 1)** → **socle sécurité/qualité (Phase 2)** → **backend sécurisé + légal (Phase 3)** → **contenu réel + SEO (Phase 4)** → **CMS (Phase 5)** → **exploitation média (Phase 6)**. Les Phases 1-2 sont rapides et sans dépendance externe ; la Phase 3 exige les décisions du client (projet Supabase, validation juridique, plaquette) ; la Phase 5 est le vrai investissement de développement. Le site est à ~2 sessions de travail d'un état honnête et sécurisé, et à une phase CMS d'une autonomie éditoriale complète.

---

## 13. ANNEXES

### A. Commandes réellement exécutées (chronologiquement)

```
git log --oneline --stat ; git log --format="%h %ad %an %s" ; git status --porcelain ; git branch -a ; git remote -v
find . -type f -not -path "./node_modules/*" -not -path "./.git/*" -not -path "./.next/*"
(lecture intégrale des 37 fichiers du projet via l'outil de lecture)
npx tsc --noEmit                      → échec initial : .next/types absent avant build (artefact d'environnement)
npm run build                         → SUCCÈS exit 0 (Next 15.5.24, 17 pages, tailles par route)
npx tsc --noEmit (2e exécution)      → SUCCÈS exit 0
npm audit ; npm audit --omit=dev     → 6 vulnérabilités (1 critique, 4 élevées, 1 modérée)
grep -rn "dangerouslySetInnerHTML|innerHTML|eval(" ...     → 0 occurrence
grep -rn "supabase.co|eyJ|sk_|pk_|API_KEY|SECRET" ...      → 0 secret (1 pattern hostname inoffensif)
ls .env*                              → seul .env.local.example
curl (10 URLs production)             → 200×5 pages, 404×5 (inconnu, PDF, robots, sitemap, favicon.ico)
curl -I https://…/                    → HSTS seul, aucun autre en-tête de sécurité
curl youtube.com/oembed (aqz-KE-bpKQ) → « Big Buck Bunny 60fps 4K — Blender Foundation »
curl bundles JS (9 chunks) + grep     → NEXT_PUBLIC_SUPABASE_URL non résolu en production
grep aria-label/H1/img/mailto/wa.me dans HTML déployé → comptages rapportés aux axes 7-8
grep class-variance-authority|next/image → 0 utilisation
find *.test.*|*.spec.* ; ls eslint*   → 0 test, 0 config lint
git status --porcelain (fin)          → PROPRE, HEAD 9351a77 inchangé
```

### B. Résultats des vérifications

- **Build production : RÉUSSI** — 17 pages (`/` 117 kB, `/contact` 192 kB, `/partenariats` 200 kB, `/videos` 116 kB, `/videos/[slug]` 108 kB First Load JS).
- **TypeScript : RÉUSSI** (strict, exit 0).
- **HTTP production : 10/10 comportements conformes** (5 pages 200, statuts d'erreur corrects).
- **Preuve mode démo : CONFIRMÉE** (variables d'environnement absentes du build Vercel).
- **npm audit : 6 vulnérabilités confirmées** (next critique ; zod, postcss, sharp, source-map-js élevées ; postcss-selector-parser modérée).
- **ESLint, tests, Lighthouse : NON EXÉCUTÉS** — ESLint : aucune configuration n'existe ; tests : aucun n'existe ; Lighthouse : pas de navigateur disponible dans l'environnement d'audit (aucune note inventée).

### C. Limites de l'audit

1. Dashboards Vercel/Supabase non accessibles (config cloud déduite par preuve bundle, tables Supabase non inspectables).
2. Aucun test d'interaction réel (clics, hydratation, navigation mobile) — pas de navigateur.
3. Core Web Vitals non mesurés ; pas de note Lighthouse.
4. Indexation Google et trafic réels non vérifiables (pas d'accès Search Console/Analytics).
5. Synchronisation local↔origin non revérifiée par fetch (le HTML déployé correspond néanmoins exactement au code local).
6. Audit légal informatif — ne vaut pas avis juridique ; faire valider par un professionnel du droit guinéen.

### D. État Git

- **Avant audit :** HEAD `9351a77` (« design:polices Inter/Archivo, icone SVG, image OG, animations Reveal, WhatsApp flottant, halos par categorie »), branche `main` (unique), `git status` vide, 3 commits au total.
- **Après audit :** HEAD `9351a77` inchangé, `git status` vide. **Aucun fichier source modifié, aucun commit, aucun push, aucun déploiement.** Le présent fichier `AUDIT_GLOBAL_BONNE_HUMEUR_TV.md` est le seul artefact créé (demandé par la mission).

---

*Fin du rapport d'audit — 31/10/2026. Audit réalisé en lecture seule stricte ; chaque affirmation est appuyée par une preuve citée (fichier:ligne, commande, ou mesure HTTP) ou explicitement marquée comme non vérifiable.*