# RAPPORT DE TEST & RÉCAPITULATIF COMPLET — RÉGIE PUBLICITAIRE BONNE HUMEUR TV

**Date : 04/11/2026 — branche `feature/regie-publicitaire` — prod https://bonne-humeur-tv-preview.bonne-humeur-tv.workers.dev (Worker Version 12bdfa00)**

---

## 1. RÉPONSE IMMÉDIATE À VOTRE TEST

**Ce que vous avez vu** : rien (ou quasi rien) de visible côté site.
**Conclusion vérifiée en lecture seule sur la base réelle** : la base ne contient
aucune donnée publicitaire (0 annonceur, 0 campagne, 0 création, 0 règlement,
0 partenaire — interrogé à 12:55 UTC le 04/11).

**C'est le comportement prévu, pas une panne** :
- La régie est un SISTÈME à faire fonctionner : elle ne crée jamais de publicité
  toute seule et n'affiche AUCUN bloc vide sur le site (aucune zone laissée à
  moitié dessinée, aucun élément du site existant remplacé).
- La contrainte du projet interdit le contenu fictif en base distante : je n'ai
  volontairement rien mis en démo. La base publicitaire est restée vierge après
  l'application des migrations.
- Donc : tant que la direction n'a pas créé (1) un annonceur, (2) une campagne
  avec une période, (3) une création, et (4) approuvé cette création, aucune
  publicité ne peut s'afficher. Un visiteur ne la verra pas non plus si la
  campagne est « programmée » (période à venir) ou suspendue.

### Les 5 étapes pour voir UNE bannière en site réel (récit court)

1. Se connecter au CMS : `https://bonne-humeur-tv-preview.bonne-humeur-tv.workers.dev/admin/login`
2. Barre latérale → **Publicités** → **Annonceurs** → « + Nouvel annonceur »
   (nom et un logo suffisent, active cochée).
