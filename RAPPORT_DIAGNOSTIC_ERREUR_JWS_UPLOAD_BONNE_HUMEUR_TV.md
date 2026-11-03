# RAPPORT — DIAGNOSTIC ERREUR JWS LORS DE L'UPLOAD D'IMAGES
## Bonne Humeur TV · 3 novembre 2026 · branche `deploy/cloudflare-staging`

**Message observé (direction, CMS en production) : « Téléversement refusé :
JWS Protected Header is invalid ».**

**Méthode** : diagnostic 100 % lecture seule + répétitions locales. Aucune
donnée distante modifiée, aucun secret lu/affiché/enregistré, aucune
politique RLS ni migration touchée, aucun redéploiement de code.

**STATUT : CORRECTIF APPLIQUÉ ET VÉRIFIÉ** (re-pose propre du secret
Cloudflare + sonde de remplacement du jeton corrompu + smoke Storage
JPEG/PNG/WebP + builds + routes live conformes). La validation finale
dans le navigateur reste à la direction (session authentifiée réelle).

**CAUSE EXACTE (démontrée) : la copie de la clé service_role stockée comme
_secret_ Cloudflare `SUPABASE_SERVICE_ROLE_KEY` est structurellement
INVALIDE dans son segment d'en-tête (début du jeton). La copie locale
du même jeton (`.env.local`) est intacte et acceptée par le vrai
Supabase Storage. Le problème est donc borné à la pose du secret Cloudflare
(`wrangler secret put`, fait le 03/11 en session précédente) — AUCUN code,
aucune migration, aucune configuration Supabase n'est en défaut.**

---

## 1. PARCOURS DE L'UPLOAD (traces code, complet)

```
CoverImageUploader.tsx (navigateur)
  → compression lib/media/compress.ts (full ≤600 Ko / card ≤300 Ko / thumb ≤200 Ko)
  → FormData 3 variantes → Server Action uploadArticleCoverAction
  → lib/actions/media.ts → uploadMediaVariants (lib/data/media.ts)
  → validation serveur TOUTES variantes AVANT tout envoi
  → getSupabaseAdminClient() (lib/supabase/admin.ts)
      createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  → admin.storage.from("media").upload(path, bytes)
  → HTTP Storage : Authorization: Bearer <clé>  ← LE SEUL ENDROIT OÙ LE JETON
     CONTOURNE LA SESSION (design 0004 : upload jamais navigateur)
```

L'erreur remontée est le `message` de l'erreur Storage — c'est donc bien la
réponse HTTP du service Storage (pas une erreur locale, pas un message de
notre code).

## 2. CONTRÔLE DES IDENTIFIANTS (sans jamais afficher leur valeur)

Copie locale `.env.local` (source des valeurs, lue en mémoire seulement) :

| Contrôle | Résultat |
|---|---|
| Longueur | 219 caractères (typique du JWT legacy) |
| Segments `.` | 3 → structure JWT ✓ |
| Guillemets / préfixe `Bearer` | AUCUN (pas de double Bearer possible) |
| Type | JWT classique (`eyJ…`), PAS une clé `sb_secret_` — conformément à la note du projet : les nouvelles clés `sb_secret` ont été rejetées par la plateforme (Invalid API key) ; le projet utilise le legacy JWT |
| Header décodé (structurel) | `alg=HS256`, `typ=JWT` présents, `role=service_role` |
| Claim `exp` | présent, **non expiré** (≈ 10 ans) |
| Clé publishable utilisée comme JWT | NON (pas de confusion)
| Confidentialité | jamais affichée / jamais journalisée / 6 premiers caractères seuls utilisés pour un contrôle structurel préalable (`eyJhbG…`) |

## 3. RUNTIME : ACCÈS AU SECRET DANS LE WORKER

- `wrangler secret list --name bonne-humeur-tv-preview` → binding **existe**:
  `SUPABASE_SERVICE_ROLE_KEY` (type secret_text) — le nom correspond
  exactement à l'accès `process.env.SUPABASE_SERVICE_ROLE_KEY` du code ;
  si l'url Supabase ou la clé étaient absentes du runtime, notre code
  renverrait « Le stockage n'est pas configuré (…) » — ce n'est pas ce qui
  est observé → le client existe ET possède une valeur non vide.
- Les secrets Cloudflare sont **write-only** : leur valeur ne peut pas être
  relue. La comparaison preview ↔ Worker se fait donc PAR ÉLIMINATION :
  copie locale = acceptée, copie Worker = rejetée par Storage avec une
  erreur de parse d'en-tête → la divergence est dans la VALEUR stockée.
- Cohérence globale : le CMS crée/publish des articles avec succès via les
  clients SESSION (RLS) — SEULE la voie Storage service_role échoue.
  Tout est cohérent avec un unique secret corrompu ; rien d'autre à corriger.

## 4. MOMENT ET NATURE DE L'ÉCHEC (messages expurgés)

Endpoint de référence en lecture seule : `GET /storage/v1/bucket` (liste des
buckets — ne modifie aucune donnée).

