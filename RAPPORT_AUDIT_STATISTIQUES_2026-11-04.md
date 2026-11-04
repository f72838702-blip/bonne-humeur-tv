# AUDIT + ARCHITECTURE RECOMMANDÉE — TABLEAU DE BORD STATISTIQUE · BONNE HUMEUR TV

**Date : 04/11/2026 · Branche `main` (ed3846f) · ÉTAT : AUDIT SEUL (étapes 1–3) — 0 code écrit, 0 migration préparée, 0 déploiement, 0 push · ATTENTE DE VOTRE VALIDATION avant implémentation (étape 4)**

---

## 1. Audit de l'architecture actuelle (réel, vérifié dans le code)

| Élément | Constat |
|---|---|
| Pages publiques | `app/actualites/[slug]` (articles), `app/videos`, `/contact`, `/partenariats`, `/`, `/recherche`, `app/actualites/categorie/[slug]` — layout racine unique `app/layout.tsx` |
| Zone admin | `/admin/*` protégée par middleware (matcher `/admin/:path*`) — la racine publique n'a AUCUN middleware → **instrumenter le public ne ralentit rien** |
| Cloudflare Workers | OpenNext `@opennextjs/cloudflare` 1.20 → les Route Handlers (ex. `app/ads/click`) tournent DANS le Worker → accès à `getCloudflareContext()` → **pays du visiteur disponible gratuitement** (`request.cf.country`), sans stocker l'IP |
| Middleware | matcher limité à `/admin` — la collecte côté navigateur est donc indépendante, zéro surcoût sur les pages publiques |
| Anti-abus existant (réutilisable) | RPC `record_ad_event` + table `ad_event_fingerprints` (0025) : **emprunte SHA-256(IP+UA)** journalière, JAMAIS d'IP brute — le même motif servira aux événements statistiques |
| Web Analytics Cloudflare | **non activé** dans ce projet aujourd'hui |
| Statistiques existantes | aucune — aucune table, aucune collecte, zéro doublon à éliminer |
| Taille/volume | site jeune, trafic modeste → agrégation à la volée avec index suffit ; pas de rollup lourd au départ |

## 2. Solution recommandée : collecte PROPRIÉTAIRE légère (Supabase + Worker) — et pourquoi pas Cloudflare Web Analytics

**Ce que Cloudflare WA fournit RÉELLEMENT** (vérifié) : visites, pages vues, pays, appareils, référents — affichés dans SON tableau de bord ou via API GraphQL. Il NE fournit PAS : événements personnalisés, temps d'engagement, lectures engagées par article, périodes de publication, ni rien d'exploitable dans VOTRE panneau (le GraphQL exige un token compte, un travail supplémentaire, et reste limité à ses métriques fixes).

**Décision** : le module statistique 100 % maison (zéro abonnement, zéro dépendance lourde, zéro service externe), qui couvre TOUTES vos exigences (engagement, articles, heures, drapeaux, export CSV). Cloudflare WA reste une *complément* gratuit activable un jour par la direction (jeton dans le dashboard) — jamais requis pour ce module. Honnêteté documentée côté rapport.

### Architecture (flux complet)
```
Navig. (client) ──page_view──▶ /api/analytics/track (Worker)
   ▲ session_id aléatoire                  │  pays = request.cf.country (Worker, GRÁTUIT)
   │ durée visible cumulée (heartbeat      │  provenance = en-tête Referer (classifiée
   │ 30 s max, uniquement page VISIBLE)    │  côté serveur, jamais côté navigateur)
   │ sendBeacon au départ (fiable)        │  appareil/navigateur = analyse UA côté serveur
   │                                       │  empreinte = sha256(IP+UA+jour) — anti-abus
   └──────engagement (upsert 1 ligne)────▶ Supabase RPC (function SQL security definer)
                                            │  GREATEST : jamais de baisse, jamais de
                                            │  doublon de comptage (1 ligne par page vue)
Onglet admin /admin/statistiques ◀── requêtes AGRÉGÉES indexées (staff RLS)
```

