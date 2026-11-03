# RAPPORT DE DÉPLOIEMENT — BONNE HUMEUR TV
## Mises en ligne Cloudflare Workers Free · 3 novembre 2026

**Suite de** : `RAPPORT_PREPARATION_CLOUDFLARE_BONNE_HUMEUR_TV.md` (mission 2, verdict
*corrections terminées*) et `AUDIT_COMPATIBILITE_CLOUDFLARE_BONNE_HUMEUR_TV.md`
(verdict *PRÊT APRÈS CORRECTIONS*).
**Feux verts reçus** : préparation → build/tests locaux ; déploiement « deploye sur
workers.dev » ; correction SEO + retrait Vercel.
**Aucun secret affiché** : valeurs jamais imprimées, jamais commitées, jamais côté navigateur.

---

## 1. Ce qui a été fait, dans l'ordre chronologique

### Phase 1 — Préparation (branche `deploy/cloudflare-staging`)

1. **Branche indépendante créée** depuis `feature/plateforme-media` (HEAD audité 9c83c3f,
   HEAD réel f7d351f — la diff n'était qu'un document d'audit, zéro écart de code).
   `main` jamais touchée. **La branche expérimentale n'a PAS été fusionnée** (son ordre
   de migrations est l'ancien) — seuls 4 fichiers de configuration ont été repris et adaptés :
   `package.json` (+`@opennextjs/cloudflare ^1.20.15`, `wrangler ^4.156.0`),
   `wrangler.jsonc` (`nodejs_compat`, assets binding, compatibility_date 2026-10-01),
   `open-next.config.ts` (config minimale), `.gitignore` (+`.open-next/`, `.wrangler/`, `.dev.vars`).
2. **Versions installées et vérifiées** : `@opennextjs/cloudflare 1.20.15`
   (`@opennextjs/aws 4.1.14`), `wrangler 4.157.0`, **`next 15.5.28` et `react 19.2.8`
   inchangés** ; pas de vinext.
3. **Comportement cache/revalidation prouvé par le code source installé** : config vide →
   `tagCache: "dummy"` (source : `getByPath→[]`, `writeTags→no-op`, **« don't want to
   throw »**) → les ~30 appels `revalidatePath` des Server Actions sont **sans effet
   silencieux, sans erreur** ; `incrementalCache: "dummy"` → **chaque requête re-rend la
   page** donc **le contenu publié est visible immédiatement** (option A retenue :
   zéro ressource créée, pas de R2/D1/DO, 0 USD).
4. **Variables** : noms vérifiés dans le code ; `.dev.vars` (gitignoré) créé pour la
   preview avec la clé `SUPABASE_SERVICE_ROLE_KEY` **uniquement** (copiée depuis
   `.env.local` sans jamais l'afficher) ; `.env.local` jamais commité.
5. **Chaîne de vérifications complète (7/7)** :
   ts **0 erreur** · ESLint **0/0** · Vitest **55/55** · Build Next **29 routes** ·
   Build OpenNext **OK** · Preview `wrangler dev` **Ready** · **20/20 routes conformes**
   (12 public 200, 2 `[slug]` inexistants 404, 6 admin 307 → `/admin/login?next=…`) ·
   **6 en-têtes de sécurité + CSP complète préservés dans le runtime Workers**.
6. **Scan anti-fuite de secret** : les **62 bundles clients** de `.open-next/assets` →
   **0 occurrence** de la clé service_role ; scan de `worker.js` → clé **non inline**, lue
   au runtime via binding.

### Phase 2 — Déploiement (feu vert explicite)

7. **Authentification Wrangler par la direction** : `! npx wrangler login` →
   **bonnehumeur877@gmail.com** (Account ID `64ecce63d44de520d945df005b41dac8`),
   OAuth stocké localement, jamais dans le dépôt.
8. **Premier déploiement** : `wrangler deploy` (OpenNext CLI) — **exit 0**,
   **Worker Startup Time 18 ms** (limite Free : 1 s), 55 assets uploadés,
   version `e936b82a`.
9. **Secret posé en production** : `wrangler secret put SUPABASE_SERVICE_ROLE_KEY`
   (valeur transmise par pipe depuis `.env.local`, **jamais affichée ni tapée dans le chat**).
10. **Balayage production 20/20 routes conformes** (identique à la preview) +
    CSP/headers vérifiés **en direct**.

### Phase 3 — Corrections post-tests

11. **Défaut détecté au test** : `robots.txt` et URL canoniques/sitemap pointaient vers
    l'ancienne URL Vercel (défaut `NEXT_PUBLIC_SITE_URL`).
12. **Correction** : `NEXT_PUBLIC_SITE_URL=https://bonne-humeur-tv-preview.…workers.dev`
    (dans `.env.local`) → rebuild OpenNext + **redéploiement, version `fcafd32d`** →
    vérifié en live : `Sitemap: https://…workers.dev/sitemap.xml` ✓ et `<loc>` sitemap ✓.
13. **Retrait Vercel (demande explicite de la direction — « uniquement sur Cloudflare »)** :
    authentification Vercel CLI par la direction (device code), projet
    `dk-447c/bonne-humeur-tv` **SUPPRIMÉ définitivement** →
    `bonne-humeur-tv.vercel.app` = **404 confirmée**. Aucun contenu perdu (tout le code
    est dans le dépôt local). **Le site vit désormais UNIQUEMENT sur Cloudflare :
    https://bonne-humeur-tv-preview.bonne-humeur-tv.workers.dev → 200**.

## 2. URL de production actuelle

| URL | État |
|---|---|
| **https://bonne-humeur-tv-preview.bonne-humeur-tv.workers.dev** | **EN LIGNE (200)** — plan **Free**, 0 USD |
| `bonne-humeur-tv.vercel.app` | retiré (projets Vercel supprimés, 404) |

## 3. Tests exécutés en production (lecture seule)

| Test | Résultat |
|---|---|
| 20 routes (publiques `[slug]` admin sitemap robots) | 12×200 · 2×404 · 6×307 — **conformes** |
| Title/description/Open Graph/JSON-LD accueil | ✓ présents |
| RLS en direct (anon REST : 0 article, 0 profil, 11 catégories) | ✓ |
| Recherche RPC `search_published` (page 200, titre correct) | ✓ |
| `robots.txt` : `/admin` interdit | ✓ — Sitemap ✓ |
| CSP complète + XFO/nosniff/Referrer/Permissions/HSTS | ✓ préservés |
| Temps de réponse (réseau inclus) | `/` ~1,0 s · listes ~1,3 s · autres ~0,75 s — aucune erreur 1102 |

## 4. Ce qui reste à faire (par la direction ou avec son autorisation)

| # | Action | Qui |
|---|---|---|
| 1 | Tests CMS depuis le navigateur (login, article → publication → affichage public immédiat, upload image, contact → `/admin/demandes`) | direction (navigateur) |
| 2 | **Mesure CPU p50/p99** : Dashboard Cloudflare → Workers → `bonne-humeur-tv-preview` → métriques (**CPU Time**, jamais « Startup ») après navigation sur les pages principales | propriétaire (compte Free) |
| 3 | Si p99 trop proche de 10 ms : activer les caches gratuits OpenNext (KV + D1 + queue DO) — toujours 0 USD | avec accord |
| 4 | Domaine personnalisé (optionnel, ~0,10 USD/mois) + DNS | direction |
| 5 | `NEXT_PUBLIC_SITE_URL` à re-définir (1 ligne + rebuild) si domaine final acquis | moi (avec accord) |
| 6 | Re-changer le mot de passe admin (il a transité dans la conversation) | moi (avec accord) |
| 7 | Backup pg_dump périodique (Supabase Free = zéro sauvegarde auto) + visite hebdomadaire du dashboard (suspension ~1 semaine) | direction |
| 8 | Push GitHub (aucun push effectué — tout reste local) et fusion éventuelle dans `main` | avec accord |

## 5. Git

- Branche de travail **`deploy/cloudflare-staging`** : commits
  `53b2703` (intégration OpenNext + rapport préparation) et le commit du présent rapport.
- `feature/plateforme-media` intacte (f7d351f) · `main` intacte (9351a77) ·
  `experimental/cloudflare-workers` intacte (60564b2, jamais fusionnée).
- **Aucun push GitHub.** `.env.local` et `.dev.vars` jamais commités (vérifié).

## 6. Budget

| Poste | Coût |
|---|---|
| Cloudflare Workers **Free** (100 k req/j) | **0 USD** |
| Supabase Free (backend complet) | **0 USD** |
| Aucune ressource créée (pas de R2/D1/DO/Images, pas de Cron Cloudflare — pg_cron suffit) | **0 USD** |
| Domaine | **non acquis** (optionnel) |
| **TOTAL** | **0 USD/mois** ✅ |

---

**BILAN : Bonne Humeur TV est en ligne sur Cloudflare Workers Free**
(`bonne-humeur-tv-preview.bonne-humeur-tv.workers.dev`), exclusivement, avec le backend
Supabase réel connecté, la sécurité prouvée (RLS, secret, CSP), 20/20 routes conformes,
Worker Startup 18 ms, et un budget de 0 USD/mois. Restent uniquement les tests CMS au
navigateur et la mesure CPU par le propriétaire.