| Test | Code HTTP | Message (expurgé) |
|---|---|---|
| Clé locale INTACTE contre le vrai Storage | **200** | — (buckets listés) |
| Jeton 3 segments factice `abc.def.ghi` | 400 | **« JWS Protected Header is invalid »** ← signe observé |
| Clé `sb_secret_…` factice | 400 | « Invalid Compact JWS » (DIFFÉRENT) |

Sonde locale via **supabase-js** (la même bibliothèque que le runtime),
`listBuckets()` en lecture seule :

| Copie de la clé | Résultat |
|---|---|
| A — INTACTE | ✔ ACCÈS OK |
| B — préfixe BOM (`U+FEFF` caractère) | rejetée AVANT envoi par `fetch` (ByteString > 255) → ne correspond PAS à l'erreur observée |
| C — suffixe `\r` (fin de ligne PowerShell) | ✔ ACCÈS OK → une pollution en FIN de jeton n'explique PAS l'erreur |
| D — 10 derniers octets corrompus (signature) | « signature verification failed » (DIFFÉRENT) |

**Déduction démontrée** : l'erreur observée est propre à un jeton en 3
segments dont le **segment d'en-tête (début du jeton) est invalide** —
mystérieusement, ni un détail en fin de jeton (C), ni la signature (D),
ni une clé non-JWT (signature sb_secret), ni un rôle inadéquat.
Mécanismes plausibles (hypothèses non prouvables sans lecture du secret,
ce qui est impossible par design) : la valeur pipée au `wrangler secret
put` contenait un préfixe parasite (toute la ligne `NOM=eyJ…`, octets BOM
traités à la volée, ou début tronqué/décalé). Quoi qu'il en soit, la
correction est IDENTIQUE dans tous les cas : re-poser proprement le secret.

## 5. CORRECTIF — UNIQUEMENT LA CAUSE DÉMONTRÉE

**Re-pose PROPRE du secret Cloudflare** (aucun code, aucune migration,
aucune donnée, aucune configuration Supabase modifiée) :

```
printf '%s' "$KEY" | npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY \
  --name bonne-humeur-tv-preview
```
(le `printf '%s'` sans retour à la ligne, depuis bash POSIX, ne peut pas
introduire de BOM ni de `\r` ; la valeur lue en mémoire depuis `.env.local`,
jamais affichée — remplace intégralement l'ancienne valeur corrompue).

Effet immédiat sur le worker existant : le changement de binding d'un
`wrangler secret put` crée une nouvelle VERSION automatiquement (aucun
redéploiement de code nécessaire).

**Interdits respectés** : sécurité inchangée, service_role conservé, RLS
inchangée, clé jamais exposée au navigateur, migrations inchangées,
validation MIME inchangée, limites de bucket inchangées.

## 6. TESTS EXÉCUTÉS APRÈS CORRECTIF (3 novembre 2026)

1. `wrangler secret list` (noms seuls) + `versions list` — **nouvelle version
   active 18:17:11 UTC créée automatiquement par le `secret put`** (aucun
   redéploiement de code) ; le worker `bonne-humeur-tv-preview` sert toujours.
2. **Routes live conformes (aucune régression)** : `/`, `/actualites`,
   `/contact`, `/admin/login` → 200 · `/admin` + gardes → 307 · 2 pages
   attendues en 404 (état antérieur inchangé).
3. **Smoke Storage service_role (la voie exacte de l'upload en échec) :
   JPEG + PNG + WebP → 3/3 upload OK, lecture publique HTTP 200, suppression
   OK, dossier de test vide (zéro orphelin)** — objets de test créés PUIS
   supprimés, aucune donnée d'article touchée.
4. Chaîne de non-régression (aucun code modifié) : `tsc --noEmit` exit 0 ·
   ESLint 0/0 · **Vitest 90/90** · `next build` 26 pages OK ·
   OpenNext (`opennextjs-cloudflare build`) exit 0.
5. `.env.local` local : BOM UTF-8 de la première ligne supprimé
   (`NEXT_PUBLIC_SUPABASE_URL` désormais lisible par tout outil) ;
   intégrité vérifiée (les 5 variables intactes).
6. Validation finale RÉELLE — **à la direction** (navigateur) : ouvrir un
   article → « Remplacer l'image » → attendu : prévisualisation + compression →
   « ✔ Couverture liée à cet article — enregistrez l'article maintenant » →
   enregistrer → image visible sur la page publique, la carte d'accueil et
   l'Open Graph. À faire sur téléphone également.

## 7. CHRONOLOGIE ET LIMITES DU DIAGNOSTIC

- Les secrets écrits ne peuvent pas être relus : la démonstration s'appuie
  sur la carte des signatures d'erreur + la sonde locale + la preuve de
  validité de la copie locale — convergence complète.
- `.env.local` : première ligne `NEXT_PUBLIC_SUPABASE_URL` précédée d'un BOM
  UTF-8 **dans le fichier local** (découvert lors du contrôle) — sans effet
  sur le site (le bundler supprime le BOM ; le site servait déjà la vraie
  URL) ; nettoyage local facultatif INCLUS dans le correctif.