- **Tables (migration 0029, à préparer)** : `analytics_page_views` (1 ligne par page vue : session_id UUID aléatoire **éphémère** (sessionStorage), event_id UUID unique, chemin, type (article/autre), article_id FK nullable, appareil, navigateur, pays ISO-2, classe de provenance, engaged_ms default 0, empreinte anti-abus, created_at) + index (created_at, country, article_id, session).
- **1 seule ligne permanente par page vue** — les heartbeats METTENT À JOUR cette unique ligne (upsert `GREATEST`), jamais une ligne par pulse (exigence §8 stricte).
- **Définitions affichées (honnêtes, §3/§5)** : « Sessions estimées » = sessions uniques (jamais « personnes ») ; « Pages vues » = page_views ; **« Durée d'engagement estimée »** = temps cumulé page VISIBLE (onglet actif) — le temps de chargement n'entre jamais ; **« Lecture engagée »** = ≥ 30 s de consultation visible d'UN article (règle affichée dans l'interface) ; pages « abandonnées » = engagement < 10 s.
- **Agrégats** : toutes les cartes/graphiques = requêtes GROUP BY bornées à la période choisie, index créés pour ça. Aucune requête lourde non bornée.

## 3. Indicateurs & graphiques (tous sans dépendance, SVG maison léger)

