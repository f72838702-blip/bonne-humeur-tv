# RAPPORT CORRECTION — BUG « CRÉATION INCOMPLÈTE » (impossible de publier, avec entreprise existante OU nouvelle) · BONNE HUMEUR TV

**Date : 04/11/2026 · Branche locale `fix/alt-text-form-reset` (commit `dd59cd2`) · DÉPLOYÉ sous autorisation → Version Cloudflare `2b933fff` · Aucune migration, aucune donnée touchée, aucune RLS modifiée, aucune validation affaiblie**

---

## 1. Le bug vécu

Le message « Création incomplete. » s'affiche à chaque tentative de publication, **que l'on choisisse une entreprise existante ou une nouvelle entreprise** — l'administrateur ne peut donc publier AUCUNE publicité, quel que soit le chemin.

## 2. Cause exacte (prouvée par test, pas par supposition)

La chaîne de validation a DEUX couches côté serveur (`lib/actions/ads.ts`, fonction `buildPayload`) :

1. **Couche 1** — `simpleAdSchema` valide la forme générale du formulaire (étapes ① à ④).
2. **Couche 2** — un schéma **spécifique au format choisi** revalide le contenu : la **bannière exige `image_url`** (l'URL de l'image téléversée), le **logo partenaire exige `logo_url`**.

Le bug : dans le formulaire 4 étapes, l'image téléversée à l'étape ② ne voyageait **NULLEMENT** jusqu'au serveur.

En détail : le composant `ImageField` rend un champ fichier **sans attribut `name`**. L'upload produit une URL stockée dans **l'état React uniquement** (`imageUrl`/`logoUrl`). Or un état React ne traverse jamais le réseau par lui-même — seul un champ nommé du formulaire arrive dans la `FormData` reçue par l'action serveur. Résultat : le serveur recevait une bannière « sans image » même quand l'admin en avait bien ajouté une → le schéma bannière refusait avec « Création incomplete. » + « Texte alternatif obligatoire » / champ `image_url`. L'erreur « avec entreprise existante OU nouvelle » était la preuve que le problème **ne venait pas de l'annonceur** (étape ② fonctionnait) mais de l'étape contenu.

**Test écrit AVANT le correctif** (`lib/validation/simple-ad-formdata.test.ts`, 4/4 verts) :
- **Reproduction** : payload bannière fabriqué EXACTEMENT comme `buildPayload` l'assemble, sans champ `image_url` → le schéma bannière REFUSE avec l'erreur `image_url` — la panne exacte observée.
- **Correctif validé** : même payload avec l'URL téléversée → PARSE réussi, URL et texte alternatif conservés.
- **Localisation** : la couche 1 passe sans `image_url` → l'erreur provient TOUJOURS de la couche par format.
- **Carte** : même cause, silencieuse (image facultative mais perdue à l'étape ④).

## 3. Correction appliquée

**UN SEUL fichier : `components/admin/NouvellePubliciteForm.tsx`** (champs cachés contrôlés) :

| Bloc | Champ caché ajouté | Effet |
|---|---|---|
| Bannière | `<input type="hidden" name="image_url" value={imageUrl} />` | l'URL téléversée voyage dans la FormData |
| Carte | `<input type="hidden" name="image_url" value={imageUrl} />` | idem |
| Logo partenaire | `<input type="hidden" name="logo_url" value={logoUrl} />` | le logo arrive au serveur |

Chaque champ caché est **contrôlé** par l'état qui stocke l'URL : il suit automatiquement l'upload, le changement d'image et les allers-retours entre étapes. L'image et le logo restent **OBLIGATOIRES** comme avant — si l'admin n'en ajoute pas, le serveur refuse proprement avec le message sous le champ (aucun contournement). Vidéo, article sponsorisé, bandeau : inchangés (aucune image requise).

L'action serveur, les schémas de validation, la base, les RLS, les migrations : **rien d'autre modifié, rien d'assoupli**.

## 4. Chaîne technique vérifiée

| Contrôle | Résultat |
|---|---|
| Test de reproduction d'abord (test-first) | `simple-ad-formdata.test.ts` 4/4 verts — échec reproduit puis disparition après correctif |
| Suite complète | **vitest 204/204 verts** (12 fichiers) |
| TypeScript | `tsc --noEmit` exit 0 |
| ESLint (`--max-warnings 0`) | 0/0 |
| `npm run build` | 37 routes OK |
| Build Cloudflare (OpenNext) | worker prêt |
| DÉPLOYÉ (votre autorisation) | **Version `2b933fff-4c3f-47dd-b85b-b96f475f15af`** — smoke live : accueil 200, `/admin/login` 200, `/admin/publicites` 307 (garde admin normale) |
| Rollback | disponible en 1 commande (versions précédentes `719078cf`, `39b47d1d`) |

## 5. Ce que reste à prouver côté navigateur (2 minutes, direction)

Aucun outil de simulation de navigateur n'existe dans cet environnement — la preuve finale se fait dans votre session admin :

1. `/admin/publicites` → « + Créer une publicité » → **Bannière**.
2. Étage ② : ajouter une image → remplir le texte alternatif → entreprise (existante ou nouvelle, les deux marchent).
3. Étage ③ : emplacement précoché + 7 jours.
4. Étage ④ : **PUBLIER MA PUBLICITÉ** → le message « Création incomplete. » doit disparaître et la publicité apparaître en « En diffusion ».
5. Ouvrir le site public : la bannière doit être visible.

En cas de ✘ : la page indique le champ exact en rouge — me donner ce champ suffit.

## 6. État des deux bugs du jour

| Bug | État |
|---|---|
| Texte alternatif qui se vidait (React 19, commit `1ec5d4a`) | corrigé + déployé → était dans `719078cf` |
| « Création incomplete. » (image/logo jamais envoyés, commit `dd59cd2`) | corrigé + déployé → **`2b933fff` en production** |

Les deux correctifs sont sur la branche **locale** `fix/alt-text-form-reset` — **aucun push GitHub, aucune fusion dans main** (attente de votre autorisation).