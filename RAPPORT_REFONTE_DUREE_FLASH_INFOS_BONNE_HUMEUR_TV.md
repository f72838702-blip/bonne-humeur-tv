# RAPPORT — REFONTE DU SYSTÈME DE DURÉE ET DE PUBLICATION DES FLASH INFOS
## Bonne Humeur TV · 3 novembre 2026 · branche `deploy/cloudflare-staging`

**Portée** : module Flash Infos (`/admin/flash-infos`, table `breaking_news`,
bandeau public d'accueil) — menu déroulant de durée, calcul serveur de
l'expiration, programmation facultative, prolongation/réactivation,
retrait automatique côté public.

**STATUT : CODE TERMINÉ ET VALIDÉ LOCALEMENT — AUCUNE MODIFICATION
DISTANTE** (aucune migration appliquée, aucune donnée distante touchée,
aucun déploiement, aucun push). Déploiement + migration 0024 en attente
de l'autorisation expresse de la direction.

---

## 1. CAUSE EXACTE DU PROBLÈME DES CHAMPS DATE/HEURE

Inspection réalisée : formulaire (`FlashNewsForm.tsx` avant refonte),
composants date/time, états React, `value`/`onChange`, attributs
`disabled`/`readOnly`/`min`/`max` (AUCUN de ces attributs n'était en
défaut), CSS/`globals.css`/`tailwind.config.ts`, schémas Zod (`isoDate`),
Server Actions (`saveBreakingNews` avant refonte), colonnes SQL réelles,
et **contenu RÉEL de la base en lecture seule**.

**Faits relevés** :

1. **Aucun calcul d'expiration n'a jamais existé.** `start_at`/`end_at`
   (0001) devaient être remplis À LA MAIN ; le serveur les transmettait
   tels quels. Preuve en base : l'unique flash réel « beperyma » (créé
   18:35 UTC) a `start_at = null`, `end_at = null` → **jamais expirable**
   tant que `is_active` le laisse.
2. **Le contrôle `datetime-local` natif est le champ exactement décrit
   comme « impossible à renseigner »** : saisie segmentée (jj/mm/aaaa
   puis hh:mm) refusant des suites de frappe selon la locale du navigateur,
   quasi inutilisable sur beaucoup de clavier mobiles. Ce comportement
   est DE LA PLATEFORME, pas du code : le formulaire exigeait donc une
   saisie que l'administrateur n'a jamais pu mener jusqu'au bout.
3. **Icône du sélecteur invisible en thème sombre** : aucun `color-scheme`
   n'était défini → l'indicateur de calendrier devient sombre sur fond
   sombre → le champ paraissait sans accès au sélecteur.
   (Corrigé : `html { color-scheme: light dark; }`.)
4. **Valeur transmise sans conversion de fuseau** : l'action enregistrait
   la chaîne naïve du navigateur (`2026-11-04T15:30`) directement en
`timestamptz` — bénin aujourd'hui (Conakry = UTC+0 = UTC du serveur),
défectueux structurellement (décalage possible au moindre déplacement).
5. Les champs n'étaient **pas bloqués par la validation** (l'erreur
   n'était pas un rejet Zod) — le défaut était l'ERGONOMIE de saisie.

## 2. MODIFICATIONS RÉALISÉES