3. **Campagnes** → « + Nouvelle campagne » → choisir l'annonceur, nom,
   **début = aujourd'hui, fin = future** (sinon l'activation est refusée,
   fail-closed), cocher 1 ou plusieurs emplacements (par ex. `home_top_banner`
   = bannière en haut de l'accueil), statut initial Pending.
4. Sur la fiche de la campagne → « + Nouvelle création » → format **Bannière**
   → image (lien de la médiathèque, dossier *advertising/*) + **texte
   alternatif OBLIGATOIRE** → enregistrer (statut Draft) → bouton
   **Approuver** (réservé à l'administrateur).
5. Fiche de la campagne → **Activer**. Ouvrir l'accueil : la bannière apparaît
   (badge « Publicité », clic possible). **Statistiques** : 1 ligne journalière
   avec impression et clic (max 1 impression + 1 clic par empreinte/jour).

### Cas où vous créez tout et que NEANT s'affiche — checklist des 7 causes

| # | Cause probable | Comment vérifier |
|---|---|---|
| 1 | Création pas encore **approuvée** (statut Draft/Pending) | fiche campagne → statut de la création doit être **approved** |
| 2 | Campagne pas **Active** (ou « Programmée » : début future) | fiche → état calculé à droite du titre |
| 3 | Période dépassée (fin passée = « Expirée ») | modifier les dates puis réactiver |
| 4 | Annonceur **désactivé** | fiche annonceur → « Active » |
| 5 | Aucun emplacement coché, ou emplacement **désactivé** | fiche campagne + Emplacements |
| 6 | Mauvais emplacement (celui vérifié n'a aucune création) | les 8 codes = home_top_banner, home_inline, news_feed_inline, article_inline, article_bottom, videos_inline, home_promo_strip, home_partners |
| 7 | Cache de page ~1 min avant le premier rendu réel | recharger une minute plus tard |

---

## 2. CE QUE J'AI FAIT — RÉCAPITULATIF CHRONOLOGIQUE DE TOUT LE CHANTIER

### Jour 1 (03/11/2026) — Conception et développement

| Chantier | Contenu | Commit |
|---|---|---|
| Cahier | Audit réel + architecture + plan (17 pages) | `53fadc2` |
| Noyau pur | `lib/ads/ads-core.ts` : 5 formats, 8 emplacements, machine à états, rotation, CTR, paiements, empreintes — **20 tests vitest** | `212d7a5` |
| Migrations SQL | 0025 (9 tables, 8 emplacements seedés, fonctions, audit, job pg_cron) + 0026 (RLS 4 rôles, grants) — **PROMÉES sur PostgreSQL 17.11 local réel : 23/23 PASS** (ADS1→ADS22, base jetable reconstruite à neuf) | `212d7a5`, `49ece3c` |
| Actions & lectures | `lib/actions/ads.ts` + `lib/data/ads.ts` + `lib/data/ads-public.ts` (client session jamais service_role) | `64531cd` |
| Pages & formulaires | 9 pages admin + 8 formulaires (`AdsForms.tsx`) + nav « Publicités » (admin+éditeur) | `338c4a9` |
| Routes publiques | `/ads/click/[id]` (302, destination seulement en base — anti open-redirect) + `/ads/track` + `AdImpressionTracker` (sans IP brute) | `fc01271` |
| Intégration additive | Accueil (4 emplacements + vitrine partenaires), actualités, article (2), vidéos + badge « Sponsorisé » qui suit les articles sponsorisés dans tous les flux | `fc01271` |
| Exports CSV | `export/route.ts` (règlements admin / campagnes staff, BOM Excel, no-store) | `338c4a9` |
| Rapport | RAPPORT_DEVELOPPEMENT… (18 rubriques) | `5035543` |

### Jour 2 — Autorisations successives de la direction (toutes vérifiées)

| Autorisation | Ce que j'ai exécuté | Vérifications réelles | Commit |
|---|---|---|---|
| « applique les migrations 0025/0026 sur la base distante » | `db push --dry-run` (seule 0025+0026) puis `db push --remote --yes` | 9 tables RLS enabled + **27 policies exactes** + 6 fonctions + **ACL** (5 publiques = anon+authenticated+service_role, PUBLIC révoqué ; purge = service_role seul) + job cron `bhtv-purge-ad-fingerprints` 02h25 actif + **8 emplacements seedés** ; base par ailleurs **intouchée** (0 annonceur, 0 campagne, 0 contenu fictif) | `7d2b5a4` |
| « déploie le code de la régie » | Build OpenNext à neuf + `wrangler deploy` | **Version 12bdfa00**, Startup 21 ms ; smoke LIVE 14/14 : `/`, `/actualites`, `/videos`, `/admin/login` = 200 ; `/admin/publicites` (+3) = 307 (garde) ; `/ads/click/<uuid bidon>` = **302 vers `/`** ; `POST /ads/track` invalide = `{"counted":false}` ; CSP / X-Frame-Options inchangées | `f2a3de1` |

### Aujourd'hui (04/11) — Analyse de votre test

- Lecture seule de la base : **vide publicitaire** (voir §1), horloge serveur
  correcte (12:55 UTC), 8 emplacements bien seedés, aucune donnée perdue.
- Le code en production est le même que celui validé au jour 1 : la machine
  attend des données, elle est restée dans l'état initial.

---

## 3. CE QUI EXISTE DÉJÀ EN PRODUCTION (vérifié)

- **Base distante** : 9 tables `ad_*` (RLS ENABLED sur les 9), **27 policies**,
  6 fonctions SQL, **8 emplacements déjà créés en base** — c'est LUI le
  catalogue des 8 slots, prêt à l'emploi.
- **Cloudflare Worker** Version 12bdfa00 : module CMS complet (9 pages) +
  routes clic/impression + intégration additive du site.
- **Le site public actuel est EXACTEMENT inchangé visuellement** tant qu'aucune
  donnée réelle n'existe (aucun bloc vide, aucun élément remplacé). Les seules
  zones « invisibles mais prêtes » : 4 sur l'accueil, 2 par article (inline +
  bas), 1 dans le fil d'actualités, 1 dans les vidéos, 1 bandeau promotionnel,
  la vitrine partenaires.

## 4. LES GARANTIES DE LA MACHINE (ce que vous testerez ensuite)

- **Fail-closed partout** : campagne sans dates = « Sans période », jamais
  diffusée ; création non approuvée = jamais diffusée ; annonceur inactif =
  jamais diffusé ; le clic revalide TOUT en base — mauvais UUID, campagne
  suspendue ou expirée = 302 vers l'accueil (jamais l'adresse du client).
- **Rotation** pondérée (poids × priorité), même fenêtre 5 min : la même
  bannière ne « suit » pas le visiteur aléatoirement ; plusieurs campagnes se
  partagent le slot.
- **Statistiques honnêtes** : déduplication (max 1 impression + 1 clic par
  empreinte/jour/création), agrégats journaliers, **chiffres INDICATIFS** —
  message affiché au CMS, jamais d'audience certifiée ni de facturation
  CPM/CPC fondée dessus.
- **Sécurité** : l'éditeur ne peut PAS approuver une création, ni écrire un
  règlement (RLS prouvée 23/23) ; reporter ne voit RIEN ; aucun mot de passe,
  aucune donnée bancaire, aucun ciblage par personne.
- **Règlements manuels** (espèces, mobile money, virement, chèque, autre) :
  réservés ADMIN, avec export CSV pour le contrat.

## 5. LIMITES HONNÊTES (rapportées déjà dans le rapport de développement)

1. Chiffres de première version seulement INDICATIFS (empreintes = borne
   haute honnête, pas une mesure certifiée).
2. Le rendu passe par le cache de page (~1 min) : à la suite d'une activation,
   la bannière peut apparaître après ce délai, pas instantanément.
3. L'upload d'image du formulaire de création passe par la médiathèque
   (collage d'URL) — l'upload direct DANS le formulaire de régie n'est pas
   encore fait (option documentée reste à faire).
4. Les listes admin ne paginent pas au-delà de 200 entrées.

## 6. ÉTAT DES COMMITTS & RAPPORTS

`feature/regie-publicitaire` (aucun push, main untouched) :
`53fadc2` cahier → `212d7a5` noyau+migrations → `49ece3c` fonctions diffusion →
`64531cd` actions/lectures → `fc01271` routes publiques+intégration →
`338c4a9` module admin → `5035543` rapport final → `7d2b5a4` additif migrations
applied → `f2a3de1` additif déploiement → (prochaine) rapport de recette.

## 7. CE QUE L'ADMINISTRATEUR PEUT TESTER MAINTENANT (recette réelle — 15 minutes)

Reprendre exactement les 5 étapes du §1.1 avec des données RÉELLES (par ex. un
vrai partenaire du média : hôtel, cabinet du BTP, opérateur de téléphonie…) ;
c'est la seule façon d'aboutir à une publicité visible : la machine a été
volontairement livrée avec zéro contenu fictif en base distante.

En cas de blocage précis pendant votre manipulation : donnez-moi le nom de la
page ou du bouton et le message affiché, et je diagnostique par une requête à
lecture seule sur la base réelle.