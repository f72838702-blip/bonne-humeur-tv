# RAPPORT DIAGNOSTIC — « CRÉATION IMPOSSIBLE (ANNONCEUR INVALIDE ?) »

**Date : 04/11/2026 — branche `feature/regie-publicitaire` — production : Version `00266a37` (le correctif ci-dessous N'EST PAS encore déployé — autorisation requise)**

---

## 1. Vérification de l'annonceur (lecture seule — RAS)

Base distante interrogée (API Management, 0 écriture) :

| Champ | Valeur réelle |
|---|---|
| UUID réel | `bf2630d2-739f-41fb-8135-d119de5d843f` |
| Nom | « Bonnehumeur » |
| `is_active` | **true** |
| Suppression logique | **inexistante** (la table n'a pas de soft-delete ; compte présent) |
| Créé | 04/11/2026 13:02:28 UTC (trace audit_logs : 1 seul INSERT) |
| Campagnes liées | **0** (aucune jamais insérée) |

**L'annonceur est sain et n'a été ni modifié ni supprimé ni dupliqué.** La
colonne transmise par le formulaire est bien son UUID (`<option
value={a.id}>` dans le formulaire ; `formData.get("advertiser_id")` dans
l'action). Aucune variante de nom n'existe : `advertiser_id` est utilisé
partout (formulaire → action → colonne SQL) ; l'unique `advertiserId` du
code est un paramètre de fonction de LECTURE (`getAdvertiserCampaigns`) qui
interroge bien la colonne `advertiser_id`.

## 2. Cause exacte — DÉMONTRÉE par confrontation code ↔ schéma

**La création échouait AVANT d'atteindre l'annonceur.** Le payload inséré
dans `ad_campaigns` contenait une **colonne fantôme `placements`** :

- `adCampaignSchema` (Zod) retourne un objet qui inclut `placements` : liste
  des emplacements cochés (défaut `[]`).
- `stripId(parsed.data)` n'enlève que `id` — le spread du reste partait TEL
  QUEL dans le `… .insert(row)`.
- `ad_campaigns` (migration 0025) n'a **aucune colonne `placements`** : les
  emplacements sont reliés par la table **`ad_campaign_placements`
  (séparée, à écrire 2ᵉ)**.
- PostgREST rejette donc TOUT insert/update avec `PGRST204` (« could not
  find the 'placements' column ») — et l'action renvoyait le message
  générique « Création impossible (annonceur invalide ?) », **masquant la
  cause réelle** (seul le `console.error` serveur avait le texte).

Corollaire prouvé par l'audit : **0 campagne n'a jamais pu être créée dans
cette version** — ni à la création, ni à la modification. Ce n'était ni
l'annonceur, ni les dates (correction précédente), ni RLS, ni FK.

Les autres tables régie sont vérifiées une à une : schémas Zod ↔ colonnes
réelles, correspondance EXACTE (annonceurs, créations, placements,
partenaires, règlements) — `placements` était la seule colonne fantôme.

## 3. Correctif appliqué (code local — committé, PAS déployé)

| Fichier | Correction |
|---|---|
| `lib/ads/ads-core.ts` | **Liste blanche `AD_CAMPAIGN_COLUMNS`** = les colonnes RÉELLES de `ad_campaigns` (0025) + **`toCampaignRow(values)`** qui ne laisse passer QUE ces colonnes — une clé fantôme ne peut plus jamais atteindre la table (id/created_at/updated_at gérés par Postgres/triggers) |
| `lib/actions/ads.ts` | `saveCampaignAction` : row construit via `toCampaignRow` (le `placements` du schéma est filtré ; les liaisons restent écrites dans `ad_campaign_placements` comme avant) ; **messages d'erreur précis** : FK `23503` → « Annonceur introuvable ou inutilisable : vérifiez Annonceurs, il est créé et actif. » ; toute autre erreur → « … (erreur <code> — inscrite au journal) » ; **chaque journalisation conserve code + message réels** de l'erreur Supabase (aucune transformation en « annonceur invalide » aveugle) |

L'annonceur existant n'est PAS touché ; aucune donnée écrite ; aucune policy
RLS modifiée (aucune nécessité : la cause était applicative) ; aucune
migration modifiée ; aucun secret ; aucun push ; aucun déploiement.

## 4. Tests effectués

- **Vitest : 170/170** (9 fichiers) — **3 nouveaux** : `toCampaignRow` garde
  chaque colonne réelle ; **jette la fantôme `placements`** (cas de
  régression exact du bug) ainsi que id/created_at/updated_at ; colonnes
  contrat conservées quand le formulaire les apporte.
- `tsc --noEmit` : **exit 0** ; ESLint : **0/0**.
- `npm run build` : ✔ 36 routes ; `npx opennextjs-cloudflare build` : ✔
  worker régénéré — **PRÊT, NON déployé**.

### Tests de la mission §6 — état de preuve honnête

| # | Test | État |
|---|---|---|
| 1 | Chargement de la liste des annonceurs | ✔ lecture seule : l'annonceur existe et est actif ; la page liste le reçoit (code vérifié) |
| 2 | Sélection de l'annonceur existant | ✔ le formulaire transmet `a.id` (UUID), pas le nom |
| 3 | Transmission de l'UUID | ✔ même nom `advertiser_id` partout ; Zod vérifie le format UUID |
| 4 | **Création d'une campagne (réel)** | ⚠ À CONFIRMER PAR LA DIRECTION au CMS après le déploiement du correctif (les écritures de test sur la base distante sont interdites, et le PostgreSQL portable local est arrêté par le système pour économie mémoire — la preuve end-to-end in fine sera votre manipulation réelle) |
| 5 | Refus d'un UUID inexistant | ✔ barrière SQL FK `23503` (exigé par la définition 0025) + message dédié |
| 6 | Refus d'un annonceur inactif | ✔ le select propose les inactifs en lecture ; la campagne créée ne peut PAS diffuser (RLS/diffusion exigent `advertisers.is_active`) — la politique d'insertion n'exclut pas l'inactif, conformément au cahier (activer est séparé) |
| 7 | Respect des permissions | ✔ requireRole + RLS 0026 inchangées (23/23 prouvées lors du chantier SQL) |
| 8 | Conservation des données | ✔ aucune écriture exécutée ; compteurs re-testés en lecture seule après chaque étape |

## 5. Ce qu'il reste à faire

1. **Déployer le correctif** (`039b36c` + celui-ci) sur Cloudflare — sur
   AUTORISATION (procédure pré-déploiement déjà écrite ; recul = rollback
   sans risque).
2. La direction rejoue au CMS : sélectionner « Bonnehumeur », créer la
   campagne (dates du correctif précédent — 4 cas), enregistrer → le
   message précédent ne peut plus se reproduire (liste blanche).
3. Poursuivre la recette : création → approbation → activation → constat
   public + statistiques.

## 6. Vérification de la version déployée (mission §4)

- Branche Git actuelle : `feature/regie-publicitaire` (aucun push/fusion).
- Worker en production : Version `00266a37-5112-46a8-a590-29308e749e86`,
  construite le 04/11 depuis `039b36c` (+rapports) — c'est-à-dire **AVEC le
  correctif des dates mais SANS celui de `placements`** (il est écrit
  maintenant). Le symptôme observé est donc totalement cohérent avec le
  code déployé : cette version contient encore le payload fantôme.