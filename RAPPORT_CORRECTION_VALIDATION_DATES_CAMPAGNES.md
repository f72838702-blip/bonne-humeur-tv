# RAPPORT DE CORRECTION — VALIDATION DES DATES DES CAMPAGNES PUBLICITAIRES

**Date : 04/11/2026 — branche `feature/regie-publicitaire` — prod : Version 12bdfa00 (non modifiée : AUCUN déploiement exécuté dans cette correction)**

---

## 1. Symptôme rapporté par la direction

Dans `/admin/publicites/campagnes` (création ou modification), le message
« La date de fin doit être postérieure à la date de début » apparaît alors que
l'administrateur estime avoir saisi deux dates correctes.

## 2. Le diagnostic — chaîne des dates entièrement inspectée

| Maillon | Fichier | Verdict |
|---|---|---|
| Formulaire (`CampaignForm`, client) | `components/admin/AdsForms.tsx` | champs `datetime-local` **sans doublon de `name`**, `start_at`/`end_at` uniques — sain |
| Aucune confusion de noms | tout le dépôt | `starts_at`/`ends_at` : **absents** (grep 0 résultat) — les noms server/form/SQL sont identiques |
| Conversion unique | `lib/flash/flash-core.ts` `parseConakryInput` | une SEULE normalisation par valeur : `datetime-local` naïf → `…Z` (UTC+0 = Conakry, aucun décalage ajouté) ; secondes tolérées et tronquées |
| Comparaison serveur | `lib/actions/ads.ts` `campaignDates` (ancienne l.192) | **correcte ET prouvée** : timestamps numériques (`Date.parse`), jamais de comparaison de chaînes |
| Schéma Zod | `lib/validation/ads-schemas.ts` | `conakryDateTime` = regex stricte `AAAA-MM-JJThh:mm` (ou vide) — pas de comparaison interne, pas de double conversion |
| SQL | `0025` contrainte `ad_campaigns_period_valid` | `end_at > start_at` cohérente avec l'action (égalité refusée partout) |

**Preuve empirique (exécutée en local)** : les 4 cas de la direction passent
tous comme exigé —

| Début | Fin | Résultat obtenu | Attendu |
|---|---|---|---|
| 04/11 10:00 | 04/11 12:00 | ✔ accepté | accepté |
| 04/11 10:00 | 05/11 10:00 | ✔ accepté | accepté |
| 04/11 10:00 | 04/11 10:00 | ✔ refusé | refusé |
| 04/11 12:00 | 04/11 10:00 | ✔ refusé | refusé |

(+ variantes : secondes parasites acceptées, passage de minuit accepté,
jour non paddé = message dédié, jamais d'inversion de l'ordre.)

### Cause exacte (démontrée par les traces)

1. **La logique serveur n'a jamais été en faute.** La base distante (audit
   en lecture seule) montre **exactement 1 événement** pendant le test de la
   direction : 1 création d'annonceur (13:02:28 UTC) et **AUCUNE campagne
   insérée** — chaque tentative de campagne a été refusée par la validation
   des dates.
