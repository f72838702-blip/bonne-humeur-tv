# RAPPORT — CORRECTION DE L'ÉDITEUR D'ARTICLES (MULTIMÉDIA)
## Bonne Humeur TV · 3 novembre 2026 · branche `deploy/cloudflare-staging`

**Portée** : Problème 1 (ergonomie insertion YouTube), Problème 2 (couverture
absente du site public), Problème 3 (vidéos en double). Chaque cause est
**démontrée** (base réelle en lecture seule, HTML en ligne, chronologie de
déploiement) — aucune supposition.

**Statut : CORRECTIONS TERMINÉES ET VALIDÉES LOCALEMENT (tsc 0 · lint 0/0 ·
90/90 tests · build Next OK · build OpenNext OK · commits locaux). AUCUNE
modification de politique RLS, aucun secret exposé, aucune suppression de
média, aucune migration touchée, aucun déploiement remote — déploiement
Cloudflare en attente de l'autorisation explicite de la direction.**

---

## 1. CAUSES EXACTES (démontrées)

### Problème 1 — insertion YouTube pénible

Cause démontrée par lecture du code (`ArticleForm.tsx` avant correction) :

- l'insertion ne lisait que le curseur **vivant** du textarea
  (`selectionStart`/`selectionEnd` à l'instant du clic) ;
- **le panneau d'insertion et le clavier virtuel du téléphone font perdre le
  focus au textarea AVANT le clic** : sur mobile la position était perdue
  (curseur par défaut = fin du texte) ;
- aucune action « après le paragraphe » ni « à la fin » ;
- pas de remplacement d'une sélection ;
- pas de déplacement ni de suppression d'un bloc déjà inséré ;
- aucune garde anti double-tap ;
- la liste d'aperçu **dédoublonnait** les IDs — un doublon inséré par erreur
  était invisible pour le rédacteur.

Décision bibliothèque : **Tiptap NON installé**. Tout le cahier des charges
(caret mémorisé, sélection remplacée, 3 modes, déplacement/suppression,
garde anti-doublon) est atteignable en DOM pur sur le textarea actuel + un
module pur testable ; une migration WYSIWYG ferait porter un risque de
régression à la chaîne XSS (échappement avant `marked.parse`) pour le même
résultat éditorial. Justification technique ci-dessus — aucune nouvelle
dépendance (budget inchangé).

### Problème 2 — image de couverture absente du site public

Preuves relevées en lecture seule sur le projet `beinalmwqkxbqitvuobr` :

1. **La base contient `featured_image = null`** pour l'article publié
   (`kldsljgekfdlm`, créé 16:47 UTC, modifié 16:49 UTC) → la page publique
   n'a donc **rien à afficher** : la chaîne d'affichage n'a jamais reçu d'URL.
2. **Le bucket `media` ne contient AUCUN objet créé pendant la fenêtre
   16:47–16:49.** Les deux seuls objets `articles/…` datent de **15:53** —
   donc ANTÉRIEURS à l'article ET au déploiement de la version contenant
   l'uploader (version 4b5f4a0c publiée à **16:21:58 UTC**, chronologie
   `wrangler versions list`). De plus ces deux objets n'ont qu'UNE variante
   par lot (le pipeline de couverture produit ALWAYS full+card+thumb) —
   ce ne sont pas des uploads du formulaire de couverture (qui produit
   toujours full + card + thumb ; un objet isolé = autre origine).
3. **Cause technique structurelle démontrée dans le code** : la limite
   Next.js des Server Actions est **1 Mo par défaut ; le lot complet d'une
   couverture peut atteindre ~1,1 Mo** (full 600 Ko + card 300 Ko + thumb
   200 Ko). Au-delà de 1 Mo, la requête est rejetée AVANT d'atteindre notre
   action : le rédacteur voit alors un échec générique et l'image ne
   peut JAMAIS être liée dans ce cas de figure.

