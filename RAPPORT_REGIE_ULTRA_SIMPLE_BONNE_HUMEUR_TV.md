# RAPPORT DEGRADATION FINALE — RÉGIE PUBLICITAIRE ULTRA SIMPLE · BONNE HUMEUR TV

**Date : 04/11/2026 · Branche `feature/regie-simplifiee` · Base distante : 0 écriture pendant toute la mission · NON déployé (autorisation requise)**

Suite directe du rapport de simplification du 04/11 : la régie passe de « 6 étapes lisibles » à la grille demandée — **1 page unique, 4 étapes maximum, durées en boutons, aperçu avant publication**.

---

## 1. Problèmes découverts depuis le rapport précédent

| # | Constat | Sévérité | Traitement dans ce correctif |
|---|---|---|---|
| P1 | 6 étapes restaient une charge cognitive : un admin naïf devait lire « entreprise → format → contenu → où → durée → publier » dans cet ordre, sans vue d'ensemble | moyen | regroupé en **4 étapes** (étapes annexées : format seul en 1 ; entreprise + contenu fusionnés en 2) |
| P2 | durées « 60 j / 90 j » proposées : au-delà du besoin réel, encombraient l'écran | faible | remplacées par l'exacte grille demandée : **1 jour · 3 jours · 7 jours (défaut) · 15 jours · 30 jours · Choisir une durée** |
| P3 | 7 puces de filtre (Toutes / En diffusion / Suspendues / Programmées / Brouillons / Terminées / Clôturées) = un second tableau de bord | moyen | supprimées : **3 compteurs en haut** (en cours / programmées / terminées) + **3 sections de groupe** réelles |
| P4 | le compteur « Impressions » occupait 25 % du tableau de bord alors que l'audit l'avalise « indicatif, jamais certifié » | faible | retiré du sommet ; statistiques restent dans la « Gestion avancée » (admin) |
| P5 | pas d'aperçu avant publication : l'admin publiait sans jamais voir ce que verrait le visiteur | moyen | **Étape 4 = aperçu fidèle** (bannière, carte, bandeau coloré, vignette YouTube, mention « Sponsorisé », logo partenaire) + gros bouton **« PUBLIER MA PUBLICITÉ »** |
| P6 | le message d'échec parlait de « champ manquant » génériques | faible | chaque champ garde SON message exact (le texte attendu, jamais le nom technique du champ) |
| P7 | la « Gestion avancée » était visible des éditeurs alors qu'un grand écran la concerne admin | mineur | repliée **admin seulement** (les éditeurs publient sans jamais voir cette zone) |

**Aucun nouveau problème de fond** : la cause « aucune créative » (ad_creatives = 0 lignes, diagnostic du jour) reste la clé d'un affichage public pour la campagne existante — l'interface corrigée la résout de bout en bout pour les publications FUTURES.

## 2. Fonctionnalités simplifiées (ce qui a changé pour l'utilisateur)

```
┌  /admin/publicites — LA page unique ─────────────────────────┐
│  [ + Créer une publicité ]        ← un seul gros bouton     │
│  En cours · Programmées · Terminées  ← 3 infos réelles      │
│  ↓ les publicités elles-mêmes, groupées                     │
│     En diffusion — Programmées — Terminées (tout le reste)  │
│  Carte = aperçu réel · Annonceur · Format · Emplacement ·   │
│          Date de fin · Statut + 5 actions :                 │
│   Modifier · Suspendre/Réactiver · Prolonger · Supprimer    │
│   (confirmation uniquement pour Supprimer, admin)           │
│  Gestion avancée repliée — ADMIN seulement — INTACTE        │
└──────────────────────────────────────────────────────────────┘

┌  /admin/publicites/nouvelle — 4 ÉTAPES MAX ──────────────────┐
│  ① QUE VEUX-TU PUBLIER ?   6 cartes visuelles, 1 ligne      │
│                            d'explication chacune            │
│  ② AJOUTER LA PUBLICITÉ    « Entreprise ou annonceur » :    │
│                            liste OU création express —      │
│                            JAMAIS un identifiant technique  │
│                            puis SEULS les champs du format  │
│  ③ OÙ ET COMBIEN DE TEMPS ? emplacements en langage simple  │
│                            (seuls les compatibles, tout     │
│                            précoché) + durées-boutons +     │
│                            « Commencer plus tard » facultatif│
│  ④ VÉRIFIEZ, PUIS PUBLIEZ  aperçu fidèle + PUBLIER MA       │
│                            PUBLICITÉ (+ brouillon discret)  │
└──────────────────────────────────────────────────────────────┘
```

