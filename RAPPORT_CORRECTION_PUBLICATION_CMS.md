# RAPPORT DE DIAGNOSTIC — BOUTON DE PUBLICATION ABSENT DU CMS
## Correction urgente · 3 novembre 2026

**Mission** : identifier pourquoi l'administrateur ne voit aucun bouton permettant de
publier un article, puis proposer la correction. **Aucune modification effectuée
à ce stade** — ce rapport précède tout changement (conformément à la consigne).

---

## 1. VERDICT : la publication FONCTIONNE côté serveur — c'est une défaillance d'INTERFACE

**Le backend est 100 % opérationnel et prouvé.** Ce qui manque est un **bouton visible** :
la publication existe mais est **dissimulée dans un menu déroulant**, derrière un bouton
générique « Enregistrer l'article ».

### La cause exacte (prouvée ligne par ligne)

| Constat | Fichier / ligne |
|---|---|
| Le formulaire d'article possède bien une option « Publier »… mais **uniquement dans le champ `<select>` « Statut * »** de la colonne latérale — personne ne la remarque | `components/admin/ArticleForm.tsx:16-22` (`STATUS_OPTIONS_STAFF`) et `:129` (le `<select>`) |
| Le **seul** bouton d'action est « Enregistrer l'article » (libellé générique, même couleur que les brouillons) | `ArticleForm.tsx:293` (`SubmitButton label="Enregistrer l'article"`) |
| Sur la **liste** `/admin/articles`, les seules actions par article sont « Modifier » et « Supprimer » — **aucune action rapide de publication** | `app/admin/articles/page.tsx:115-130` |
| **Aucune confirmation** avant publication (clic = publication directe, sans dialogue) | `ArticleForm.tsx` (aucun confirm) |
| Message de succès actuel générique : « Article enregistré. » (même pour une publication) | `lib/actions/content.ts:161` |

### Ce qui a été VÉRIFIÉ COMME FONCTIONNEL (aucun bug backend)

1. **Role transmis correctement** : `new/page.tsx:20` et `[id]/page.tsx:39` passent
   `guard.session.profile?.role` — et `requireRole` (`lib/auth/session.ts:50`)
   **garantit** que le profil existe et que le rôle ∈ {admin, editor, reporter} → un
   admin reçoit bien les options staff (bogue « rôle mal lu = options reporter » **écarté**).
2. **`saveArticle` accepte le statut `published`** pour admin/editor et pose
   `published_at = now` à la première publication (« figé ensuite » — `content.ts:112-114`) ;
   il refuse proprement les statuts interdits au reporter (`content.ts:80-82`).
3. **RLS** : la transition draft→published par un staff authentifié a été **prouvée en
   base réelle** (test T6 des 18/18 du 02/11) — aucun obstacle côté policy.
4. **Transitions autorisées** : `draft` / `review` / `scheduled` (date obligatoire,
   `content.ts:84-88`) / `published` / `archived`, avec le pg_cron qui publie
   automatiquement les `scheduled` (job actif vérifié) ; « Dépublier » = repassage au
   statut `draft` (possible dès aujourd'hui via le select).
5. Affichage post-publication sur `/actualites` : garanti par l'architecture (chaque
   requête re-rend sur Workers + `revalidatePath` dans `saveArticle`), à confirmer
   manuellement après correction.

**Conclusion : l'option existe, mais l'interface ne la montre PAS comme une commande de
publication.** Pour publier aujourd'hui, il faut : ouvrir la colonne latérale →
sélectionner « Publier » dans « Statut * » → cliquer « Enregistrer l'article ». Un
administrateur qui cherche un bouton « Publier » ne peut pas le trouver.

## 2. CORRECTION PROPOSÉE (avant toute écriture dans le code)

### A. Formulaire d'article — barre d'actions explicite (« Publier » devient un vrai bouton)

Remplacer le bouton unique par **trois boutons contextuels** (le serveur reste l'unique
arbitre — RLS et rôles inchangés, **aucun contournement**) :

