# RAPPORT — UPLOAD D'IMAGES ET INTÉGRATION YOUTUBE DANS LE CMS
## Bonne Humeur TV · 3 novembre 2026 · branche `deploy/cloudflare-staging`

**Mission** : (A) sélection d'une image de couverture directement depuis l'appareil
(compression automatique + téléversement Supabase Storage) et (B) insertion de vidéos
YouTube à l'emplacement exact du curseur dans le corps d'un article.

**Statut : PRÊT POUR DÉPLOIEMENT — aucun déploiement distant effectué (en attente du feu
vert de la direction, conformément à la consigne). Tout a été testé localement
(chaîne complète : tsc, lint, 64/64 tests, builds, preview Cloudflare, smoke Storage
réel avec nettoyage).**
Budget : **0 USD/mois confirmé** (aucun nouveau service, aucune souscription).

---

## 1. FICHIERS MODIFIÉS / CRÉÉS (13)

| Fichier | Nature |
|---|---|
| `components/admin/CoverImageUploader.tsx` | **Nouveau** — sélecteur de fichier (ordinateur + téléphone), compression navigateur, prévisualisation avant/après, envoi, Réessayer, Supprimer |
| `components/shared/YouTubeEmbed.tsx` | **Nouveau** — iframe publique responsive 16:9, youtube-nocookie, lazy, plein écran |
| `components/admin/ArticleForm.tsx` | Section « Image de couverture » + champ ALT + bouton « Insérer une vidéo YouTube » avec insertion à la position du curseur et aperçu |
| `lib/actions/admin.ts` | **Nouvelle** Server Action `uploadArticleCoverAction` (pipeline médiathèque réutilisé, service_role côté serveur) |
| `lib/content/markdown.ts` | **Nouvelle** segmentation `renderArticleSegments` : marqueur `[[youtube:ID]]` revalidé, Markdown échappé inchangé |
| `lib/content/markdown.test.ts` | +9 tests (segments, XSS, marqueurs malformés) |
| `app/actualites/[slug]/page.tsx` | Rendu par segments, ALT réel sur l'image, données structurées vidéo conditionnelles |
| `lib/validation/schemas.ts` | + `featured_image_alt` (texte simple max 300) |
| `lib/types.ts`, `lib/data/articles.ts`, `lib/data/admin-content.ts` | champ ALT dans l'article ; sélections `*` pour tolérer l'absence de colonne avant migration (voir §6) |
| `lib/actions/content.ts` | saveArticle transmet l'ALT uniquement s'il est renseigné ; erreur 42703 traduite en message compréhensible |
| `supabase/migrations/0023_featured_image_alt.sql` | **Nouvelle migration — FAITE MAIS NON APPLIQUÉE** (voir §6 — nécessité démontrée) |
| `lib/media/compress.ts`, `lib/media/sniff.ts` | **Réutilisés tels quels** (audités) — aucun changement |

## 2. FONCTIONNEMENT DU NOUVEL UPLOAD (Partie A)

1. « **Choisir depuis mon appareil** » ouvre le sélecteur natif (ordinateur OU
   téléphone ; `accept="image/jpeg,image/png,image/webp"`).
2. **Compression navigateur immédiate** (module existant `compress.ts`, audité
   intégralement avant réutilisation) : canvas, **ratio préservé** (aucun recadrage),
   plafond 1920 px, **WebP** (repli JPEG si le navigateur ne sait pas encoder),
   **métadonnées EXIF (GPS inclus) supprimées** par ré-encodage, deux passes qualité.
   Variantes produites : `full` (grande, plafond 600 Ko), `card` (800 px), `thumb` (480 px).
3. **Prévisualisation** : affichée AVANT validation (original) et APRÈS compression, avec
   **nom de fichier, taille initiale → taille compressée** affichés, et indicateur
   (« Compression en cours… » / « Téléversement… »).
4. **Téléversement** : `uploadArticleCoverAction` → réutilisation exacte du pipeline
   médiathèque (`uploadMediaVariants`) : **serveur uniquement**, service_role côté
   serveur exclusivement, **sniff binaire réel (magic bytes)**, MIME déclaré vs contenu
   réel, dimensions réelles, plafonds par variante + **2 Mo absolu** (plafond du bucket),
   dossier logique `articles/`, nom commun aux variantes, `upsert:false`.
5. **Après succès** : URL publique réelle renvoyée → **le champ de couverture de
   l'article est prérempli automatiquement**, l'aperçu reste affiché pendant les autres
   modifications du formulaire (état React conservé).
6. **« Remplacer l'image »** → relance le sélecteur ; **« Supprimer la couverture »**
   vide le champ (aucune suppression côté Storage). **« Réessayer »** conserve le
   fichier choisi après un échec de compression ou de réseau.

