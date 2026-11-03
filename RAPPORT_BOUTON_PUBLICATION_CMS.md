# RAPPORT DE CORRECTION — BOUTON DE PUBLICATION DU CMS
## Bonne Humeur TV · 3 novembre 2026 · branche `deploy/cloudflare-staging`

**Mission** : suite au rapport de diagnostic (d2932b4) qui avait établi que la publication
existait côté serveur mais était **enterrée dans le menu « Statut »** derrière un bouton
générique « Enregistrer l'article », la direction a donné le feu vert :
*« feu vert, applique la correction et redeploye »*. Ce rapport décrit tout ce qui a été
fait, en application, en vérification et en déploiement.

---

## 1. CE QUI A ÉTÉ CRÉÉ / MODIFIÉ (6 fichiers, +219/−15)

### A. `lib/actions/content.ts` — le cœur serveur (aucun contournement de sécurité)

1. **Boutons à « intention » dans `saveArticle`** — un mapping serveur applique le
   statut selon le bouton cliqué :

   ```ts
   const INTENT_STATUS = { draft: "draft", review: "review",
                           publish: "published", schedule: "scheduled" };
   const intent = ...formData.get("intent")...;
   const status = intent ? INTENT_STATUS[intent] : input.status;
   ```

   Pourquoi ce choix : le navigateur garantit que `name="intent"` / `value="…"` du
   **bouton soumis** sont placés dans la FormData au moment exact de l'envoi —
   **aucun état client, aucune course (race condition), pas de JS obligatoire**.
   Toutes les validations existantes s'appliquent ensuite INCHANGÉES au `status`
   résultant : garde reporter (draft/review uniquement), date obligatoire pour
   `scheduled`, `published_at = now` à la première publication (figé ensuite),
   refus par la RLS le cas échéant.