- Un clic sur une carte de format NE CHANGE PAS la question suivante : les étapes ②–④ s'adaptent seules.
- L'entreprise : liste existante OU « Une nouvelle entreprise » (nom + téléphone facultatif) — si le nom correspond à une fiche existante (casse/accents/espaces), elle est **réutilisée sans doublon** ; un nom proche mais DIFFÉRENT crée bien une nouvelle fiche (aucune fusion silencieuse).
- Durées : boutons ≥ 52px, 7 jours présélectionné ; « Choisir une durée » ouvre début+fin (heure de Conakry) ; « Commencer plus tard » → la pub passe à l'état **Programmée** toute seule.
- L'aperçu YouTube montre la vignette réelle dès que le lien est collé (aucun envoi réseau).

## 3. Ce qui a été PRÉSERVÉ (aucune régression, aucune suppression)

- **Server Action `publishSimpleAdAction` inchangée** : mêmes validations Zod par format, `isSafeAdUrl`, période calculée SERVEUR, annonceur UUID réel vérifié, liste blanche `toCampaignRow`, liaisons compatibles lisées de la BASE, compensation anti-orphanelin, RLS 0026 en dernière barrière, session utilisateur (jamais service_role), approbation admin automatique / brouillon éditeur.
- Les écrans avancés (campagnes, annonceurs, emplacements, partenaires, paiements, statistiques, export) existent à l'identique.
- Les pages publiques et la SQL de diffusion : **0 octet modifié**.
- Base distante : **aucune écriture, aucune migration appliquée, aucune donnée touchée**.

## 4. Fichiers modifiés / créés (et uniquement)

| Fichier | Nature |
|---|---|
| `lib/ads/simple-ad.ts` | MODIFIÉ — `SIMPLE_DURATIONS` = exactement les 6 boutons demandés (1j/3j/7j par défaut/15j/30j/libre « Choisir une durée ») |
| `lib/ads/simple-ad.test.ts` | MODIFIÉ — tests de durées alignés (1 j → +24 h, 30 j → +720 h, 6 clés exactes) |
| `lib/ads/parcours-simplifie.test.ts` | **NOUVEAU** — simulation du parcours d'un admin naïf (voir §5) |
| `components/admin/NouvellePubliciteForm.tsx` | **RÉÉCRIT** — 4 étapes numérotées, entreprise simple sans identifiant, champs qui s'adaptent au format, durées-boutons, aperçu fidèle, « PUBLIER MA PUBLICITÉ » |
| `app/admin/publicites/page.tsx` | **RÉÉCRIT** — une page : bouton unique « + Créer une publicité », 3 compteurs, groupes réels, cartes + 5 actions, gestion avancée admin-repliée |
| `app/admin/publicites/nouvelle/page.tsx` | MODIFIÉ — texte d'en-tête 4 étapes |

## 5. Tests effectués et résultats

| Contrôle | Résultat |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| ESLint (`--max-warnings 0` sur les fichiers touchés) | 0 erreur / 0 warning |
| Vitest | **200/200 verts** (11 fichiers) dont 31 nouveaux de l'interface simplifiée |
| `npm run build` | ✔ 37 routes, `/admin/publicites` + `/admin/publicites/nouvelle` incluses |
| `npx opennextjs-cloudflare build` | ✔ worker généré (`.open-next/worker.js`) — **PRÊT, NON déployé** |

**Simulation du parcours obligatoire (`lib/ads/parcours-simplifie.test.ts`) — rejouée avec les fonctions pures réelles :**