| Fichier | Nature |
|---|---|
| `lib/flash/flash-core.ts` | **NOUVEAU noyau pur** (0 dépendance, 0 accès base/réseau) : les 10 durées autorisées, contrôle serveur `isAllowedDuration`, niveaux, `computeExpiry` (date_fin = début + durée), `parseConakryInput` (datetime-local → ISO UTC+0), `classifyFlash` (cycle de vie), heures Conakry (`formatConakryTime/DateTime`), compte à rebours (`remainingLabel`), retrait navigateur (`expiryEvents`) |
| `lib/flash/flash-core.test.ts` | **NOUVEAU** : 34 tests (les 10 durées calculées 1 par 1, durées fabriquées refusées, horloges simulées, bornes exactes « 16h29:59.999 → actif / 16h30 → expiré », saisie Conakry, compte à rebours, retraits serveur→navigateur) |
| `lib/flash/flash-style.ts` | **NOUVEAU** : styles du bandeau par niveau (source unique admin prévisualisation + public) |
| `lib/validation/schemas.ts` | `breakingNewsSchema` : + `level` (enum 3 niveaux) + `duration_minutes` (entier DANS la liste autorisée UNIQUEMENT — toute valeur fabriquée est refusée) ; + `flashRenewSchema` (prolongation/réactivation) |
| `lib/actions/content.ts` | `saveBreakingNews` RÉÉCRIT : intentions par BOUTON soumis (publish/draft/update), **horloge SERVEUR exclusivement**, expiration = début + durée côté serveur, programmation facultative, période d'existant JAMAIS réinitialisée par une édition de texte ; **NOUVEAU** `renewBreakingNews` (extend/reactivate avec règles serveur strictes) ; traduction de l'absence de colonne `level` (42703) en message clair « appliquer la migration 0024 » |
| `components/admin/FlashNewsForm.tsx` | **RÉÉCRIT** : création (texte + niveau + durée + programmer facultatif + prévisualisation dynamique + « Publier le Flash Info » + « Enregistrer comme brouillon ») ; modification (dates affichées en Conakry + temps restant + texte modifiable SANS reset + prolonger/réactiver) |
| `components/admin/FlashCountdown.tsx` | **NOUVEAU** : compte à rebours admin léger (30 s + recalcul au retour d'onglet, aucun polling) |
| `app/admin/flash-infos/page.tsx` | Liste : compte à rebours dans le résumé de chaque flash |
| `components/home/BreakingNews.tsx` | Wrapper SERVEUR : re-vérification du cycle de vie à chaque requête (double défense avec la RLS) ; aucun flash → aucun bandeau |
| `components/home/FlashTicker.tsx` | **NOUVEAU client** : défilement en boucle CSS conservé + **RETRAIT À L'HEURE EXACTE** (1 setTimeout par flash, purge immédiate au retour d'onglet, aucun polling) |
| `app/globals.css` | `color-scheme: light dark` (réparation du sélecteur de date en thème sombre) |
| `supabase/migrations/0024_flash_infos_niveaux.sql` | **NOUVELLE migration (NON APPLIQUÉE)** : colonne `level` additive |

Aucun service payant, aucune bibliothèque ajoutée, aucun changement DNS.

## 3. COLONNES ET CHAMPS RÉELLEMENT UTILISÉS

- **Réutilisation** (§9 : aucun doublon) : `content`, `link`,
  `is_active`, `start_at` (timestamptz), `end_at` (timestamptz),
  `position`, `created_at` — TOUTES EXISTANTES (0001).