Chaîne d'affichage vérifiée INTACTE (aucun défaut trouvé) : requêtes
`articles.featured_image` (+ ALT) correctes · `ArticleCard` utilise la
variante `card` avec visuel de repli neutre si l'URL est absente (jamais
d'image cassée) · page détaillée utilise la variante `full` · Open Graph /
Twitter utilisent l'URL réelle · CSP `img-src` autorise `https://*.supabase.co`
· `next/image` est déjà `unoptimized` (URL Storage servie telle quelle).

**Conclusion fidèle aux preuves** : le lien « téléversement réussi →
enregistrement de l'article » n'a jamais été complété (dans le cas mesuré),
aggravé par une vraie limite de transport (1 Mo) capable de rejeter des
uploads valides. Correctifs : levée de la limite (3 Mo) + confirmation
explicite « Couverture liée — enregistrez l'article » dans le formulaire.

### Problème 3 — vidéos en double

Preuves : le contenu réel de l'article contient **le même marqueur deux
fois** — `[[youtube:46eoreAaqVM]]\r\n\r\n[[youtube:46eoreAaqVM]]…` ; le HTML
en ligne contient **exactement 2 iframes** `youtube-nocookie.com/embed/46eoreAaqVM`.
- le moteur `renderArticleSegments` rend **chaque occurrence** (par conception,
  il ne déduplique PAS : un rédacteur doit pouvoir insérer volontairement deux fois
  la même vidéo) → cause démontrée = **le marqueur apparaît deux fois dans le
  contenu Markdown**, inséré deux fois par l'éditeur (double-tap possible, pas
  de garde) ;
- correction appliquée DU CÔTÉ ÉDITEUR (garde anti double-tap + liste des
  occurrences individuelles avec badge « N× ce bloc » et suppression d'un
  doublon en un clic) — **aucune** suppression automatique de contenu.

---

## 2. FICHIERS MODIFIÉS / CRÉÉS

