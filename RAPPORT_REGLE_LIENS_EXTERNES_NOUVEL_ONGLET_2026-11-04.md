# RAPPORT — RÈGLE DE NAVIGATION : LIENS EXTERNES EN NOUVEL ONGLET · BONNE HUMEUR TV

**Date : 04/11/2026 · Branche locale `fix/alt-text-form-reset` · Commit `11bd2df`**
**Aucun déploiement · Aucun push · Aucune fusion · Aucune migration · Aucune donnée touchée · Aucune RLS modifiée — attente de votre autorisation**

---

## 1. Diagnostic initial (audit complet avant toute modification)

**Méthode** : recherche exhaustive de `<a>`, `<Link>`, `target=`/`_blank`, `window.open`/`window.location`, `dangerouslySetInnerHTML`, href dynamiques (`href={`) dans les 31 fichiers comportant des liens — pages principales, composants réutilisables, contenus dynamiques Supabase/CMS, régie publicitaire, admin.

**Lacunes constatées (liens externes qui s'ouvraient dans le MÊME onglet) :**

| Zone | Constat avant | Gravité |
|---|---|---|
| **Publicités** (bannière, carte, vidéo sponsorisée, bandeau) | 4 ancres sans `target` → clic publicitaire faisait quitter le site | ✔ corrigé |
| **Corps des articles (liens du CMS/sources)** | liens Markdown externes rendus par `marked` sans `target` | ✔ corrigé |
| **Flash Infos** | `_blank` appliquée même aux liens INTERNES (inverse de la règle) | ✔ corrigé |

**Déjà conformes (vérifiés, laissés tels quels)** : logos partenaires (`target="_blank"` + `rel`), WhatsApp (footer, bouton flottant, contact), partages Facebook/WhatsApp/YouTube, « Regardez-la sur YouTube » (lecteur + emboîtement), aperçus admin. Deux aperçus admin avaient `target="_blank"` sans `rel` — **renforcés**.
**Aucun `window.open` ni `window.location` programmatique** n'existe dans le site ; la redirection publicitaire (`/ads/click/[id]` → `302` vers l'annonceur) est un mécanisme serveur intentionnel (anti open-redirect, comptage de clics) — **non transformé**, l'ancresse reçoit `target="_blank"` : le visiteur ne quitte jamais le site.

## 2. Solution technique retenue — source unique `lib/links.ts`

Centralisée, testable, **sans intercepteur global de clics**, aucune dépendance :

- `SITE_HOSTS` : liste blanche des domaines du site (`NEXT_PUBLIC_SITE_URL`, `bonne-humeur-tv.vercel.app`, `bonne-humeur-tv-preview.bonne-humeur-tv.workers.dev`).
- `isExternalHttpUrl(url)` : externe ⇔ HTTP/HTTPS ET hôte hors liste blanche. Relatif (`/`, `#`, `?`), `mailto:`, `tel:`, `sms:`, URL malformée → JAMAIS externe.
- `externalAnchorProps(url)` : déplie `{ target: "_blank", rel: "noopener noreferrer" }` sur les liens externes, `{}` sinon — utilisée par les composants (Flash Infos).
- `addExternalLinkTargets(html)` : post-traitement **sûr** de la sortie `marked` (la source est intégralement échappée avant parsing — les seuls `<a>` existants sont ceux de marked, href entre guillemets) : ajoute target/rel aux liens externes du corps d'article, ne double jamais un `target` existant.