2. **Messages de succès différenciés** (fin de `saveArticle`) :
   - « **Article publié.** » + **redirection vers `/actualites/[slug]`** (vérification
     visuelle immédiate de l'article en ligne) ;
   - « Article programmé : il passera automatiquement en ligne à l'échéance indiquée. »
   - « Article soumis à la validation d'un éditeur. »
   - « Brouillon enregistré. » / « Article archivé. »

3. **Nouvelle Server Action `publishArticle`** (publication rapide depuis la liste) :
   - `requireRole(["admin","editor"])` — session + rôle vérifiés serveur ;
   - UUID validé via `deleteArticleSchema` existant (aucun nouveau schéma) ;
   - lecture `status, published_at, slug` → article introuvable = message neutre
     (« Article introuvable ou vous n'avez pas la permission de le publier. ») ;
   - déjà publié = « Cet article est déjà publié. » (idempotent, honnête) ;
   - UPDATE `{ status:"published", published_at: existant ?? now }` — l'UPDATE passe
     par le client de session sous **RLS `articles_update` existante**, jamais
     service_role ;
   - `revalidatePath` ×4 identique à `saveArticle` ("/", "/actualites", la fiche
     publique, "/admin/articles") ;
   - **0 nouvelle table, 0 migration, 0 SQL modifié, 0 contournement RLS.**

### B. `components/admin/ArticleForm.tsx` — la barre d'actions visible

Remplacement du bouton unique « Enregistrer l'article » par une **barre contextuelle
selon le rôle** :

| Bouton | Rôles | Comportement |
|---|---|---|
| **Enregistrer comme brouillon** | tous | `intent=draft` |
| **Publier maintenant** (vert, proéminent) | admin + editor | dialogue `window.confirm` (« Publier cet article sur le site public ? Il sera visible immédiatement. ») puis `intent=publish` |
| **Programmer la publication** | admin + editor | **garde locale** : sans date `scheduled_at` le clic est annulé et un message `role="alert"` s'affiche (« Indiquez d'abord la date… ») + focus sur le champ |
| **Soumettre à validation** | reporter | `intent=review` |
| Transition avancée — statut du menu | tous | sans `intent` : applique le statut du select (archiver, dépublier, review…) |

- Le select « Statut » est **conservé** pour les transitions avancées (archiver,
  dépublier), avec une aide sous le champ expliquant la priorité des boutons.
- Le reporter ne voit **jamais** de bouton « Publier » (règle métier inchangée) ;
  s'il falsifiait la requête, `saveArticle` le refuse ET la RLS le refuserait
  (double barrière, inchangée).
- Confirmation de publication : `window.confirm` avec `event.preventDefault()` si
  annulation — impossible de publier par accident.

### C. `app/admin/articles/page.tsx` — publication rapide sur la liste

Pour chaque article **draft** ou **review** (staff uniquement) : bouton « **Publier** »
(teinte verte, `DeleteActionForm` en mode `tone="green"`) avec confirmation explicite
(« Publier « {titre} » sur le site public ? Il sera visible immédiatement sur
/actualites. »), branché sur la nouvelle action `publishArticle`. Les articles
`published`/`archived` n'ont pas de bouton de publication ; « Supprimer » (rouge)
reste inchangé.

### D. `components/admin/form-ui.tsx` + `DeleteActionForm.tsx` — supports

- `SubmitButton` : nouveaux props `name`, `value`, `onClick` (le triplet qui rend la
  pattern « intention » possible) + nouvelle **variante « success »** (vert Guinée) ;
  `useFormStatus` continue de désactiver tous les boutons pendant l'envoi.
- `DeleteActionForm` : prop `tone?: "red" | "green"` — mode vert = bouton
  « Confirmer la publication » (rebaptisé), bordure/survol verts ; mode rouge
  (suppression) strictement identique à avant.

### E. `eslint.config.mjs` — correctif annexe (blocage de la chaîne de vérification)

`eslint .` échouait avec **OOM Node (heap 2 Go épuisés)** : ESLint lintait les
bundles GENERÉS `.open-next/**` et `.wrangler/tmp/dev-*/worker.js` (13 Mo sur une
seule ligne). Correctif : ajout de `.open-next/**` et `.wrangler/**` aux `ignores`.
Le code source n'a jamais eu d'erreur — les « 10 erreurs » détectées étaient toutes
dans le bundle généré.

---

## 2. VÉRIFICATION (chaîne complète, tout passé)

| Étape | Résultat |
|---|---|
| `npx tsc --noEmit` | **0 erreur** |
| `npm run lint` (après correctif ignores) | **0 erreur / 0 avertissement** |
| `npm test` (vitest) | **55/55 PASS** |
| `npm run build` (Next 15.5.28) | ✅ compilation + lint intégré + 26 pages générées |
| `npx opennextjs-cloudflare build` | ✅ exit 0 |

---

## 3. DÉPLOIEMENT CLOUDFLARE (feu vert donné)

- Commit **69b9098** sur `deploy/cloudflare-staging` (aucun push GitHub, conformément
  à la règle permanente).
- `npx wrangler deploy` → **12 assets modifiés** uploadés (dont les chunks admin
  articles/form), worker `9923 KiB / gzip 2307 KiB`.
- **Version déployée : `fdc10bfc-d0f7-433c-93ae-b60a51521d49`** (après v2 `fcafd32d`).
- URL inchangée : https://bonne-humeur-tv-preview.bonne-humeur-tv.workers.dev

## 4. VÉRIFICATION EN PRODUCTION RÉELLE

1. **20/20 routes** : 12 × 200 (accueil, actualités, contact, mentions, confidentialité,
   partenariats, recherche, vidéos, robots.txt, sitemap, login admin, icône) ;
   2 × 404 attendus (routes inexistantes) ; 6 × 307 vers `/admin/login` (garde de
   session intacte). **Aucune route anormale.**
2. **Bouton prouvé dans le bundle publié** (chunks téléchargés depuis workers.dev) :
   « Publier maintenant », « Enregistrer comme brouillon », « Programmer la
   publication », « Soumettre à validation », « Transition avancée », le texte de
   confirmation, la garde de date — **tous présents** ; « Publier » + « Confirmer la
   publication » présents dans le chunk de la liste admin.
3. **En-têtes de sécurité** : CSP, HSTS preload, X-Frame-Options DENY, nosniff,
   referrer-policy — tous re-vérifiés en direct.
4. Aucune donnée de production lue ou écrite pendant les vérifications.

---

## 5. LIMITES ET TESTS RESTANT À LA DIRECTION (navigateur, avec login)

L'authentification réelle et l'écriture en base restent des tests **navigateur** de
la direction (règle permanente : écritures = autorisation explicite, faites par vous) :

1. `/admin/articles` → brouillon → bouton vert **« Publier »** → confirmation →
   message « Article publié. » → l'article apparaît sur `/actualites`.
2. Formulaire → **« Publier maintenant »** → confirmation → redirection vers la page
   publique de l'article (vérification visuelle).
3. **« Programmer la publication »** sans date → blocage + message d'erreur (attendu) ;
   avec date → article programmé.
4. Connexion en reporter (compte de test) → aucun bouton publier visible ; le
   serveur refuserait toute tentative forcée.

---

## 6. SÉCURITÉ — CE QUI A ÉTÉ STRICTEMENT PRÉSERVÉ

- **Rôles identiques à avant** : la correction rend visible une capacité existante,
  elle n'en ajoute aucune (reporters ne publient pas, avant comme après).
- **RLS inchangée** : tous les UPDATE passent par le client de session sous
  `articles_update` ; jamais service_role ; aucune nouvelle table, aucune migration.
- **Secrets** : aucune clé dans le navigateur ni dans Git ; aucun secret affiché ;
  `.env.local` et `.dev.vars` restent hors Git ; aucun push.
- **Budget** : 0 USD — déploiement Free Workers (100k req/jour), aucun service payant.

---

**En résumé** : la publication est désormais une commande visible et sûre — bouton vert
« Publier » sur chaque brouillon de la liste, bouton « Publier maintenant » avec
confirmation dans le formulaire, « Programmer la publication » avec garde de date,
« Enregistrer comme brouillon » pour tous, « Soumettre à validation » pour les
reporters, messages de succès différenciés, redirection de contrôle vers l'article
public. Backend, RLS et rôles : strictement inchangés (triple barrière conservée).
Déployé et prouvé en production (20/20 routes, chunks vérifiés, en-têtes intacts).