### Gestion des erreurs (toutes affichées clairement, jamais silencieuses)

- Format non pris en charge (y compris **HEIC non converti** : l'aperçu échoue
  proprement avec message explicite, rien n'est envoyé).
- Image illisible par le navigateur (décodage impossible).
- Image encore trop lourde après compression (comparaison aux plafonds serveur AVANT
  l'envoi — aucun envoi qui échouera côté serveur).
- Dimensions trop grandes pour la mémoire de l'appareil → message dédié.
- Échec réseau/téléversement → « Réessayer ».
- **Anti-doublon** : l'upload se déclenche une seule fois par sélection (boutons
  désactivés pendant les phases) ; **zéro orphelin** : chaque fichier créé par le
  smoke test a été supprimé (vérifié par la liste réelle du bucket). Règle respectée :
  **aucune suppression automatique d'un ancien média** (il peut servir à un autre
  article) — le nettoyage reste manuel dans la médiathèque.

## 3. COMPORTEMENT DE COMPRESSION (mesures et plafonds)

Mesure en conditions réelles exécutée par le navigateur du rédacteur — le formulaire
affiche en direct « taille initiale → taille compressée » ; le pipeline a été validé
octet par octet côté serveur :

| Étape | Valeur vérifiée en code/test |
|---|---|
| Dimension max `full` | 1920 px, ratio préservé (plafond serveur 2000 px — marge) |
| Qualité | 0,85 ; seconde passe 0,65 si le poids visé est dépassé (jamais sous 0,5) |
| Poids visé/plafond | visé 500 Ko → **plafond serveur 600 Ko** ; refus avant envoi au-delà |
| Plafond absolu bucket | 2 Mo (jamais atteignable par le client, revalidé serveur) |
| Formats acceptés | JPEG, PNG, WebP (+GIF existant dans la médiathèque) ; EXIF supprimés |

Le test serveur réel a prouvé : un fichier de 601 Ko est refusé, une image de
2500 px est refusée, un faux fichier renommé .jpg est refusé (sniff).

## 4. INTÉGRATION YOUTUBE (Partie B)

1. Bouton « **Insérer une vidéo YouTube** » sous le champ contenu ; le panneau
   explique : curseur dans le texte → coller le lien → « Insérer à l'emplacement du
   curseur ». **Aucune autre URL du formulaire n'est touchée.**
2. **Formats reconnus** : `youtube.com/watch?v=…`, `youtu.be/…`,
   `youtube.com/shorts/…`, `youtube.com/embed/…`, `youtube.com/live/…`, ou l'ID brut.
   Extraction par le module existant `lib/youtube/url.ts` (domaines YouTube stricts,
   tout autre domaine REFUSÉ) — testé par la suite existante (5 formats + domaine
   malveillant + malformé).
3. **Bloc stable en Markdown** : le curseur reçoit une ligne dédiée
   ```
   [[youtube:dQw4w9WgXcQ]]
   ```
   entourée de lignes vides, insérée à la position exacte (normalisation locale,
   aucun autre caractère modifié). Le bloc **survit aux modifications successives**
   (le texte n'est ni supprimé ni reformatté). Un aperçu (ID, URL, miniature YouTube)
   s'affiche dans le panneau d'édition.
4. **Rendu public** : `renderArticleSegments` découpe le corps en segments —
   blocs Markdown rendus SÛR (comme avant) et blocs vidéo validés (l'ID est
   **revalidé deux fois** : regex 11 caractères + `extractYouTubeId`). La page
   publique rend les segments dans l'ordre → la vidéo apparaît **exactement à la
   position choisie** (après un paragraphe, entre deux, avant la conclusion…).
5. **`YouTubeEmbed`** : responsive 16:9 (Shorts affichés dans le même cadre,
   letterbox raisonnable), `loading="lazy"`, **youtube-nocookie.com**, titre
   accessible, plein écran, permissions limitées à celles exigées par l'embed
   YouTube, sous-titre « Source : YouTube » avec lien nofollow. La **CSP existante
   est respectée** : `frame-src` n'autorise déjà QUE `www.youtube-nocookie.com` (et
   Turnstile) — vérifié dans `next.config.ts`, aucune modification faite.

## 5. SÉCURITÉ DU RENDU MARKDOWN (point critique) — PROTÉGÉ

La protection existante est **INTÉGRALEMENT CONSERVÉE** :

- `renderMarkdownToHtml` inchangé : échappement HTML intégral **avant** `marked.parse`
  (4 tests XSS existants ré-exécutés).
- **Aucune iframe n'est produite depuis du HTML utilisateur** : seule la ligne exécpte
  `[[youtube:11-caractères-stricts]]` est reconnue ; tout le reste — y compris
  `[[youtube:<script>…]]`, `[[youtube:12caractères]]`, un marqueur au milieu d'un
  paragraphe — reste du **texte échappé inoffensif** (testé unitairement, 5 nouveaux
  tests de blocage).