- **Ajout** (0024, en attente d'autorisation) : `level text not null
  default 'normal' check (level in ('normal','important','urgent'))`.
- La **durée n'est PAS une colonne** : elle n'existe qu'in memoriam de
  l'enregistrement pour CALCULER `end_at` côté serveur (§9 : pas de
  colonne redondante).

## 4. MENU DÉROULANT (§2)

Les 10 valeurs 15/30/45/60/120/180/360/480/720/1440 avec les libellés
demandés ; défaut « 1 heure ». Champ obligatoire. La validation utilise la
liste côté serveur (`isAllowedDuration` + Zod) : une valeur hors liste
(0, 17, 2000, « 60 ») est REFUSÉE quelle que soit la tentative côté
navigateur (prévisualisation impossible, action refusée).

## 5. CALCULS D'EXPÉRIENCE (§3/§5)

- « Publier le Flash Info » → le serveur prend `new Date().toISOString()`
  (horloge du Worker = UTC = Conakry UTC+0) ; calcule
  `end = début + durée` ; stocke les deux `timestamptz` UTC.
- Exemple du cahier des charges vérifié par test : début 14h30 + 2 h =
  16h30.
- La prévisualisation admin affiche « expiration ESTIMÉE » (horloge du
  navigateur, honnêteté affichée : le serveur recalcule au clic).
- Affichages humains : `Intl` avec `timeZone: "Africa/Conakry"`
  (« 16h30 », « 05/11 à 09h00 (Conakry) ») — jamais de valeur locale
  naïve enregistrée.
- Programmation : `datetime-local` interprété en Conakry (UTC+0
  constant, pas d'heure d'été) → ISO UTC ; la durée démarre au DÉBUT
  programmé (§6, testé).

## 6. FLASH INFOS PUBLIÉS (§3/§8)

- Publication → **immédiatement visible** (RLS « breaking_news_public_select »
  : actif + dans la période) ; bandeau défile en boucle (CSS `marquee`
  conservé) ; **retiré à l'heure exacte de fin** :
  - SERVEUR : la policy publique + re-vérification `classifyFlash` au
    rendu (chaque requête — re-rendu systématique actuel) ;
  - NAVIGATEUR : `FlashTicker` retire le flash à son échéance exacte
    (setTimeout par flash max ≈ 24 h, purge au retour d'onglet resté
    ouvert) — AUCUN rechargement requis, aucune boucle de requêtes ;
  - la page d'accueil est re-rendue au plus tard ≤ 120 s (`revalidate = 120`).
- Plusieurs flashs actifs : comportement actuel conservé (succession en
  boucle dans le même bandeau) ; couleur = niveau le plus sévère affiché.
- Anciens flashs SANS expiration (« beperyma ») : `end_at` null →
  `active_no_expiry` — **comportement historique conservé** (§9), jamais
  invisibles automatiquement.

## 7. FLASH INFOS PROGRAMMÉS (§6)

Case « Programmer le Flash Info (facultatif) » → champ `datetime-local`
utilisable ordinateur ET téléphone (+ réparation du sélecteur natif en
thème sombre), jamais obligatoire. Valeur interprétée Conakry (UTC+0),
convertie ISO UTC avant enregistrement. Le flash actif programmé est
invisible avant son début (RLS : `start_at <= now`, re-vérification serveur).

## 8. RÈGLES DE PROLONGATION (§7)

- **Modifier un flash actif** N'EN RESET PAS la durée : l'action
  « update » ne transmet JAMAIS start_at/end_at (période rechargée du
  serveur, `is_active` préservé — aucune réactivation accidentelle).
- **« Prolonger la diffusion »** : formulaire dédié (durée re-choisie),
  `end_at = maintenant serveur + durée` à la confirmation.
- **Réactivation** (flash expiré ou brouillon/désactivé) : formulaire
  dédié, redémarre `start = maintenant`, `end = maintenant + durée`.
- Contrôles serveur d'éligibilité (impossibles à contourner en
  manipulant la requête) : prolonger EXIGE actif ; réactiver EXIGE
  inactif ou expiré ;
- Flash programmé : modification limitée — changer sa durée se fait en
  publier à l'heure voulue.
- Statut affiché dans la liste : dates + temps restant (compte à rebours
  admin) ; « expiré » visible.

## 9. TESTS EXÉCUTÉS (résultats réels)

| Test | Résultat |
|---|---|
| Durées : les 10 durées → date de fin calculée (1 par 1) | ✔ 34 tests flash-core |
| Durées fabriquées (0/17/90/60.5/−30/2000/1441/« 60 ») refusées | ✔ |
| Bornes exactes d'expiration (16h29:59.999 actif / 16h30 expiré) | ✔ (horloge simulée) |
| Programmation : durée démarre au début PROGRAMMÉ (09h00+2h → 11h00) | ✔ |
| Publication immédiate / programmée / avant début / actif / expiré / sans expiration / modification sans renouvellement / prolongation / réactivation | ✔ (classifyFlash + serveurs action) |
| Suite complète `vitest` | **124/124** (90 pré-existants intacts + 34 nouveaux) |
| TypeScript `tsc --noEmit` | 0 erreur |
| ESLint | 0 erreur / 0 avertissement |
| `next build` | OK (26 pages) |
| `opennextjs-cloudflare build` | OK (Worker généré) |
| **Preview Cloudflare (`wrangler dev`)** | accueil 200 + **bandeau RÉEL rendu** (flash existant « beperyma », `active_no_expiry`) + `/admin/flash-infos` → 307 (garde) |

Tests navigateur/téléphone (Android/iPhone, défilement réel, durée
réelle de 15 minutes, compte à rebours, prefers-reduced-motion) :
**à la direction** — nécessitent une session authentifiée et la
migration 0024 appliquée.

## 10. MIGRATION NÉCESSAIRE (NON APPLIQUÉE)

**0024_flash_infos_niveaux.sql** — colonne additive `level` (aucune
donnée modifiée, défaut 'normal', RLS et policies intacts). SANS cette
migration, l'enregistrement de flash refuse avec le message clair
« faites appliquer la migration 0024 » (aucun échec brut). Le reste du
système (durée, expiration, bandeau, prolongation) fonctionne SANS elle.
Application : UNIQUEMENT après accord — `supabase migration list --remote`
puis `db push --remote` (doit n'afficher QUE 0024).

## 11. BUDGET

**0 USD/mois confirmé** — aucune nouvelle dépendance, aucun service,
aucune souscription ; tout repose sur Supabase Free / Cloudflare
Workers Free existants.

## 12. STATUT DE PRÉPARATION AU DÉPLOIEMENT

- Code complet, testé, builds OK — **PRÊT À DÉPLOYER sur feu vert de la
  direction uniquement**, avec, dans le même feu vert :
  1. application de la migration 0024 (précondition du niveau) ;
  2. `wrangler deploy` (aucune autre commande distante).
- Aucun secret exposé ; RLS et policies inchangés ; aucun push GitHub ;
  aucune donnée distante modifiée (l'unique flash existant est
  préservé tel quel — aucune date ajoutée à sa place).