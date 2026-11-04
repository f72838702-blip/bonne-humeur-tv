# RAPPORT SIMPLIFICATION — RÉGIE PUBLICITAIRE BONNE HUMEUR TV

**Date : 04/11/2026 · Branche `feature/regie-simplifiee` · NON déployé (autorisation requise) · Base distante : 0 écriture pendant toute la mission**

---

## 1. Ce qui a été construit

**Une publicité = un formulaire = une publication.** L'administrateur clique
« + NOUVELLE PUBLICITÉ », suit 6 étapes lisibles et publie : la relation
annonceur → campagne → création → emplacements → approbation → activation
est entièrement exécutée par la Server Action `publishSimpleAdAction`,
dans les tables EXISTANTES, sous RLS, sans aucune migration.

```
┌ /admin/publicites (NOUVEAU centre) ────────────────────────────┐
│  [+ NOUVELLE PUBLICITÉ]  ← gros bouton unique                 │
│  Compteurs réels : En diffusion · Programmées · Brouillons ·  │
│  Impressions/Clics (indicateurs, jamais certifiés)            │
│  Liste 1 ligne = 1 publicité : visuel réel (image/vignette    │
│  YouTube), nom, annonceur, format, emplacements lisibles,     │
│  période, SÉCURISÉ — actions directes :                       │
│     Modifier · Suspendre/Reprendre · Prolonger (1 j … 90 j)   │
│     Supprimer (confirmation intégrée, admin)                  │
│  Filtres : Toutes · En diffusion · Suspendues · Programmées · │
│  Brouillons · Terminées · Clôturées                           │
│  « Gestion avancée » (repliée) : les 9 pages d'origine,       │
│  INTACTES (campagnes, annonceurs, emplacements, partenaires,  │
│  statistiques, règlements, export CSV)                        │
└───────────────────────────────────────────────────────────────┘
```

### Le formulaire unique (`/admin/publicites/nouvelle`)

