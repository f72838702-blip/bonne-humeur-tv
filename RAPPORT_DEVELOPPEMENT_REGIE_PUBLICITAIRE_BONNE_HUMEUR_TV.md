# RAPPORT DE DÉVELOPPEMENT — RÉGIE PUBLICITAIRE BONNE HUMEUR TV

**Date : 03/11/2026 — branche `feature/regie-publicitaire` — dépôt local `C:\Users\alpha\bonne-humeur-tv`**
**Budget consommé : 0 USD de service supplémentaire (absolu respecté).**

---

## 1. Synthèse de la mission

Régie publicitaire professionnelle intégrée au CMS Bonne Humeur TV : annonceurs,
campagnes (machine à états), 5 formats de créations, 8 emplacements à codes stables,
moteur de diffusion avec rotation déterministe, contrats + règlements manuels,
statistiques dédupliquées agrégées journalières, suivi d'impressions sans IP brute,
route de clic interne anti-open-redirect, module back-office complet, vitrine
partenaires, exports CSV. **Aucune migration distante appliquée, aucun déploiement
Cloudflare, aucun push, aucune fusion dans main, aucun DNS modifié.**

## 2. Livrables par chantier

| Chantier | Contenu | État |
|---|---|---|
| A — audit préalable | base réelle vérifiée (10 migrations 0001→0024 live), conventions (requireRole, ActionState, CSP), bucket media LIVE 2 Mo | ✔ pré-commit 53fadc2 |
| B — noyau pur | `lib/ads/ads-core.ts` : formats, 8 emplacements, machine à états, rotation Efraimidis-Spirakis, CTR, paiements, CSV, empreintes — **20 tests** | ✔ 212d7a5 |
| C — schémas Zod | `lib/validation/ads-schemas.ts` (+ dossier `advertising` dans lib/media/variants) — **14 tests** | ✔ 64531cd |
| D — actions serveur | `lib/actions/ads.ts` : annonceurs, campagnes + transitions, créations + validation admin, emplacements, partenaires, règlements ADMIN, upload régie | ✔ 64531cd |
| E — lectures | `lib/data/ads.ts` (admin, sous RLS) + `lib/data/ads-public.ts` (fonctions SECURITY DEFINER + rotation) | ✔ 64531cd |
| F — pages admin | 10 routes sous `/admin/publicites` (dashboard, annonceurs + [id], campagnes + new + [id], emplacements, partenaires, statistiques, paiements) + nav « Publicités » (admin+editor) | ✔ 338c4a9 |
| G — formulaires | `components/admin/AdsForms.tsx` (8 formulaires) + confirmations `<details>` (DeleteActionForm) | ✔ 338c4a9 |
| H — routes publiques | `app/ads/click/[id]/route.ts` + `app/ads/track/route.ts` + `AdImpressionTracker` | ✔ fc01271 |
| I — intégration site | `AdSlot` (serveur), `AdVisuals` (banner/card/video/promo/badges), `SponsoredArticleCard`, `PartnerShowcase`, badge sponsor `ArticleCard` ; accueil ×4, actualités, article ×2, vidéos | ✔ fc01271 |
| J — export CSV | `app/admin/publicites/export/route.ts` (règlements admin / campagnes staff, BOM Excel, no-store) | ✔ 338c4a9 |
| K — tests + builds | vitest 158/158, tsc 0, lint 0/0, `next build` 36 pages, `opennextjs-cloudflare build` OK, wrangler dev local (6 routes vérifiées) | ✔ |
| L — rapport | le présent document + CAHIER (§3) | ✔ |

## 3. Schéma de la régie (migrations 0025/0026 — PRÉPARÉES, NON APPLIQUÉES)

9 tables : `advertisers` (coordonnées privées), `ad_campaigns` (7 statuts stockés,
référence unique auto BHTV-AAAA-XXXXXX, période timestamptz, forfait/forfait+production,
montant + devise GNF, priorité 0-100, contrat), `ad_creatives` (format, payload
jsonb validé, article RÉEL pour sponsor_article, statut draft/approved/refused,
poids 1-20), `ad_campaign_placements` (liaison), `ad_placements` (8 codes seedés),
`ad_payments` (règlements manuels), `ad_daily_stats` (agrégats journaliers
idempotents), `ad_event_fingerprints` (SHA-256, purge > 3 jours), `ad_partners`
(vitrine), + `get_public_ad_zone`, `get_public_ad_link`, `get_public_partners`,
`get_public_sponsored_articles`, `record_ad_event`, `purge_ad_fingerprints` + audit
(commerciales) + job pg_cron `bhtv-purge-ad-fingerprints` (02h25 UTC, infra 0006).

