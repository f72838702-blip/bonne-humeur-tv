# AUDIT APPROFONDI — RÉGIE PUBLICITAIRE BONNE HUMEUR TV

**Date : 04/11/2026 · Branche de travail `feature/regie-simplifiee` (créée depuis `feature/regie-publicitaire` HEAD `56ad66d`) · Production : Version `6b7f9500`**

---

## 1. État réel du dépôt et des branches (audit Git)

| Élément | Réalité constatée |
|---|---|
| Branche courante au démarrage | `feature/regie-publicitaire` — HEAD `56ad66d`, arbre de travail PROPRE (0 modifié, 0 non suivi) |
| `deploy/cloudflare-staging` | HEAD `bb0f459` — **contient 0 commit absent de feature** : `feature/regie-publicitaire` est un surensemble (+16 commits : migrations 0025/0026 appliquées, déploiements 12bdfaa0/00266a37/6b7f9500, correctifs dates + annonceur) |
| Code réellement déployé | Version `6b7f9500-d2b2-4c19-87f5-220b7e3a2692` — exactement l'état `56ad66d` (correctif dates + correctif « annonceur invalide » inclus) |
| Branche créée pour cette mission | `feature/regie-simplifiee` = `56ad66d` + travaux de simplification. AUCUNE fusion, AUCUN push |
| Données existantes | AUCUNE donnée supprimée, modifiée ni créée : l'annonceur « Bonnehumeur » (`bf2630d2-739f-41fb-8135-d119de5d843f`) est INTACT |

## 2. Architecture réelle (audit lecture seule de la base — ref `beinalmwqkxbqitvuobr`)

### 2.1 Tables `ad_*` réellement présentes (9, créées par 0025, RLS par 0026)

| Table | Rôles | Contenu réel du 04/11 |
|---|---|---|
| `advertisers` | select/update admin+editor · insert admin+editor · **delete admin** | **1 ligne** (Bonnehumeur, `is_active=true`) |
| `ad_campaigns` | idem campagnes | 1 campagne « Bonnehumeur », `active`, période 14:12→17:14 UTC, priorité 1 |
| `ad_creatives` | select admin+editor · insert admin+editor · **update** : editor seulement si `status<>'approved'` (ni approuver ni toucher une approuvée) · delete admin | **0 ligne** — cause directe du « rien ne s'affiche » |
| `ad_campaign_placements` | admin+editor (PK composite campaign+placement) | 4 liaisons (home_top_banner, news_feed_inline, article_bottom, home_promo_strip) |
| `ad_placements` | select admin+editor · update admin+editor | **8 seedées**, toutes actives |
| `ad_payments` | select admin+editor · **insert/update/delete ADMIN exclusivement** | 0 |
| `ad_daily_stats` | select staff ; écritures via `record_ad_event` (SECURITY DEFINER, dedup 1/jour/empreinte) | 0 |
| `ad_partners` | select/insert/update staff · delete admin | 0 |
| `ad_event_fingerprints` | service_role uniquement ; purge pg_cron 02h25 (3 jours) | 0 |

FK vérifiées : campaign→advertiser, creative→campaign (cascade), creative→article (`set null`), placements → code, payments → campaign. Contrainte `ad_campaigns_period_valid` (end > start) et `ad_creatives_approval_coherence` (approved ⇒ approved_by non nulle).

### 2.2 Fonctions SQL exposées au public (ACL : anon + authenticated, PUBLIC révoqué)

- `get_public_ad_zone(code)` — conditions de diffusion **exactes** : emplacement actif ∧ campagne `active` ∧ `start_at <= now() < end_at` (horloge serveur) ∧ créative `approved` ∧ `format ∈ allowed_formats` ∧ annonceur actif. `link_url` est retiré du payload AVANT toute sortie.
- `get_public_ad_link(uuid)` — destination du clic, revalidée en base par `/ads/click/[id]` (aucun open redirect : isSafeAdUrl http/https).
- `get_public_partners()`, `get_public_sponsored_articles()`, `record_ad_event(...)` (empreinte SHA-256 serveur, zéro IP brute), `purge_ad_fingerprints()` (service_role).

### 2.3 Intégration publique RÉELLE vérifiée (8 emplacements vs pages)

| Emplacement | Page(s) | Constat |
|---|---|---|
| home_top_banner | `/` (AdSlot) | OK code ; formats admis en base : banner, promo_strip |
| home_inline | `/` | OK ; card |
| news_feed_inline | `/actualites` | OK ; card |
| article_inline | `/actualites/[slug]` | OK ; card, banner |
| article_bottom | `/actualites/[slug]` | OK ; banner |
| videos_inline | `/videos` | OK ; **card uniquement** |
| home_promo_strip | `/` | OK ; promo_strip |
| home_partners | `/` (PartnerShowcase) | OK ; bannière (logos partenaires via table dédiée) |

**Constat critique n°1 — formats INUTILISABLES en l'état** : AUCUN emplacement seedé n'admet `video` ni `sponsor_article` dans `allowed_formats`. Les composants `AdVideo`/`SponsoredArticleCard` existent mais ne peuvent JAMAIS être rendus par une zone. `video` est un format mort côté diffusion ; `sponsor_article` reste affichable **via un autre canal** (`get_public_sponsored_articles` : cartas marquées « Sponsorisé » dans les listes — indépendant des zones). Remède : mise à jour de DONNÉE (`allowed_formats` de `videos_inline`) — non exécutée, non autorisée (voir §8 recommandations).