| Étape | Contenu | Arrière-plan automatique |
|---|---|---|
| 1 — Entreprise | Choisir dans la liste OU « nouvelle entreprise » (nom + facultatifs) | UUID réel transmis (jamais un nom/index) ; si le nom tapé correspond à une fiche existante (nom normalisé EXACT — accents/casse/espaces ignorés), elle est réutilisée sans doublon ; sinon INSERT d'un nouvel annonceur |
| 2 — Format | 6 cartes : Bannière · Carte · Vidéo YouTube · Article sponsorisé · Bandeau promotionnel · Logo partenaire | le 6e écrit la table `ad_partners` dédiée, les 5 autres le couple campagne+création |
| 3 — Contenu | Champs qui s'adaptent au format ; image téléversée DE L'APPAREIL (compression navigateur `advertising` full+card, validation serveur signature/MIME) ; lien de destination facultatif | payload validé par les ZOD PAR FORMAT inchangés ; `link_url` persisté, lu par `/ads/click`, jamais rendu dans le DOM (la SQL le retire) |
| 4 — Où afficher | Seuls les emplacements réellement compatibles (lus de la BASE) — tous précochés, décochables, libellés sans code technique | compatibilité = `ad_placements.allowed_formats` ∩ format ; article sponsorisé : routage automatique par « Sponsorisé » (pas d'emplacement) |
| 5 — Durée | 24 h · 3 j · 7 j (défaut) · 15 · 30 · 60 · 90 j · Personnalisée ; début futur facultatif | fin CALCULÉE SERVEUR (horloge UTC Conakry = UTC+0) : `computeAdPeriod` ; une période incohérente est refuse — jamais stockée |
| 6 — Publier | « Publier la publicité » / « Enregistrer comme brouillon » | voir §2 |

Aperçu immédiat de l'image avant envoi, boutons ≥ 44 px, messages d'erreur
précis par champ, succès avec indication du délai de cache (≤ 2 min).

## 2. Logique technique de la publication (exacte et sécurisée)

1. `requireRole(["admin","editor"])` — reporter : refus.
2. `simpleAdSchema` (Zod) — le schéma PORTE LE FORMULAIRE (pas la SQL).
3. Annonceur : existant (vérifié en base) ou nouveau (normalisation puis réutilisation/insertion ; FK 23503 affichée telle quelle avec code).
4. Période : `computeAdPeriod` (durée → start/end ; « libre » → les deux dates obligatoires et cohérentes ; début futur ≠ « maintenant »).
5. Contenu : `buildPayload` (les mêmes ZOD par format que l'outil avancé — RIEN n'est assoupli) + `link_url` (`isSafeAdUrl`) ; article sponsorisé : article VÉRIFIÉ existant.
6. Emplacements : `compatiblePlacements`/`resolvePlacements` sur `ad_placements` RÉELLES ; aucun format sans emplacement compatible ne s'insère (message clair).
7. Écritures sous la session utilisateur (RLS 0026 en dernière barrière, jamais `service_role`) :
   - campagne via `toCampaignRow` (liste blanche — la colonne fantôme ne peut plus revenir) : `status = active` si publication, `draft` sinon ;
   - création : `approved` + `approved_by` si admin publie (contrainte SQL `approval_coherence` satisfaite) ; **`draft` si éditeur** — la RLS interdit à l'éditeur d'approuver : la badeau « À valider par un administrateur » s'affiche dans la liste, validation 1 clic possible depuis la fiche ;
   - liaisons `ad_campaign_placements`.
8. **Aucune campagne orpheline** : en cas d'échec après création de la campagne, compensation immédiate (suppression de la campagne créée). L'éditeur ne pouvant pas supprimer (RLS), le message le lui dit explicitement. Une RPC SECURITY DEFINER atomique serait l'option de force — jugée NON indispensable pour ce volume, donc **non créée** (documentée dans l'audit §6).
9. Nom automatique « Entreprise · Format » si l'administrateur n'en saisit pas.
10. « Programmée » : si le début est futur, la campagne active n'est pas affichée avant sa date (SQL diffusion : `start_at <= now()`), bandeau « Programmée » côté admin.

## 3. Fichiers