| Bouton | Rôle | Comportement |
|---|---|---|
| **« Enregistrer comme brouillon »** | tous | force `status=draft` et enregistre |
| **« Publier maintenant »** | admin+editor (rouge, proéminent) | **dialogue de confirmation** (« Publier définitivement cet article sur le site public ? ») puis `status=published` + `published_at=now` |
| **« Programmer la publication »** | admin+editor | affiche/valide la date `scheduled_at` puis `status=scheduled` |
| « Soumettre à validation » | reporter | `status=review` (inchangé) |

- Le champ « Statut » conservé comme réglage avancé (transitions `review`, `archived`,
  dépublication) — tout reste un seul appel `saveArticle` : **pas de nouvelle table, pas
  de migration, pas de contournement RLS**.
- **Message de succès différencié** : « Article publié. » / « Article programmé pour le … » /
  « Brouillon enregistré. » (messages actuels conservés en cas d'erreur, avec
  detail du champ).

### B. Liste `/admin/articles` — action rapide « Publier » sur chaque brouillon

Pour les articles `draft`/`review` (staff uniquement) : bouton « Publier » sur la ligne
avec **confirmation**, s'appuyant sur **une nouvelle petite Server Action
`publishArticle(id)`** (admin/editor) qui : vérifie session + rôle via `requireRole`,
passe l'article en `published` (l'UPDATE reste sous **RLS articles_update** existante,
aucun client service_role), `revalidatePath` identique à `saveArticle`.
→ ~20 lignes dans `lib/actions/content.ts` (cœur réutilisé), 0 SQL, 0 migration.

### C. Reporters / éditeurs — droits respectés

- Reporter : bouton « Publier » **jamais rendu** dans l'UI ; s'il était forcé
  (devtools), `saveArticle` le refuse (`content.ts:80`) **et** la RLS le refuserait
  (double barrière testée T6/anti-élévation) — comportement inchangé et prouvé.
- Editor : publie lui-même. Admin : publie et peut modifier les rôles.
- **Droits exactement identiques à aujourd'hui** : la correction ne change AUCUNE
  permission, elle rend visibles celles qui existent.

### D. Vérifications après correction (plan de test)

1. `npx tsc --noEmit`, `npm run lint`, `npm test` (55/55), `npm run build`.
2. Preview `wrangler dev` : les 3 boutons s'affichent selon le rôle ; confirmation
   effective avant publication ; message de succès correct.
3. Publication d'un article de test → vérification `/actualites` (écriture en base —
   liste séparée, exige l'autorisation de la direction, comme les tests 18/18).
4. Droits reporter : se connecter en reporter (compte de test éphémère, si autorisé).
5. **Redéploiement Cloudflare UNIQUEMENT après feu vert** (branche
   `deploy/cloudflare-staging`, même procédure que le déploiement réussi).

## 3. Fichiers qui seront modifiés (prévus)

| Fichier | Nature |
|---|---|
| `components/admin/ArticleForm.tsx` | barre de 3 boutons + confirmation + libellés (le select reste) |
| `app/admin/articles/page.tsx` | action rapide « Publier » sur les brouillons (staff) |
| `lib/actions/content.ts` | +`publishArticle` (~20 lignes) ; messages de succès différenciés |
| `docs/tests` | tests unitaires zod/transition complétés si nécessaire |

Aucun autre fichier, aucune migration SQL, aucune table, aucune donnée lue ou écrite
pendant ce diagnostic.

---

**Cause exacte : défaillance d'interface — la publication est enterrée dans un menu
« Statut » derrière un bouton « Enregistrer l'article ». Backend, rôles, RLS et
transitions : tous fonctionnels et prouvés. Correction proposée : boutons explicites
« Enregistrer comme brouillon / Publier maintenant / Programmer la publication » avec
confirmation, action rapide sur la liste, messages différenciés, rôles strictement
inchangés.**

J'attends votre **feu vert** pour appliquer la correction (aucun fichier modifié à ce
stade).