Applications : `lib/content/markdown.ts` (corps d'articles), `components/publicite/AdVisuals.tsx` (4 formats publicitaires), `components/home/FlashTicker.tsx` (conditionnel), aperçus admin (`app/admin/videos/[id]`, `app/admin/articles/[id]`).

## 3. Fichiers modifiés / créés

| Fichier | Action |
|---|---|
| `lib/links.ts` | **créé** — les 3 helpers + liste blanche des domaines |
| `lib/links.test.ts` | **créé** — 21 tests (propriété de domaine, 12 scénarios, post-traitement) |
| `lib/content/markdown.ts` | corrige les liens externes du CMS (1 import + 1 appel + doc) |
| `lib/content/markdown.test.ts` | +3 tests (externe/interne/mailto end-to-end) |
| `components/publicite/AdVisuals.tsx` | `target="_blank"` sur les 4 ancres publicitaires (comptage conservé) |
| `components/home/FlashTicker.tsx` | `_blank` devenu conditionnel (externe seulement) |
| `app/admin/videos/[id]/page.tsx` et `app/admin/articles/[id]/page.tsx` | `rel="noopener noreferrer"` ajouté (renforcement) |

**Particulièrement préservés** : `SponsoredArticleCard` (lien INTERNE vers l'article réel — même onglet, conforme), route `/ads/click/[id]` inchangée, design/animations/URLs des publicités et partenaires inchangés, zéro migration, zéro donnée.

## 4. Nombre de liens concernés (mesurable)

- **12 ancres externes existantes** déjà en `_blank` : vérifiées toutes conformes (15/15 ancres `_blank` du site ont désormais `rel` — comptage automatisé).
- **4 ancres publicitaires** (bannière, carte, vidéo, bandeau) passées en nouvel onglet.
- **Liens dynamiques sans compte fixe** : corps d'articles (Markdown, autant que le CMS en contient), flashs-infos liés, adresses d'annonceurs — couverts par le mécanisme uniforme ci-dessus, quel que soit leur nombre, maintenant et à l'avenir.
- **Liens internes** (Header, Footer, navigation, cartes, pagination, article sponsorisé…) : vérifiés inchangés, même onglet.

## 5. Tests et résultats (matrice §6 de la mission)

| # | Scénario | Résultat (test automatisé) |
|---|---|---|
| 1 | Lien externe dans un article (CMS) | ✔ nouveau test `markdown` — `target=_blank` + `rel` |
| 2 | Source d' information externe | ✔ `addExternalLinkTargets` (`source.gn`) |
| 3-5 | Bannière / carte / vidéo publicitaire (dest. externe via `/ads/click`) | ✔ 4 ancres `_blank`, route de comptage intacte |
| 4 | Publicité partenaire (logo) | ✔ déjà conforme, vérifiée |
| 5 | Lien YouTube (lecteur + embed) | ✔ déjà `_blank`+`rel`, vérifié |
| 6 | Réseau social (WhatsApp/Facebook/YouTube) | ✔ déjà conforme, vérifié |
| 7-9 | Liens internes (article, Actualités, Accueil) | ✔ aucun `target` ajouté (tests dédiés) |
| 10-11 | `mailto:` / `tel:` | ✔ inchangés (tests dédiés) |
| 12 | Téléchargement (export CSV admin, redirections techniques) | ✔ inchangés (liens internes, non touchés) |
| — | Suite complète | ✔ **vitest 225/225** (204 conservés + 21 nouveaux) · **tsc 0** · **ESLint 0/0** · **build 37 routes** · **worker OpenNext prêt** |

Le test DOM réel dans un navigateur (clic sur la bannière → nouvel onglet) reste à faire à la recette — aucun outil de simulation de navigateur dans cet environnement ; les attributs servis sont prouvés côté code + tests.

## 6. Liens nécessitant un traitement particulier (rien fait sans vous)

1. **Aucun.** Les cas frontières sont couverts : liens internes plein-domaine (le domaine du site ne s'ouvre jamais en nouvel onglet), sous-domaines tiers, `www.`, URL malformée (jamais transformée).
2. **Choix assumé** : le lien d'article sponsorisé mène à un article interne → même onglet (l'annonceur est identifié par le badge « Sponsorisé »). Si la direction préfère un nouvel onglet ici aussi, c'est un changement d'une ligne — à me dire.

## 7. Accessibilité et expérience

Design, animations, interactions, mentions visuelles : **0 changement** (aucune icône ajoutée). `rel="noopener noreferrer"` sécurise toutes les ouvertures. Les lecteurs d'écran n'annoncent pas spontanément « nouvel onglet » : si vous le souhaitez, je peux ajouter une mention audible discrète « (nouvel onglet) » sur les liens publicitaires — recommandation optionnelle, non faite pour éviter toute pollution du design.

## 8. Problèmes non résolus

Aucun bloquant résiduel identifié. Limites : preuve clic final dans un vrai navigateur (recette), et la mention auditeur d'écran ci-dessus (optionnelle).

## 9. Recette manuelle (≈ 5 minutes, après déploiement)

1. Ouvrir un article contenant un lien externe → le lien s'ouvre dans un **nouvel onglet** ; revenir : l'article est toujours là.
2. Dans un article, cliquer un lien interne (« Toutes les actualités ») → **même onglet**.
3. Publier/afficher une bannière publicitaire → clic → **nouvel onglet** vers l'annonceur ; retour : le site est intact et le clic est compté (Gestion avancée → Statistiques).
4. Logos partenaires → nouvel onglet. WhatsApp footer/float → nouvel onglet (comportement déjà actuel).
5. Flash Info avec lien externe → nouvel onglet ; avec lien interne → même onglet.
6. Header/Footer navigation → même onglet partout.
7. `mailto:` (contact@bonnehumeur.tv) et `tel:` (contact) → applications natives, inchangés.
8. Téléphone : refaire 1, 3, 6 sur mobile — même comportement.

**Opérations restant soumises à votre autorisation : déploiement Cloudflare (worker déjà prêt), push GitHub, fusion dans main.**