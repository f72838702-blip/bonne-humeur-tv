# CAHIER D'IMPLÉMENTATION — RÉGIE PUBLICITAIRE BONNE HUMEUR TV
## Branche `feature/regie-publicitaire` (créée de `deploy/cloudflare-staging` @ `bb0f459`) · 3 novembre 2026

Document d'architecture rédigé APRÈS l'audit des fichiers réels (§1), AVANT
toute migration appliquée : **aucune migration distante, aucun deploy, aucun
push pendant la mission** (`0025`/`0026` préparées localement uniquement).

---

## 1. AUDIT DE L'ÉTAT RÉEL (fichiers + base distante, lecture seule)

**Vérifié par lecture des fichiers réels et par SQL lecture seule sur le
projet `beinalmwqkxbqitvuobr`** (API Management, aucune écriture) :

- **Branche** : `deploy/cloudflare-staging` arbre PROPRE, HEAD `bb0f459`
  (rapport flash-infos consolidé) — toutes les modifications précédentes
  présentes. Branche de travail créée : `feature/regie-publicitaire`.
- **Migrations réellement présentes** : `0001`-`0008`, `0023`, `0024`
  (10 fichiers — la liste du cahier de mission était correcte).
- **Base distante** : 0 table `ad_*` (aucune régie préexistante),
  11 tables métier réelles (`profiles`, `articles`, `videos`,
  `breaking_news`, `partnership_requests`, `contact_messages`,
  `form_submissions`, `audit_logs`, `tags`, `article_tags`, `_migrations`).
- **Bucket `media` LIVE** : public, limite réelle **2 Mo** (`2097152` octets
  — la migration 0004 indiquait 5 Mo, la valeur live est 2 Mo : c'est le
  fichier réel et la base qui font foi), MIME jpeg/png/webp/gif ;
  dossiers de stocks existants : `/articles` uniquement.
  → le nouveau dossier logique `advertising/` est un **changement de code
  seul** (constante `MEDIA_PURPOSES`), aucune migration Storage nécessaire.
- **Rôles réels** : `profiles.role` ∈ admin/editor/reporter ; fonctions
  `has_role()`, `is_admin()`, `is_staff()` (0002, SECURITY DEFINER,
  ordre migrations = fonctions AVANT policies — respecté impérativement).
- **RLS 0003** : policies par fonction de rôle ; pattern confirmé.
- **Audit** : trigger `audit_row_change()` sur articles/videos/breaking_news/
  partnership_requests/contact_messages/profiles (23 lignes d'audit réelles).
- **Gardes** : `requireRole(roles)` dans CHAQUE page + CHAQUE action
  (session + rôle) ; middleware `/admin` = garde UX seulement.
- **Clients** : `getSupabasePublicClient` (anon, sans cookies → ISR) et
  `getSupabaseServerClient` (cookies de session). Uploads : service_role
  côté serveur uniquement (`uploadMediaVariants`, pipeline compression
  navigateur + validation signature MIME `sniff.ts`).
- **CSP** : `img-src` self + i.ytimg + `*.supabase.co` ;
  `frame-src` youtube-nocookie + turnstile — **rien à ouvrir pour la régie**
  (images depuis Storage, vidéos YouTube no-cookie, redirections serveur).
- **Conventions formulaires** : `useActionState` + `ActionState`
  (helpers.ts : successState/errorState/zodFieldErrors/formDataBool),
  `bodySizeLimit` 3 mb, `revalidatePath`.
- **Fuseau** : `parseConakryInput`/`formatConakryDateTime` (flash-core,
  UTC+0 constant) — **réutilisés** pour la programmation des campagnes.
- **Vitest** : `lib/**/*.test.ts`, environment node.

## 2. ARCHITECTURE RETENUE

### Décisions structurantes
1. **8 tables SQL** (7 proposées + `ad_partners` justifiée) dans
   **une migration 0025** (tables + fonction diffusion + RPC trackers +
   seed emplacements) et **une migration 0026** (RLS + grants) —
   découpage conforme à la convention 0001 schéma / 0003 policies du projet.
2. **Le statut « Programmée » n'est jamais stocké** : il EST l'état effectif
   calculé d'une campagne `active` dont `start_at` est futur (moteur pur
   `adStateOf`). Statuts stockés : draft, pending, active, suspended,
   completed, cancelled, refused — transition contrôlée côté serveur
   (`canTransition`), refus/refusée/annulée/terminée réservés admin.
   **Diffusion publique = `status='active'` ET période couvrant « maintenant
   serveur » ET création approved ET emplacement actif autorisé.**
3. **Noyau pur testable** `lib/ads/ads-core.ts` (0 dépendance) : codes
   emplacements, formats, `adStateOf`, `canTransition`, validation d'URLs
   (http/https exclusivement — refus javascript:/data:/file:), sélection/
   rotation pondérée déterministe par fenêtre de 5 min (aucune campagne ne
   peut monopoliser un emplacement), CTR, agrégats, règles d'impression.
4. **Aucune URL externe dans le DOM public** : les liens des créations
   pointent la **route interne `/ads/click/[id]`** (id UUID) → le serveur
   charge la destination DEPUIS LA BASE (création approved + campagne en
   diffusion), revalide http/https, enregistre le clic, redirige (302).
   Aucun open redirect possible (aucune URL reçue du client).
5. **Impression** (règle uniforme documentée) : une impression = créative
   rendue par l'AdSlot ; dédupliquée **1 impression max / calendrier / jour /
   créative** par empreinte serveur (`ad_event_fingerprints` = SHA-256 de
   IP+UA+créative+jour — AUCUNE IP brute stockée), compteur agrégé
   **quotidien** (`ad_daily_stats`), idempotence par INSERT-or-ignore.
   Purge quotidienne > 3 jours via pg_cron (infrastructure 0006 déjà
   opérationnelle). Les chiffres sont **indicatifs** — jamais « audience
   certifiée », pas de facturation CPM/CPC fondée dessus (forfaits).