- L'iframe est construite par `YouTubeEmbed` **uniquement** à partir d'un ID validé ;
  jamais depuis une URL fournie librement ; les autres iframes du site restent
  Turnstile + YouTube (page vidéos), inchangées.
- Aucune policy RLS modifiée, aucun secret côté navigateur (la clé service_role
  n'intervient que dans `lib/data/media.ts`, module serveur), pas de service_role
  contourné, pas de HTML arbitraire possible.

## 6. MIGRATION 0023 — FAITE, NON APPLIQUÉE (décision à la direction)

La consigne exige un **champ ALT** pour l'accessibilité/SEO, mais **aucun champ ne
peut porter ce texte** et interdire un nouveau champ SQL était impossible sans
retirer une exigence explicite (nécessité démontrée). Concrètement :

- `supabase/migrations/0023_featured_image_alt.sql` : `alter table public.articles
  add column featured_image_alt text;` — **aucune autre table, aucune policy**
  (les politiques RLS par ligne s'appliquent aux nouvelles colonnes sans changement).
- **Non appliquée au serveur** (écriture distante = autorisation requise). Pour
  l'activer : `npx supabase db push` (comme les déploiements précédents).
- **Tolérance intégrée** : les lectures d'articles utilisent une sélection `*`
  (convention déjà présente dans le code) → **le site fonctionne parfaitement avant
  et après l'application** ; l'ALT apparaît simplement après activation. Si un
  rédacteur renseigne l'ALT avant l'activation, `saveArticle` traduit l'erreur 42703
  en message clair (« enregistrez sans ALT ou faites appliquer la migration ») au lieu
  d'un échec opaque.

## 7. TESTS EXÉCUTÉS ET RÉSULTATS

| Test | Résultat |
|---|---|
| `npx tsc --noEmit` | **0 erreur** |
| `npx eslint app components lib` | **0 erreur / 0 avertissement** |
| `npm test` (vitest) | **64/64** (55 existants + 9 nouveaux segments/XSS + suites YouTube/sniff intactes) |
| **Smoke Storage RÉEL** (temporaire, supprimé ensuite) | **6/6** : JPEG✓, PNG✓, WebP✓ téléversés + **lecture publique 200** ; refus dimension 2500px✓ ; refus 601 Ko✓ ; refus faux fichier .jpg✓ ; refus vide✓ ; **zéro orphelin** (liste réelle du bucket après suppression) |
| `npm run build` (Next 15.5.28) | **OK** (26 pages, exit 0) |
| `npx opennextjs-cloudflare build` | **OK** (worker généré, exit 0) |
| Preview Cloudflare (`wrangler dev`, locale) | **OK** : `/` 200, `/actualites` 200, `/contact` 200, `/admin` 307, `/admin/articles/new` 307, `/admin/medias` 307 (gardes intactes) |
| Tests navigateur (rédacteur réel) | **À LA DIRECTION** : upload depuis téléphone, aperçu, vidéo insérée au milieu du texte, affichage public, responsive |

**Constat CDN** : après suppression d'un objet Storage, la lecture publique peut
rester 200 un court instant (cache CDN Supabase, indépendant de notre code) — la
suppression réelle a été vérifiée par la liste du bucket.

## 8. LIMITATIONS CONNUES

- Le champ ALT exige l'application de la migration 0023 (§6) — sinon message clair.
- Les GIF animés ne sont pas recompressés (comportement existant conservé).
- Un Short s'affiche en cadre 16:9 (bandes noires) — sans API on ne connaît pas le
  format d'un ID ; le rendu reste propre.
- L'aperçu d'édition utilise la miniature YouTube (rapide en mobile) ; la vraie
  iframe apparaît sur la page publique.
- Le champ Statut (transitions avancées : archiver, dépublier) reste inchangé.

## 9. DEPLOIEMENT — PRÉPARÉ, NON EXÉCUTÉ

Procédure prête (aucune écriture distante effectuée) :
1. **Feu vert direction** pour : application migration 0023 + déploiement Cloudflare.
2. `npx supabase db push` (1 commande — ajoute uniquement la colonne ALT).
3. `npx wrangler deploy` (même procédure que les deux déploiements réussis).
4. Vérification 20 routes + publication d'un article de test depuis le navigateur
   direction (couverture + vidéo).

**Budget : 0 USD/mois — confirmé.** Aucun nouveau service, aucune souscription
(pas de Cloudflare Images, pas de service de compression payant, pas de R2,
pas de nouvelle base de données) ; tout repose sur les services Free existants
(Storage, Workers, canvas navigateur).