### 2.4 Audit page & formulaires (`/admin/publicites` et sous-pages)

9 pages, 6 formulaires client, 14 Server Actions — toutes `requireRole` en tête, jamais `service_role`, messages d'erreur désormais porteurs du code PostgREST. Défauts structurels :

1. **Parcours de publication = 6 écrans / 6 manipulations différentes** : Créer/modifier l'annonceur → Créer la campagne (dates manuelles datetime-local, référence, priorité, facturation…) → Éditer la fiche → Créer une création (payload par format, poids…) → Approuver la création → ACTIVER. Aucun écran ne dit ce qu'il manque pour être visible.
2. **Dates libres sans sens métier** : deux champs datetime-local autonomes ; la durée n'existe pas. C'est la source exacte des incidents « date de fin antérieure » déjà corrigés (source de vérité `campaignPeriodError` + garde `min` client).
3. **Redondances** : référence (auto disponible mais exposée), priorité et poids exposés sans utilité pour la direction ; `placements` cochés dans le formulaire campagne SANS vérification de compatibilité de format (on peut relier un format interdit — la liaison s'écrit, la zone reste vide) ; trois listes d'emplacement (form campagne, page emplacements, base) non harmonisées.
4. **Cohérence du statut peu claire** : l'activation d'une campagne ne garantit RIEN si aucune créative n'est approuvée (cas vécu quatre fois le 04/11 : campagne activée 14:18, aucune création créée — le CMS ne le dit nulle part).
5. **Le lien de destination n'existait pas** : `bannerPayloadSchema`/`cardPayloadSchema`/`video`/`promo_strip` n'ont AUCUN champ `link_url` (même les champs saisis n'étaient pas persistés) — un clic retombait sur l'accueil. Corrigé dans l'interface simplifiée (lien validé, persisté, lu par `/ads/click`, retiré du DOM par la SQL).
6. **Non-atomicité** : campagne → liaisons → créations écrits séquentiellement ; un échec intermédiaire peut laisser une campagne orpheline (compensation documentée dans l'action simplifiée, §3 du second rapport).
7. **Journalisation** : corrigée au fil des missions précédentes (code + message réels, jamais secrets).

## 3. Cause de l'erreur « annonceur invalide » (mission §7 — ré-examinée)

- **Cause démontrée (corrigée et déployée, Version `6b7f9500`)** : colonne fantaume `placements` du schéma Zod de campagne propagée dans le `insert/update` (PGRST204) masqué derrière « Création impossible (annonceur invalide ?) ». Correctif = liste blanche `AD_CAMPAIGN_COLUMNS` via `toCampaignRow` (3 tests de régression). La direction a depuis **créé et activé une campagne réelle** : preuve de fonctionnement.
- Parcours UUID : `<option value={a.id}>` → `formData.get("advertiser_id")` → Zod `.uuid()` → FK `ad_campaigns_advertisers_id_fkey`. Aucun index/nom/libellé transmis à quelque étape que ce soit.
- L'« annonceur existant non reconnu » n'a JAMAIS eu d'autre cause que ce masque : la FK 23503 est maintenant affichée avec son message dédié.

## 4. Failles et risques éventuels (état après audit)

| # | Constat | Sévérité | Traitement |
|---|---|---|---|
| F1 | `video`/`sponsor_article` non admis par aucun emplacement (donnée) | moyen | documenté + garde dans l'interface (message explicite, publication refusée proprement) |
| F2 | Lien de destination absent des schémas payload | moyen | corrigé (interface simplifiée : `link_url` validé `isSafeAdUrl`, persisté, routé `/ads/click`, retiré du DOM par la SQL) |
| F3 | écritures non atomiques (3 tables) | faible | compensation serveur (jamais de campagne orpheline pour l'admin ; message honnête pour l'éditeur) ; option RPC atomique documentée, NON créée en base |
| F4 | campagne activable sans dates (fail-closed en SQL mais confusion UX) | faible | l'interface simplifiée impose TOUJOURS une période (durée) |
| F5 | poids/priorité exposés sans garde-fou | négligeable | repliés dans la gestion avancée |

## 5. Données, migrations, RLS

- 0025/0026 appliquées et vérifiées (22/22 migrations local=remote, 27 policies, ACL contrôle par `aclexplode`).
- **Aucune migration nécessaire pour la simplification** : tout le parcours simple est obtenu avec les tables actuelles (mission §13 PRIORITÉ respectée). Aucune table ni colonne supprimée, aucune policy modifiée.
- Données distantes : lecture seule intégrale tout au long de la mission (aucune écriture, aucun contenu fictif).

## 6. Recommandations

1. Déployer l'interface simplifiée (après recette direction) — rapport associé.
2. **Sur autorisation de DONNÉE distincte** : ajouter `video` à `allowed_formats` de `videos_inline` (requête `update ad_placements set allowed_formats = allowed_formats || 'video' where code='videos_inline'`) — débloquer la carte « Vidéo YouTube ».
3. À terme : RPC SECURITY DEFINER atomique `create_publicite` si le volume de publications augmente (aujourd'hui la compensation suffit et respecte RLS).
4. Conserver la page « Emplacements » en gestion avancée ; y ajouter une alerte si une combinaison format réellement demandée n'existe aucune compatibilité.
5. Statistiques : garder le bandeau « INDICATIVES, jamais certifiées » partout où elles sont montrées.