6. **Stockage** : réutilisation du bucket `media` (2 Mo, compression
   navigateur existante, validation signature serveur) + dossier
   `advertising/`. **Aucun nouveau bucket, aucun service payant.**
7. **Pas de polling** : tout le rendu public est Server Components
   (1 requête regroupée par emplacement via fonction SQL `get_public_ads`),
   l'iframe/lecteur YouTube est lazy (composant `YouTubeEmbed` existant).
8. **RLS stricte** : anon = exécution des 3 fonctions publiques seulement
   (diffusion, impression, clic) — **jamais les tables** ; reporter =
   aucun accès régie ; editor = campagnes/créations/annonceurs sans
   paiements (lecture stats) ; admin = tout.
9. **Vidéos publicitaires** : YouTube uniquement via `extractYouTubeId`
   (module réel existant, 4 formes d'URL acceptées, iframe jamais acceptée),
   lecteur no-cookie + lazy + mention « Publicité ».
10. **Article sponsorisé** : relation `ad_creatives.article_id → articles`
    (aucune copie d'article). Mentions « Sponsorisé » sur la fiche, les
    cartes (badge), et un avertissement dans `generateMetadata` (partages).

### Schéma des tables (0025)
```
advertisers        (annonceurs : identité + contact + statut)
ad_partners        (partenaires officiels : logo + lien + ordre + période)
ad_placements      (EMPLACEMENTS : code unique, formats[], max_items,
                    devices, sort_order, is_active — SEED 8 codes)
ad_campaigns       (campagnes : annonceur, période, facturation,
                    montant/devise GNF, priorité, contrat, statut)
ad_creatives       (créations : campagne, format, payload jsonb VALIDÉ
                    zod par format, status draft/approved/refused, weight)
ad_campaign_placements (campagne ↔ emplacement, PK composite)
ad_payments        (règlements manuels : montant/mode/référence/agent)
ad_daily_stats     (agrégats quotidiens creative×placement×jour, PK composite)
ad_event_fingerprints (empreintes déduplication, PK unique, purge pg_cron)
```
Clés UUID, FK, index (statuts, périodes, campagnes actives, recherches
nom/ILIKE), checks (formats, statuts, devise 3 lettres, période
end>start, poids 1-20), triggers `touch_updated_at` + `audit_row_change`
(advertisers, ad_campaigns, ad_creatives, ad_payments).

### Fonctions SQL
- `get_public_ads(p_code text)` — SECURITY DEFINER ; renvoie UNIQUEMENT
  les champs d'affichage des créations diffusables (aucune coordonnée
  annonceur, aucun contrat) — exécutée par anon (ISR).
- `record_ad_event(p_creative uuid, p_kind text, p_placement text,
  p_fingerprint text)` — SECURITY DEFINER ; insert-or-ignore en
  `ad_event_fingerprints` puis incrément agrégé UNIQUEMENT si nouvel
  événement → idempotence réelle.
- `purge_ad_fingerprints()` — pg_cron quotidien.

## 3. PLAN DE RÉALISATION (ordre des chantiers)

| # | Chantier | Fichiers |
|---|---|---|
| A | Noyau pur + tests | `lib/ads/ads-core.ts`, `ads-core.test.ts` |
| B | Migrations SQL | `0025_regie_publicitaire_tables.sql`, `0026_regie_publicitaire_rls.sql` |
| C | Schémas Zod + types | `lib/validation/ads-schemas.ts`, `lib/types.ts` (+) |
| D | Actions serveur | `lib/actions/ads.ts` (annonceurs, campagnes + transitions + contrat, créations + validation, emplacements, partenaires, règlements) |
| E | Lectures admin + diffusion | `lib/data/ads.ts`, `lib/data/ads-public.ts` |
| F | Pages admin (9 routes) | sous `/admin/publicites/*` + navigation Sidebar « Publicités » |
| G | Composants admin | `components/admin/AdsForms.tsx` (formulaires + confirmations) + réutilisation uploader (dossier `advertising/`) |
| H | Route clic + tracker | `app/ads/click/[id]/route.ts`, `app/ads/track/route.ts`, `AdImpressionTracker` |
| I | Intégration publique | composants `AdSlot/AdBanner/AdCard/AdVideo/PromoStrip/PartnerShowcase/SponsoredArticleCard` + page d'accueil, actualités, article, vidéos |
| J | Export CSV | `app/admin/publicites/export/route.ts` |
| K | Tests + builds + preview | vitest, tsc, eslint, next build, opennext build, wrangler dev local |
| L | Rapport + verdict | `RAPPORT_DEVELOPPEMENT_REGIE_PUBLICITAIRE_BONNE_HUMEUR_TV.md` |

### Contraintes respectées d'emblée
- **0 migration distante appliquée** ; lecture seule sur la base réelle.
- **Aucun deploy Cloudflare** (le preview est local `wrangler dev`) ;
  aucun push, aucune fusion `main`, aucun DNS.
- Budget **0 USD** : aucune dépendance npm nouvelle (lucide-react,
  zod, supabase-js, tailwind déjà présents).
- Aucune publicité dans `/admin` (composants publics jamais importés dans
  le CMS) ni sur les écrans d'erreur/authentification.
- Compteurs de tableau de bord = données réelles ou zéro (aucun faux
  chiffre, aucune donnée fictive en base distante).