Les deux migrations ont été **modifiées en toute légalité DANS CETTE MISSION** (elles
n'étaient pas appliquées) : `article_id` exposé dans la zone publique (article
sponsorisé), contrainte SQL http/https sur `link_url` partenaires, fonction
`get_public_sponsored_articles` + grants. **Chaque modification re-provée** : runner
SQL local reconstruit à neuf → **23/23 PASS**.

## 4. Machine à états des campagnes

Statuts stockés : draft → pending → active/suspended/completed/cancelled/refused ;
la « Programmée » est CALCULÉE (active + début futur), jamais stockée. Transitions
contrôlées doublement : action serveur (`canTransition`, admin-seuls pour
refused/cancelled/completed) ET RLS. **Fail-closed** : activer sans période complète
= refus ; campagne sans dates = état « Sans période », JAMAIS diffusée.
Réactivation depuis completed/cancelled/refused → draft (admin).
L'activation ne réinitialise ni l'approbation des créations ni le contrat.

## 5. Diffusion publique — garanties

1. `get_public_ad_zone` : campagne **active EN PÉRIODE** (horloge serveur), créative
   **approved**, annonceur **actif**, emplacement **actif** — sinon zone vide.
2. **Aucune URL externe dans le DOM** : `payload − link_url` ; le lien sortant est
   relu en base au clic (`get_public_ad_link`, re-validation création+campagne).
3. Rotation **déterministe par fenêtre de 5 min** (Efraimidis-Spirakis pondéré,
   priorité campagne départage) — mêmes rendus SSR/hydratation, aucune campagne ne
   monopolise, pas de polling.
4. Route clic `/ads/click/[id]` : UUID validé, destination **exclusivement en base**,
   schéma revalidé, 302 ; UUID inconnu/non diffusable → 302 vers l'accueil.
5. Statistiques jamais exposées publiquement (aucun compteur public inventé).

## 6. Impressions & clics (§10)

- Définition uniforme affichée dans l'admin (`IMPRESSION_RULE`) : max 1 impression et
  1 clic par empreinte/jour/création.
- Déduplication DOUBLE : navigateur (IntersectionObserver 50 % + sessionStorage,
  garde Strict Mode anti double envoi) puis serveur (`record_ad_event` : empreinte
  SHA-256(IP|UA|créative|jour UTC) → agrégat incrémenté SEULEMENT si empreinte neuve).
- **Aucune IP brute** : table empreintes purgée par pg_cron (> 3 jours) ; RLS sans
  policy = 0 ligne accessible par quiconque via l'API (prouvé ADS15).
- **Avertissement permanent** dans l'admin : chiffres INDICATIFS, jamais d'audience
  certifiée, aucun fondement CPM/CPC.

## 7. Sécurité (RLS 0026 — prouvée sur PostgreSQL réel)

| Rôle | Annonceurs / campagnes / créations / emplacements / partenaires | Approbation créativité | Règlements | Lectures publiques |
|---|---|---|---|---|
| admin | CRUD complet | oui | CRUD | — |
| editor | select/insert/update (créatives : jamais une approuvée), PAS delete | **non (REFUSÉ en RLS)** | select SEULEMENT (insert/update/delete refusés) | — |
| reporter | **0 ligne** | non | **0 ligne** | — |
| anon/public | 0 ligne | non | 0 ligne | fonctions SECURITY DEFINER seulement (zone sans lien, lien de clic, partenaires, liste sponsorisés, événements) |

