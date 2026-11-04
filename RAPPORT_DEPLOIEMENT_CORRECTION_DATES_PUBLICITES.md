# RAPPORT DE DÉPLOIEMENT — CORRECTIF DES DATES PUBLICITAIRES

**Date : 04/11/2026 — autorisation expresse de la direction ("feu vert explicite pour déployer le correctif `039b36c`")**
**Production : https://bonne-humeur-tv-preview.bonne-humeur-tv.workers.dev**

---

## 1. Version Cloudflare déployée

| Élément | Valeur |
|---|---|
| Worker | `bonne-humeur-tv-preview` (vérifié dans `wrangler.jsonc` AVANT l'opération) |
| **Version ID** | **`00266a37-5112-46a8-a590-29308e749e86`** |
| Précédente version | `12bdfa00-6e3f-42cb-90fb-de58f0db7606` (restaurable, cf. §8) |
| Startup | 20 ms |
| Assets | 2 fichiers chargés (74 déjà en cache) — total 10,79 MiB / gzip 2,48 MiB |

## 2. Commit utilisé

- Branche porteuse vérifiée : **`feature/regie-publicitaire`** (arbre propre,
  aucun push, aucune fusion — `main` inchangée).
- Commit fonctionnel déployé : **`039b36c`** (vérifié ancêtre de HEAD ;
  le déploiement embarque aussi `f6e931a`/`210acdd`/`61c1f05` = rapports,
  aucun code).
- **Diff vérifié limité aux fichiers autorisés** — exactement 5 fichiers de
  code/tests + 2 rapports : `lib/ads/ads-core.ts` (+30), `lib/actions/ads.ts`
  (26 mod. — message précis, erreur sur `end_at`, contrat protégé),
  `components/admin/AdsForms.tsx` (+28 — garde `min` client), tests (+56),
  aucune autre modification fonctionnelle.

## 3. Tests exécutés AVANT le déploiement

| Contrôle | Résultat |
|---|---|
| `npx tsc --noEmit` | **exit 0** |
| `npx next lint` | **0 erreur / 0 avertissement** |
| `npx vitest run` | **167/167 (9 fichiers)** — dont les 9 nouveaux des dates |
| `npm run build` (= `next build`) | ✔ 36 routes, middleware intact |
| `npx opennextjs-cloudflare build` | ✔ worker régénéré |

## 4. Contrôles après déploiement — TOUS CONFORMES

| Route / vérification | Attendu | Réel |
|---|---|---|
| `/` | 200 | ✔ |
| `/actualites` | 200 | ✔ |
| `/videos` | 200 | ✔ |
| `/admin/login` | 200 | ✔ |
| `/admin/publicites` et `/admin/publicites/campagnes` | redirection (non authentifié) | ✔ 307 ×2 |
| `/ads/click/<uuid invalide>` | **302 sécurisée vers l'accueil** | ✔ (Location vérifiée) |
| `POST /ads/track` payload invalide | `{"counted":false}` | ✔ |
| Strict-Transport-Security | conservé | ✔ (`max-age=63072000; preload`) |
| content-security-policy | conservée (self, i.ytimg, *.supabase.co, youtube-nocookie…) | ✔ |
| x-frame-options | `DENY` | ✔ |

## 5. Confirmation AUCUNE donnée modifiée

Requête **LECTURE SEULE** sur la base distante immédiatement après le
déploiement : `advertisers = 1` (l'annonceur réel créé par la direction le
04/11 — intact), `ad_campaigns = 0`, `ad_creatives = 0`, `ad_payments = 0`,
`ad_daily_stats = 0`, `ad_placements = 8` (seed inchangé).
**Aucune écriture de la régie sur la base pendant tout le déploiement** ;
aucune migration Supabase, aucune policy touchée, aucun secret lu/modifié
(jeton jamais affiché), aucun changement DNS, aucun achat/abonnement,
aucun push GitHub, aucune fusion.

## 6. Budget

**0 USD/mois** — le déploiement reste sur Cloudflare Workers Free et
Supabase Free, aucune ressource supplémentaire créée.

## 7. Vérifications CMS à faire PAR LA DIRECTION (les 4 cas + dates affichées)

Le serveur exécute déjà (prouvé en tests automatisés) : 10:00→12:00 accepté,
10:00→lendemain 10:00 accepté, 10:00→10:00 refusé, 12:00→10:00 refusé.
**Nouveau dans cette version** : un refus AFFICHE les DEUX timestamps reçus
(ex. « la fin (04/11/2026 à 10:00) doit être POSTÉRIEURE au début
(04/11/2026 à 12:00) »), l'erreur est posée sur le champ fin, la fin ne peut
plus être choisie antérieure au début via le sélecteur (`min` actif sur
ordinateur ET téléphone), et sa re-test téléphone est la vérification
manquante pour conclure.

## 8. Recul documenté

En cas de régression : `npx wrangler rollback` (ou `npx wrangler versions
list` puis déploiement de `12bdfa00`) — aucune donnée n'était modifiable par
cette version, donc le recul est sans conséquence sur la base.

## 9. Verdict

**DÉPLOYÉ CONFORMÉMENT À L'AUTORISATION — aucun contrôle échoué, aucune
déviation.** Reste : les 4 cas de dates rejoués par la direction dans le CMS
(ordinateur + téléphone), puis la suite de la recette publicitaire
(annonceur déjà créé → campagne → création → approbation → activation).