| Fichier | Nature |
|---|---|
| `lib/content/editor-video.ts` | **NOUVEAU module pur** (aucun DOM, testable) : insertion 3 modes (curseur avec remplacement de sélection / après le paragraphe / fin), occurrences individuelles, suppression d'une occurrence (ligne + ligne vide résiduelle, texte voisin intact), déplacement d'une occurrence, **cartographie exacte du curseur** par préfixe commun, revalidation stricte de l'ID (11 caractères) |
| `lib/content/editor-video.test.ts` | **NOUVEAU** : 26 tests (début/milieu/fin, remplacement de sélection, déplacement avant/après, suppression d'un doublon précis, bornes absurdes, IDs injetables refusés, préservation octet par octet du texte hors édition) |
| `components/admin/ArticleForm.tsx` | Panneau vidéo refondu : **curseur mémorisé** (capture sur `select/click/keyup/pointerup/touchend/blur` — mobile inclus), 3 boutons d'insertion, **garde anti double-tap (350 ms)**, restauration focus+caret après insertion, liste des occurrences avec doublons marqués + « Déplacer au curseur » / « Supprimer », indication du lieu d'insertion (extrait du paragraphe + numéro de ligne) |
| `next.config.ts` | **`experimental.serverActions.bodySizeLimit: "3mb"`** — le lot couverture (≈1,1 Mo max) ne peut plus être rejeté par la limite par défaut de 1 Mo |
| `components/admin/CoverImageUploader.tsx` | Confirmation visible et permanente « ✔ Couverture liée — enregistrez l'article maintenant » (empêche la confusion « téléversé = enregistré ») |

Chaîne de rendu public, RLS, policies, migrations, secrets : **inchangés**.

## 3. COMPARAISON AVEC LE CAHIER DES CHARGES (Problème 1)

| Exigence | Réponse |
|---|---|
| `selectionStart`/`selectionEnd` conservés | Capture à chaque événement + snapshot au blur |
| Position conservée à l'ouverture du panneau | `captureCaret()` sur le bouton d'ouverture |
| Focus + curseur restaurés après insertion | `applyContent` (focus, `setSelectionRange`, bornés) |
| Remplacement d'une sélection par le bloc | Mode « Au curseur » avec sélection |
| Indication claire de l'emplacement | Note verte : mode + extrait d'ancre + N° de ligne |
| Insérer au curseur / après le paragraphe / à la fin | 3 boutons distincts |
| Déplacer / supprimer un bloc inséré | Par occurrence : « Déplacer au curseur » / « Supprimer » |
| Un clic ne multiplie pas les insertions | Garde temporelle 350 ms + URL vidée après succès |
| Écrans tactiles (Android/iOS/tablettes) | Curseur mémorisé AVANT perte de focus (clavier/panneau), cibles tactiles ≥ ~44 px, `touch-*` conservé |
| Markdown jamais réécrit en bloc | Le module pur ne touche que les caractères autour du point d'édition (tests octet par octet) |
| WYSIWYG / nouvelle bibliothèque | Étudié et **refusé** (justification §1) — aucune dépendance ajoutée |

## 4. TESTS EXÉCUTÉS (locaux, ce que je peux prouver)

| Contrôle | Résultat |
|---|---|
| `npx tsc --noEmit` | **0 erreur** |
| `npm run lint` (eslint ., ignores .open-next/.wrangler) | **0 erreur / 0 avertissement** |
| `npm test` | **90/90** (64 existants intacts + 26 nouveaux module éditeur) |
| `npx next build` | **OK** (exit 0) |
| `npx opennextjs-cloudflare build` | **OK** (exit 0, worker généré) |

Tests navigateur/mobile restant **à la direction** (impossible ici sans
session authentifiée réelle ni contenu fictif en base distante — interdit) :
insérer au début/milieu/fin, remplacer une sélection, déplacer, supprimer,
sauvegarder/recharger, tester sur téléphone, compter les iframes, uploder
JPEG/PNG/WebP puis brouillon→réouverture→publication→affichage pages/cartes/
mobile/URL directe/Open Graph.

## 5. COMPATIBILITÉ MOBILE

- Curseur : capturé sur `onPointerUp`/`onTouchEnd`/`onSelect`/`onBlur` — le
  clavier virtuel ou le panneau peut voler le focus, la position mémorisée
  prime à l'insertion.
- Restauration : `focus()` puis `setSelectionRange()` bornés (try/catch pour
  les anciens navegadores tactiles).
- Boutons du panneau : tailles de cible tactiles augmentées (py-3, grille
  1 colonne sur mobile / 3 colonnes sur écran large).

## 6. IMPACT PERFORMANCE

- Aucune dépendance ajoutée (bundle inchangé) ; module pur ~180 lignes, sans
  runtime.
- Le miroir de contenu (état React) recalcule la liste des occurrences UNIQUEMENT
  quand le panneau est ouvert — aucune boucle d'effet, aucun listener global.
- `bodySizeLimit: "3mb"` n'élargit QUE Server Actions (plafond bucket 2 Mo
  par fichier inchangé) ; coût identique, ressource gratuite.
- Rendu public : aucune modification → aucun impact.

## 7. BUDGET

**0 USD/mois confirmé** — aucune nouvelle bibliothèque, aucun service, aucune
souscription ; tout repose sur les services Free existants.

## 8. DÉPLOIEMENT — NON EFFECTUÉ (en attente)

Le rapport précède tout déploiement, conformément à la consigne. Prêt, même
procédure que les déploiements réussis (`npx wrangler deploy`, worker
`bonne-humeur-tv-preview` uniquement). Aucun push GitHub.

## 9. RECOMMANDATION DIRECTION (test visuel 5 minutes après déploiement)

1. Ouvrir l'article de test actuel : supprimer le doublon via le panneau
   (bouton « Supprimer » sur l'une des deux occurrences listées) puis
   réenregistrer → la page publique n'affichera plus qu'un seul lecteur.
2. Créer un nouvel article : uploader une couverture (confirmation verte) →
   « Enregistrer comme brouillon » → rouvrir le brouillon (la couverture
   doit être réaffichée) → publier → vérifier page détaillée, carte d'accueil,
   et l'aperçu de partage (Open Graph).
3. Insérer une vidéo : début, milieu (après le paragraphe), fin, puis sur
   téléphone (curseur mémorisé). Compter les lecteurs sur la page publique.