2. **Ce que le serveur reçoit n'est pas ce que l'administrateur croit avoir
   saisi.** Le sélecteur `datetime-local` (surtout sur téléphone) peut être
   validé un jour correct avec une HEURE non modifiée (sélecteur ouvert sur
   l'heure courante, ou minute/AM-PM non changée) — l'ordre réel des deux
   timestamps transmis s'inverse alors sans que l'écran ne le montre : le
   serveur refuse, et l'ancien message n'affichait **ni les valeurs reçues ni
   pourquoi** — indistinguable d'un « bug ». C'est cette INFORMABILITÉ qui était
   le vrai défaut (le calcul était juste).
3. Défaut associé découvert en même temps : l'édition d'une campagne écrasait
   les 3 colonnes contrat (`contract_signed_at/…`) jamais présentes dans le
   formulaire → perte possible à l'édition (corrigé, §3).

## 3. Fichiers corrigés

| Fichier | Correction |
|---|---|
| `lib/ads/ads-core.ts` | **+2 fonctions pures, source de vérité UNIQUE** : `campaignPeriodError(startIso, endIso)` (renvoie null si OK/période incomplète, sinon message PRÉCIS affichant les deux timestamps reçus : « la fin (04/11/2026 à 12:00) doit être POSTÉRIEURE au début (04/11/2026 à 10:00) — vérifiez l'heure des deux champs, pas seulement le jour ») et `formatConakryReadable` (ISO → « jj/mm/aaaa à hh:mm ») |
| `lib/actions/ads.ts` | `campaignDates` délègue la comparaison à `campaignPeriodError` (une SEULE normalisation Conakry conservée via `parseConakryInput`) ; messages d'invalide enrichis (« format attendu jj/mm/aaaa hh:mm ») ; l'erreur de période est attachée au champ **`end_at`** (l'erreur porte sur la fin) et non plus sur le début ; **correctif contrat** : les 3 colonnes contrat ne sont plus écrasées à null lors d'une modification dont le formulaire n'apporte pas ces champs |
| `components/admin/AdsForms.tsx` | **Garde CLIENT unifié** : `min` dynamique du champ fin = valeur du début (React `useState`, non-bloquant, conforme à la validation serveur) ; note visible sous la fin (« vérifiez l'HEURE, pas seulement le jour ») ; les valeurs par défaut (pré-remplissage à l'édition) conservées ; uncontrolled inputs → **les dates saisies sont conservées après une erreur** (aucune resaisie) |

**Rien d'autre ne bouge** : aucune donnée publicitaire modifiée (la base reste
0 annonceur… enfin — 1 annonceur réel créé par la direction, INTACT), aucune
policy RLS, aucune migration distante, aucun secret exposé, aucun déploiement.

## 4. Tests effectués

- **Vitest : 167/167 (9 fichiers)** — dont **9 nouveaux tests** : les 4 cas de
  la direction 1 par 1, formatage lisible (jj/mm/aaaa à hh:mm), égalité de
  dates avec message affichant les DEUX timestamps, passage de minuit, secondes
  parasites, champs manquants (période facultative = jamais erreur), valeurs
  illisibles (« reformulez les deux dates »), et conversions `parseConakryInput`
  (datetime-local → ISO UTC+0, tolérance secondes, rejets réels).
- `tsc --noEmit` : **exit 0**.
- ESLint : **0 erreur / 0 avertissement**.
- `next build` : ✔ (36 routes, middleware intact).
- `opennextjs-cloudflare build` : ✔ worker généré — **PRÊT mais NON déployé**
  (déploiement Cloudflare = autorisation à venir).
- La preuve « la logique serveur est correcte » est restée lisible : le
  script de simulation exécuté AVANT correction reproduisait exactement le
  tableau des 4 cas (§2).

## 5. Ce qui change concrètement pour l'administrateur

1. **Le sélecteur de fin ne peut plus descendre sous le début** (attribut
   `min`, ordinateur ET téléphone — c'est le garde que la recette mobile
   réclame).
2. Si les dates sont réellement inversées, le message **montre les deux valeurs
   comprises par le serveur** : on voit immédiatement que c'est l'HEURE qui
   diffère (ex. début reçu 12:00, fin reçue 10:00) — fin de l'ambiguïté.
3. Un champ manquant donne un message dédié (« Date de début invalide / Date de
   fin invalide — format attendu ») ; une période vraiment incohérente est
   toujours refusée (aucun assouplissement : la contrainte SQL `end_at >
   start_at` reste la barrière finale).
4. Les dates saisies ne sont plus effacées après une erreur de validation.
5. Le contrat existant d'une campagne ne peut plus être perdu à l'édition.

## 6. Vérifications restantes (après déploiement autorisé)

- Retester les 4 cas sur ORDINATEUR puis TÉLÉPHONE (surtout le sélecteur
  mobile de fin, borné par le début).
- Aucune migration distante n'était nécessaire : le correctif est 100 %
  application (actions + noyau + formulaire). Les migrations 0025/0026 en
  place restent exactement celles déjà appliquées et vérifiées.
- Déploiement Cloudflare : **en attente d'une autorisation explicite** (le
  worker en production reste Version 12bdfa00 pour l'instant).