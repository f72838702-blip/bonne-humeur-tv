# RAPPORT PRÉ-DÉPLOIEMENT — CORRECTION DES DATES DES CAMPAGNES (RÉGIE PUBLICITAIRE)

**Date : 04/11/2026 — REDIT À LIRE AVANT DE DONNER L'AUTORISATION DE DÉPLOIEMENT**
**Produit en attente d'autorisation : le déploiement Cloudflare du correctif des dates de campagnes.**

---

## 1. D'où on part — ce que porte la production ACTUELLE

- Production : https://bonne-humeur-tv-preview.bonne-humeur-tv.workers.dev
- **Worker Version 12bdfa00-6e3f-42cb-90fb-de58f0db7606** (déployée le
  03/11 avec le code de la régie, HEAD `f2a3de1`), smoke live 14/14 conforme.
- Base distante : migrations **0001→0026 toutes appliquées** et vérifiées
  (9 tables `ad_*`, 27 policies, 6 fonctions, ACL exactes, 8 emplacements
  seedés, job cron de purge actif).
- Données publicitaires réelles : **1 annonceur créé par la direction
  (13:02 UTC le 04/11) — intact**. Aucune campagne, aucune création.
- Le correctif des dates **N'EST PAS** dans cette version déployée : l'erreur
  d'ambiguïté observée le 04/11 (« la fin doit être postérieure… » sans
  valeurs affichées) est toujours celle en production.

## 2. Ce que le déploiement AJOUTERAIT (et rien d'autre)

Commits non déployés depuis 12bdfa00 : `f6e931a` (rapport de recette —
documentation seule) et `039b36c` (correctif des dates). **Seul `039b36c`
change du code.** Fichiers :

| Fichier | Changement | Impact visuel / comportement |
|---|---|---|
| `lib/ads/ads-core.ts` | +2 fonctions pures (`campaignPeriodError`, `formatConakryReadable`) | aucun sur le site public ; utilisé par l'action de campagne |
| `lib/actions/ads.ts` | comparaison déléguée à `campaignPeriodError` ; message précis avec les deux timestamps ; erreur attachée à `end_at` ; **contrat non écrasé à l'édition** | messages du module campagnes uniquement |
| `components/admin/AdsForms.tsx` | garde client `min` (fin bornée par début) + consigne + valeurs conservées + `defaultValue` de fin rétablie | module admin uniquement |
| Tests `lib/ads/ads-core.test.ts` | +9 tests (4 cas direction, conversions Conakry, minuit, valeurs illisibles) | aucun en production |

**Ce qui NE CHANGE PAS** : aucune route ajoutée, aucune page du site public,
aucune colonne SQL, aucune policy RLS, aucune migration distante, aucune
variable d'environnement, aucun secret, aucune donnée de la base.

## 3. Chaîne de validation exécutée (réels, avant ce rapport)

- `tsc --noEmit` : **exit 0**.
- ESLint : **0 erreur / 0 avertissement**.
- Vitest : **167/167** (9 fichiers — 158 précédents conservés + 9 nouveaux).
- `next build` : ✔ 36 routes, middleware intact.
- `npx opennextjs-cloudflare build` : ✔ worker régénéré (déjà fait lors de la
  correction ; un rebuild sera relancé au moment du déploiement).
- Preuve de la logique : les 4 cas de la direction rejoués (10:00→12:00
  accepté, +24 h accepté, égal refusé, inversé refusé — message affichant les
  deux timestamps).

## 4. Plan de contrôle APRÈS déploiement (si autorisé)

| Vérification | Attendu |
|---|---|
| `/`, `/actualites`, `/videos`, `/admin/login` | 200 (inchangés) |
| `/admin/publicites` (+ campagnes) | 307 (garde inchangée) |
| `/ads/click/<uuid bidon>` | 302 vers `/` |
| `POST /ads/track` payload invalide | `{"counted":false}` |
| CSP / X-Frame-Options | inchangées |
| Recette des dates (ordinateur, PUIS téléphone) : création de campagne avec les 4 cas | 10:00→12:00 accepté · +24 h accepté · égal refusé (message montre les deux timestamps) · inversé refusé (idem) |
| Champ fin sur téléphone | impossible de choisir antérieur à début (`min` actif) |
| L'annonceur réel de la direction | intact (aucune écriture de la correction sur les données) |

## 5. Recul possible

La version précédente **12bdfa00** reste disponible : un simple
`npx wrangler rollback` (ou redéploiement du commit `f2a3de1`) restaure
l'état actuel en une commande. Aucune donnée n'est modifiable par ce
déploiement — le correctif est purement applicatif.

## 6. Risques estimés

- **Faible** : les 3 fichiers touchés n'apparaissent que dans le module
  campagnes de l'admin ; le chemin du site public est strictement inchangé.
- **Aucun changement de schéma/RLS** : rien à revérifier côté base.
- **Comportement volontairement resserré** : une fin égale au début reste
  refusée (contrainte SQL inchangée) ; une période incomplète reste un
  cas autorisé sans diffusion (fail-closed documenté).

## 7. Conclusion

**PRÊT POUR DÉPLOIEMENT** — sur autorisation explicite de la direction. À la
commande « déploie » : rebuild OpenNext frais → `wrangler deploy` → les 7
contrôles live du §4 → redéploiement de la version précédente si un doute
apparaît → mise à jour du rapport et copie presse-papiers + Bureau.