1. **Cartes du haut** : Sessions estimées · Pages vues · Durée d'engagement estimée moyenne · Lectures d'articles · Taux de lecture engagée → **variation vs période précédente** (↗/↘ en %), avec une phrase d'explication courte sur chaque carte.
2. **A. Courbe d'évolution** : sessions + pages vues par jour, comparées en pointillés à la période précédente (pas de double échelle trompeuse).
3. **B. Pays** : classement avec **drapeaux** (emoji ISO) + counts + % ; bucket « Inconnu » visible quand le pays n'est pas disponible (jamais inventé) ; Guinée mise en avant naturellement. Carte géographique simple optionnelle par teintes (bâtir SVG simplifié Afrique/de-monde) — proposée si vous la voulez.
4. **C. Articles les plus lus** : titre, lectures, lecteurs uniques (sessions), temps moyen d'engagement, taux de lecture engagée, date de publication, variation vs période précédente — cliquables vers `/admin/statistiques/articles/[id]`(fiche détaillée) + **export CSV** de la liste filtrée.
5. **D. Provenance** : direct · recherche (google, bing…) · facebook · **whatsapp** · autres réseaux · sites externes · inconnu — classifiée SERVEUR depuis le Referer réel ; quand rien n'est disponible → « inconnu », jamais d'invention.
6. **E. Appareils** : mobile/ordinateur/tablette + navigateurs principaux (serveur, depuis l'UA) — barres simples.
7. **F. Jours × heures** : grille semaine (7×24) en teintes — **fuseau Conakry = UTC+0, aucun décalage à corriger**, les périodes de publication sont lisibles directement. Conseil auto : « Meilleures périodes pour publier » = les 3 cases les plus élevées.
8. **Filtres** : Aujourd'hui · Hier · 7 j · 30 j · 90 j · personnalisé — pilotés par URL (partage de vue possible), s'appliquent à TOUT, date de dernière actualisation affichée.

## 4. Fichiers prévus (estimation, à confirmer à l'étape 2 détaillée)

| Créés/Modifiés | Rôle |
|---|---|
| `supabase/migrations/0029_analytics_visitateur.sql` | table + RLS (anon INSERT via RPC uniquement ; staff SELECT ; JAMAIS d'accès aux lignes brutes depuis le navigateur) + 2 RPC + index + purge retenue |
| `lib/analytics/classes.ts` (pur) | classification référent/UA/pays + règles lecture engagée — **très testé** |
| `lib/analytics/collect.ts`, `components/analytics/TrackerStats.tsx` (client) | session éphémère, visible-only, heartbeat batché (≤ 1 req/30 s), sendBeacon départ, exclusions (chemins /admin, hosts dev/preview, bots UA, navigateur sans JS = rien collecté) |
| `app/api/analytics/track/route.ts` | Worker : pays CF, Referer/UA serveur, empreinte journalière, RPC, rate-limit, anti-bot |
| `app/admin/statistiques/page.tsx` (+ `articles/[id]`) | tableau de bord (cartes + graphiques SVG), filtre, états vides propres **sans aucune donnée fictive** |
| `app/admin/statistiques/export/route.ts` | CSV des données de la période (guard admin) |
| `lib/analytics/queries.ts` | agrégations (periodes, pays, articles, sources, appareils, grille 7×24, variations) |
| `components/admin/Sidebar.tsx` | entrée « Statistiques » (admin ; éditeur exclu conformément §11 « seuls les administrateurs ») |
| `app/confidentialite/page.tsx` | ajout d'une mention courte (aucune IP, aucune donnée nominative, anonymat, désactivation possible sur demande) |
| Tests (~15–20) | les 15 scénarios §12 en pur (visite, multi-pages, changement de route sans rechargement, départ immédiat, lecture longue, onglet arrière-plan, bot, admin exclu, sans géoloc, multi-pays, filtres, absence de données, non-autorisé…) + tsc/ESLint/build |

## 5. Risques, limites, protections (étape 3)

1. **Limites méthodologiques assumées et affichées** : le JavaScript est requis (bloqueurs → hors statistiques, mention honnête dans l'interface) ; « estimées » partout où l'exhaustivité n'est pas garantie ; bots filtrés (UA connus + `navigator.webdriver`), pas garantis à 100 %.
2. **Anti-abus** : empreinte journalière SHA-256 (motif des publicités 0025, JAMAIS d'IP) + plafond d'événements/heure/empreinte via RPC, chemins `/admin` jamais collectés, hosts dev/preview exclus, UA vides refusés.
3. **Cohérence multi-sessions** : session_id régénéré si > 30 min d'inactivité (convention des outils d'audience), changements de routes Next conservent la session AUCUN double comptage (1 page_view par route unique, event_id unique).
4. **Quotas vérifiés** : Supabase Free = 500 MB ; 1 ligne ~0,3 Ko → même **50 000 visites/mois ≈ 15 Mo/an** ; purge automatique proposée (retenue 12 mois) pour rester pérenne. Workers Free = 100 000 requêtes/jour ; 2–3 requêtes de collecte par visite → des dizaines de milliers de visites/jour laissaient la marge large. **Coût total : 0 USD/mois.**
5. **Vie privée (§9)** : aucune IP stockée, aucune empreinte nominative (anti-abus uniquement, rotée chaque jour), aucun cookie (sessionStorage éphémère), aucun profil individuel de navigation, aucune donnée sensible ; mentions légales actualisées ; les administrateurs ne sont JAMAIS comptés (chemins admin exclus du tracker) ; les visiteurs voient une mention honnête si vous la voulez dans la page Confidentialité — à valider avec vous.
6. **RLS** : nouvelle table jamais affaiblie ; politiques en lecture via SELECT staff uniquement ; INSERT/UPDATE réservés aux RPC SQL avec empreinte (aucune mutation directe depuis le navigateur) ; aucune table existante touchée.

## 7. Ce qui reste pour les étapes 4–6 (APRÈS votre validation)

Implémentation complète → tests (les 15 scénarios + tsc/ESLint/vitest + build + compatibilité OpenNext/Workers + Supabase Free) → correction → **rapport final détaillé**. Migration 0028-0029, déploiement Cloudflare et push GitHub ne se feront QUE sur votre autorisation expresse, comme à l'accoutumée.

---

**Décision à prendre avant que je code** : (a) valider cette architecture propriétaire (recommandée) ; (b) la carte/mapping des pays en SVG — oui/non ; (c) acceptez-vous l'ajout de la mention de confidentialité dans la page Confidentialité (texte court, honnête) ? Les autres choix (déploiement, migration, push) resteront, comme toujours, à votre autorisation expresse.