| Fichier | Nature |
|---|---|
| `lib/ads/simple-ad.ts` | **NOUVEAU** — noyau pur : durées, compatibilité, annonceur sans doublon, prolongation, nom automatique, libellés sans jargon |
| `lib/ads/simple-ad.test.ts` | **NOUVEAU** — 22 tests (vitest) |
| `lib/validation/ads-schemas.ts` | + `simpleAdSchema` (porte le formulaire ; validations par format inchangées) |
| `lib/actions/ads.ts` | + `publishSimpleAdAction` (publication un-clic) et `extendCampaignAction` (prolonger d'1 clic) ; `/admin/publicites/nouvelle` ajoutée aux revalidations |
| `lib/data/ads.ts` | + `listPubliciteRows()` : campagnes + visuel + emplacements en 2 requêtes (jamais N+1) |
| `app/admin/publicites/page.tsx` | **RÉÉCRIT** — centre de gestion (compteurs réels, bouton, liste/filtres/actions, gestion avancée repliée) |
| `app/admin/publicites/nouvelle/page.tsx` | **NOUVEAU** — charge les données réelles (annonceurs, placements, articles publiés) |
| `components/admin/NouvellePubliciteForm.tsx` | **NOUVEAU** — formulaire unique 6 étapes, upload compressé, aperçu |
| `components/admin/AdsForms.tsx` | + `SimpleStatusButton`/`ExtendControl` (réutilisent les actions durcies) |
| Composants publics `AdSlot`/`AdVisuals`/traqueur/stat | **AUCUN MODIFIÉ** — le rendu, la rotation, la déduplication, les mentions restent exactement ceux validés |

Aucune table, colonne, policy, migration, secret, donnée distante touchés.

## 4. Sécurité (inchangée ET renforcée)

- Toujours : RLS 0026 pour toute écriture, session utilisateur, jamais `service_role`, Zod serveur, `isSafeAdUrl` (aucun open redirect — la route `/ads/click` relit la destination en base d'une créative approuvée d'une campagne réellement en diffusion), retrait de `link_url` du DOM par la SQL de diffusion, images par le pipeline médiathèque (compression navigateur + sniff serveur MIME/dimensions/poids), journalisation code+message sans secret, confirmation avant suppression.
- Nouveaux garde-fous : emplacements incompatibles jamais liés ; publication impossible sans période cohérente ; annonceur impossible sans UUID réel vérifié ; compensation anti-orphelin.

## 5. Tests (tous verts, aucun test sur données réelles)

| Contrôle | Résultat |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| ESLint | 0 erreur / 0 warning |
| Vitest | **191/191** (10 fichiers) — dont 22 nouveaux : durées (7 j exacts, début futur = programmée, personnalisée croisée refusée), compatibilité par format (données réelles seedées), `video` = aucun emplacement (constat documenté), emplacement inactif jamais proposé, annonceur (normalisation, réutilisation, PAS de fusion pour noms proches), prolongation (en cours, expirée → repart de maintenant, sans fin), nom automatique |
| `npm run build` | ✔ 37 routes dont `/admin/publicites` (réécrite) et `/admin/publicites/nouvelle` (nouvelle) |
| `npx opennextjs-cloudflare build` | ✔ worker généré (`.open-next/worker.js`) — **PRÊT, NON déployé** |
| Parcours 12 étapes (§12 mission) | implémentés et contrôlés par les tests du noyau ; les parcours authentifiés complets (rôles admin/editor/reporter, écritures) exigent une session réelle → prévus à la recette direction après déploiement (les écritures de test sur la base distante restant interdites) |

## 6. Compatibilité mobile

Un seul flux vertical, sections numérotées ; boutons et cases ≥ 44 px ; cartes format empilables (`sm:grid-cols-2/3`) ; boutons de la liste passent à la ligne (flex-wrap) ; formulaires en grilles 1 colone sous `sm` ; pas de largeur minimale ; navigation clavier conservée (`aria-pressed`, labels de radio, checkbox h-5). Test visuel desktop effectué via le build ; smartphone Android/iPhone : mêmes classes Tailwind déjà éprouvées, recette direction recommandée au CMS.

## 7. Coût

**0 USD/mois.** Aucun service, aucun abonnement, aucune donnée écrite. Le worker reste dans le plan Cloudflare Free (rotation/ISR/dédupe inchangés), la base reste Supabase Free.

## 8. Reste à faire (hors périmètre sans autorisation)

1. **Recette direction au CMS** — sur `feature/regie-simplifiee` (déploiement à demander) : créer une bannière réelle de bout en bout (étapes 1→6), vérifier l'affichage public et les statistiques.
2. La campagne « Bonnehumeur » actuellement en base reste gérable exactement comme avant (fiche détaillée) et apparaît dans la nouvelle liste.
3. Sur autorisation de DONNÉE distincte : ajouter `video` à `allowed_formats` de `videos_inline` pour débloquer la carte « Vidéo YouTube » (aujourd'hui la publication est refusée proprement avec un message d'aide).
4. Option future documentée : RPC atomique `create_publicite` si le volume le justifie.

## 9. Verdict

La régie utilise désormais **une interface unique, lisible, sans jargon** : la direction crée et publie une publicité en six étapes sans jamais entendre parler de campagne, création, liaison ni validation — mais toutes les tables, toutes les machines à états, toutes les politiques RLS et toutes les validations de la régie complète restent actives à l'identique en coulisses. **Prêt pour la recette direction puis, sur autorisation, le déploiement.**