| Étape du parcours naïf | Vérification | Verdict |
|---|---|---|
| ouvrir Publicités → **Créer** | 6 cartes de format, libellés/hints sans jargon (regex anti jargon) | ✔ |
| choisir un format | les 5 formats de campagne + partenaire = table dédiée | ✔ |
| champ entreprise | « BONNEHUMEUR  » → fiche existante réutilisée (id réel) ; « Sotulub Guinée » → AUCUNE fiche récupérée (création) ; « Bonne Humeur » (avec espace) reste une AUTRE entreprise par conception | ✔ |
| contenu par format | champs émis = champs du format (schémas Zod inchangés côté serveur) | ✔ |
| où afficher | bannière/bandeau/carte ont ≥ 1 emplacement réel ; vidéo = 0 → message d'aide et publication refusée proprement (constat d'audit) ; sponsorisé = routage Sponsorisé hors zones | ✔ |
| durée 7 jours (défaut) et 1 jour | période = début serveur + n×24 h ; pub visible → passe à Terminée 1 s après la fin | ✔ |
| publier → retrouver en liste | campagne active + période courante → état « diffusing » = groupe « En diffusion » | ✔ |
| **Suspendre → Réactiver** | suspended ≠ diffusing, puis re-active → diffusing | ✔ |
| Prolonger | fin ancrée sur la fin en cours (jamais dans le passé) | ✔ |
| erreurs | durée inconnue, dates croisées, dates manquantes → refus net ; codes d'emplacement incompatibles jamais reliés ; emplacement inactif jamais proposé | ✔ |
| permissions | début futur → « programmed » (pas « diffusing ») ; créative d'éditeur non approuvée → jamais affichée au public (badge « À valider par un administrateur ») | ✔ |

**Création d'annonceur et de campagne — vérifiées spécifiquement** (mission) : la réutilisation sans doublon passe par `matchAdvertiserByNormalized` (nom normalisé EXACT, tests verts) ; l'INSERT d'un nouvel annonceur, l'écriture campagne/création/liaisons et l'approbation admin nécessitent une session réelle — **non simulées à l'aveugle, prévues en recette direction** (les écritures de test sur la base distante restent interdites).

## 6. Limitations restantes (honnêteté)

1. **La vidéo reste inutilisable en diffusion** : `videos_inline.allowed_formats = ["card"]` en base — une MISE À JOUR DE DONNÉE (pas un schéma) est nécessaire, interdite sans autorisation : `update ad_placements set allowed_formats = allowed_formats || 'video' where code='videos_inline';` — l'interface, elle, refuse proprement avec un message explicite.
2. **Écritures de bout en bout non exécutables en test** : sans session, le parcours n'a été validé que sur la chaîne pure ; la recette direction (créer une vraie pub depuis un navigateur) reste l'étape finale.
3. L'interface en anglais de Tailwind a été contrôlée au build desktop ; smartphone : mêmes classes éprouvées, recette visuelle recommandée.
4. Les statistiques/impressions ne sont pas sur la page ultra simple (choix de sobriété) : elles existent dans la Gestion avancée (admin).
5. La campagne « Bonnehumeur » existante continue de dépendre de la création d'une créative approuvée pour s'afficher (cause du ticket du jour, hors périmètre de données).

## 7. Migrations préparées

**AUCUNE.** Aucune migration, aucun schéma, aucune policy, aucune fonction SQL — la simplification tient intégralement dans l'interface et les actions, comme exigé.

## 8. Opérations nécessitant encore votre autorisation

1. **Déploiement Cloudflare** de la branche `feature/regie-simplifiee` (worker prêt, rien de déployé).
2. **Push GitHub** + **fusion de branche** : rien de poussé, rien de fusionné.
3. **Mise à jour de donnée unique** pour débloquer la vidéo : `allowed_formats` de `videos_inline` += `video` (une ligne, réversible).
4. Recette direction au CMS (créer une pub réelle de bout en bout) — possible après (1).

## 9. Verdict

La régie tient enfin la promesse demandée : **une page, un gros bouton, quatre étapes, un aperçu, « PUBLIER MA PUBLICITÉ »** — sans jamais cacher la mécanique réelle (toutes les tables, politiques RLS et validations d'origine restent actives à l'identique) et sans un franc de coût supplémentaire (Cloudflare Workers Free + Supabase Free, 0 USD/mois). Prêt pour la recette direction puis, sur votre autorisation, le déploiement.