Fonctions : revoke PUBLIC puis grant explicites ; `purge` réservée pg_cron (personne
d'interactif). Audit `audit_row_change` sur les 5 tables commerciales (prouvé ADS22).
Empreintes : RLS sans policy = table inaccessible (fail-closed). Server Actions :
`requireRole` en tête, client session cookies JAMAIS service_role, RLS dernière
barrière. Anti-abus clic/impression : empreintes (1 event/jour/empreinte) — la
base refuse tout événement hors création effectivement diffusée (ADS13/ADS14).

## 8. Formats — conformité directive §5

- **Bannière** : image (Storage `advertising/` conseillé), alt OBLIGATOIRE, titre/CTA
  optionnels ; prévisualisation par URL.
- **Carte** : image ou logo + titre + texte courts ; style distinct « Publicité ».
- **Vidéo YouTube** : SEULE source acceptée — zod valide via `extractYouTubeId`
  (domaines YouTube stricts), canonisée en `youtube.com/watch?v=ID`, rendue en
  miniature i.ytimg + lien sponsorisé (pas d'iframe libre, pas de fichiers vidéo
  hébergés, pas de pré-roll).
- **Bandeau promotionnel** : message court, couleur #rgb/#rrggbb, CTA optionnel.
- **Article sponsorisé** : pointe vers un article RÉEL (vérifié en base à
  l'enregistrement ; publié UNIQUEMENT, RLS publique) ; JAMAIS transformé en faux
  article ; badge « Sponsorisé » qui SUIT l'article dans tous les flux
  (`get_public_sponsored_articles`).
- Mention « Publicité »/« Sponsorisé » systématique (§12), aucune donnée personnelle
  reçue, aucun ciblage comportemental.

## 9. Règlements manuels & contrats

ADMIN exclusivement (action + RLS + masquage UI éditeur). Montants réels, devise 3
lettres (GNF par défaut), 5 modes (espèces, mobile_money, virement, chèque, autre),
référence transaction + note. État de règlement calculé (non réglé/partiel/réglé/**en
retard** si contrat échu). Export CSV réglementaire (BOM Excel, no-store).

## 10. Stockage & budget

Pur réemploi : dossier `advertising/` du bucket `media` existant, pipeline complet
(compression navigateur → validation serveur signature/mime/dimensions/poids),
2 Mo LIVE. Aucun nouveau bucket, aucune carte bancaire, aucun service externe,
**0 USD/mois de coût supplémentaire** ; Workers Free respecté (aucun polling, rendu
ISR, requêtes groupées Promise.all).

## 11. Tests exécutés (réels)

| Suite | Résultat | Où |
|---|---|---|
| ads-core (rotation, états, URLs, CTR, paiements, CSV, empreintes) | **20/20** | vitest |
| schémas Zod (URLs, dates Conakry, formats, décisions, règlements) | **14/14** | vitest |
| régression CMS existante | **124/124** | vitest |
| **TOTAL vitest** | **158/158** | |
| SQL réel (PostgreSQL 17.11 portable isolé, base reconstruite à neuf) | **ADS1→ADS22 = 23/23 PASS** | `supabase/test-local/ads-runner.mjs` |
| `tsc --noEmit` | exit 0 | |
| ESLint | 0 erreur / 0 avertissement | |
| `next build` | ✓ compilé en 15.2 s, **36 routes** (dont 12 régie) | |
| `opennextjs-cloudflare build` | ✓ worker.js généré | |
| wrangler dev local (jamais déployé) | `/` 200 · `/admin/login` 200 · `/admin/publicites` 307 · `/ads/click/<uuid bidon>` 302 accueil · `/ads/track` `{"counted":false}` · `/actualites` 200 · `/videos` 200 ; TOUT workerd arrêté ensuite | |

Tests SQL notables : 8 emplacements seedés ; anon/reporter 0 ligne (fail-closed) ;
éditeur ne PEUT PAS approuver (RLS) ni toucher aux règlements ; zone publique
renvoie la création SANS lien ni montant ni contrat ; déduplication (2 appels =
1) ; refus hors diffusion (campagne suspendue/expirée, annonceur inactif, créative
non approuvée) ; purge OK ; audit trace OK ; contrainte période end_at > start_at.

## 12. Restes à faire (PROPOSÉS — hors périmètre de cette mission)

1. **Application des migrations 0025/0026 sur la base distante** — UNIQUEMENT sur
   autorisation explicite (commande CLI `supabase db push` ou équivalent SQL editor).
2. Recette par la direction après migrations : créer 1 annonceur, 1 campagne
   (période réelle), 1 création image, l'approuver, l'activer, vérifier l'accueil,
   cliquer, constater l'agrégat dans Statistiques.
3. (Option) Upload d'image dédié dans le formulaire de création (actuellement :
   URL collée depuis Médiathèque — flux complet et fonctionnel).
4. (Option) Pagination des listes au-delà de 200 entrées (limites SQL actuelles).
5. (Option) Prolonger/désactiver en un clic depuis la liste (aujourd'hui via la
   fiche — complet mais en deux clics).

## 13. Engagements de la mission — vérification finale

- Migrations préparées localement, **JAMAIS appliquées sur la base distante** ✔
  (base distante vérifiée : aucune table `ad_*`).
- **Aucun déploiement Cloudflare** exécuté ✔ (prod inchangée : version f5aeaef3).
- Aucun push GitHub, aucune fusion main, aucun DNS modifié ✔
- Aucun secret affiché/loggé ✔ ; service_role jamais utilisé pour contourner ✔
- Aucun contenu fictif en base distante ✔ (tout l'édit de test vit en base locale
  jetable reconstruite) ; aucune donnée publique réelle touchée ✔
- Budget absolu 0 USD/mois respecté ✔
- « Ne jamais déclarer une fonctionnalité opérationnelle si elle n'a pas été
  réellement testée » respecté : chaque garantie ci-dessus pointe un test exécuté.

## 14. Verdict final

> **PRÊT POUR MIGRATIONS ET RECETTE.**

Le code est complet, testé (158/158 vitest + 23/23 SQL réel + builds + aperçu
local), la sécurité RLS prouvée sur PostgreSQL réel, la diffusion publique
fail-closed, les chiffres honnêtes et non certifiés, le budget nul. Le déploiement
de production exige d'abord l'application des migrations 0025/0026 (autorisation) -
puis une recette par la direction. Tant que les migrations ne sont pas appliquées,
le site public et le CMS actuels fonctionnent EXACTEMENT comme avant : les zones
d'emplacement ne rendent RIEN sans données (aucune page vide, aucun élément
existant remplacé).

## 15. Commits de la mission (branche feature/regie-publicitaire)

| Commit | Contenu |
|---|---|
| 53fadc2 | Cahier d'implémentation (audit + décisions + plan) |
| 212d7a5 | Noyau pur (20 tests) + migrations 0025/0026 + runner SQL (23/23) |
| 49ece3c | Fonctions de diffusion finales (zone sans liens, lien de clic, événements idempotents) |
| 64531cd | Noyau partagé, schémas Zod, actions serveur, lectures admin/public |
| fc01271 | Routes /ads/click + /ads/track, composants publics, intégration pages |
| 338c4a9 | Module admin complet + export CSV + tests schémas |
| (ce commit) | Présent rapport |

**Fichiers créés** : 30 (2 migrations, 1 runner SQL, 1 harnais réutilisé, 5 modules
lib, 4 composants publicité, 1 suite formulaires admin, 11 routes admin, 2 routes
publiques, 2 suites de tests) — **fichiers modifiés** : 7 (Sidebar, ArticleCard,
MediaUploader, lib/types, lib/media/variants, page accueil/actualités/article/vidéos).

## 16. Rappel honnête des limites

- Les statistiques de première version sont INDICATIVES (pas de mesure certifiée,
  empreintes imparfaites contre VPN/nettoyage de session) — non facturable CPM/CPC.
- Le comptage impression s'appuie sur le rendu ISR : un rendu de page peut exister
  en cache sans vue réelle immédiate ; seule la DÉDUPLICATION quotidienne garantit
  une borne haute honnête.
- La rotation exige l'affichage effectif : la cohérence ISR 5 min fait tourner les
  créations aux rafraîchissements/rerender, mais un visiteur unique peut voir la
  même création pendant sa session (comportement voulu, dédupliqué côté
  statistiques).
- Le nombre de créations par zone est plafonné par l'emplacement (max_items,
  1-12) ; au-delà, la plus forte priorité/poids gagne la place.

## 17. ADDITIF (03/11/2026) — Migrations 0025/0026 APPLIQUÉES sur la base distante

Exécutées sur **autorisation explicite de la direction** le même jour, via la
commande officielle du CLI (`supabase db push --remote --yes`), dry-run conforme
préalable (uniquement 0025 + 0026). §1/§13 (migrations jamais appliquées) devient
obsolète à partir de cet hour : ce qui suit remplace ce point.

Vérifications réelles sur la base distante (requêtes LECTURE SEULE via l'API
Management, aucune modification de données) :

- `migration list --remote` : **0001→0026 toutes enregistrées** (0025 + 0026 ✔).
- **9 tables `ad_*` présentes, RLS ENABLED sur les 9** (aucune table sans RLS).
- **27 policies** exactement le contenu de 0026 : règlements = admin seulement
  (insert/update) + select staff ; placements = select/update staff (pas d'insert),
  créations = 3 staff ; empreintes = **aucune policy** (fail-closed).
- **6 fonctions** présentes : `get_public_ad_zone`, `get_public_ad_link`,
  `get_public_partners`, `get_public_sponsored_articles`, `record_ad_event`,
  `purge_ad_fingerprints`.
- **ACL vérifiées par aclexplode** : les 5 fonctions publiques → anon +
  authenticated + service_role EXECUTE, **PUBLIC révoqué** (aucune ligne PUBLIC) ;
  `purge_ad_fingerprints` → **service_role uniquement** (postgres propriétaire,
  aucun rôle interactif).
- **Job pg_cron `bhtv-purge-ad-fingerprints` actif** : `25 2 * * *` (02h25 UTC),
  exécution sous rôle `postgres` (propriétaire des fonctions — EXECUTE implicite),
  à côté du job existant `bhtv-publish-scheduled`.
- **Les 8 emplacements seedés** en base distante : home_top_banner, home_inline,
  news_feed_inline, article_inline, article_bottom, videos_inline,
  home_promo_strip, home_partners — **la base distante reste par ailleurs intouchée
  (0 annonceur, 0 campagne, 0 création, 0 contenu fictif).**

Le module régie n'est pas encore déployé sur l'environnement Cloudflare public
(prod inchangée, version f5aeaef3 sans régie) : la RECETTE par la direction et le
DÉPLOIEMENT restent à faire, chacun sur autorisation distincte.