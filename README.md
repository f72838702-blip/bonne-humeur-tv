# Bonne Humeur TV 🇬🇳

Plateforme Web TV & portail d'information — « La Télé de la nouvelle génération »
(Conakry, Guinée). Site public + back-office éditorial complet.

**Stack :** Next.js 15 (App Router, TypeScript strict) · React 19 · Tailwind CSS v3 ·
Supabase (PostgreSQL + Auth + Storage, RLS) · Vitest · ESLint 9 · Vercel

## Démarrage

```bash
npm install
cp .env.example .env.local   # renseigner les clés (voir .env.example)
npm run dev
```

> **Sans clés Supabase**, le site fonctionne intégralement : toutes les pages
> affichent des états honnêtes (« pas encore de publication », « back-office
> non configuré ») — **jamais de contenu fictif**. Les formulaires informent
> que l'enregistrement est indisponible et proposent le canal WhatsApp.

## Commandes

| Commande | Rôle |
|----------|------|
| `npm run dev` | Serveur de développement |
| `npm run build` / `npm start` | Build et serveur de production |
| `npm run lint` | ESLint (flat config, règles Next) |
| `npx tsc --noEmit` | Type-check strict |
| `npm test` | Tests unitaires (Vitest) |
| `npm run audit:check` | Audit sécurité des dépendances |

## Architecture

```
app/
  ├─ page.tsx                Accueil (flash-infos, direct réel, à la une, actualités)
  ├─ actualites/             Portail d'information : liste paginée, [slug], catégorie
  ├─ videos/                 Web TV : grille + [slug] (embed youtube-nocookie)
  ├─ recherche/              Recherche globale (RPC search_published)
  ├─ contact/ partenariats/  Formulaires sécurisés (Zod serveur + rate limit + honeypot)
  ├─ mentions-legales/ confidentialite/  Pages légales ([À VALIDER])
  ├─ sitemap.ts robots.ts    SEO (contenus réellement publiés uniquement)
  └─ admin/                  Back-office : login, dashboard, articles (workflow
                             draft→review→scheduled→published→archived), vidéos,
                             flash-infos, demandes B2B/contact, catégories,
                             médiathèque, utilisateurs & rôles
components/                  Public (home/, video/, contact/, partenariats/, layout/)
  └─ admin/                  Composants du CMS
lib/
  ├─ supabase/               4 clients séparés : public (cookieless, ISR), server
  │                          (session), admin (service_role, serveur uniquement)
  ├─ data/                   Lectures typées (RLS), états vides honnêtes
  ├─ actions/                Server Actions : formulaires, auth, CMS, admin
  ├─ auth/session.ts         requireRole() — garde serveur des pages/actions
  ├─ validation/schemas.ts   Zod 4 — validation 100 % serveur
  └─ content/markdown.ts     Rendu Markdown sûr (échappement avant parsing)
supabase/migrations/         0001 schéma → 0002 RLS → 0003 fonctions →
                             0004 storage → 0005 catégories → 0006 publication
                             programmée (optionnelle)
store/theme.ts               Thème clair/sombre (persisté, sans FOUC)
```

## Sécurité — principes

- **RLS partout** : la base applique chaque règle, la UI ne fait que requêter.
- Rôles : `admin` > `editor` > `reporter` ; personne ne peut s'auto-promouvoir
  (trigger d'inscription + policy de comparaison des rôles).
- `SUPABASE_SERVICE_ROLE_KEY` : serveur uniquement, jamais dans un bundle client.
- Rate limiting des formulaires **en base** (fonction `check_rate_limit`),
  fiable en serverless ; honeypot ; Turnstile optionnel.
- Journal d'audit `audit_logs` en append-only (triggers sur les tables sensibles).
- En-têtes : CSP, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, HSTS.

## Configuration production

1. Migrations Supabase : voir **supabase/README-CONFIGURATION.md** (ordre strict).
2. Variables Vercel : voir **.env.example**.
3. Sauvegardes : **docs/SAUVEGARDE.md** · Déploiement : **docs/DEPLOIEMENT.md**.

## À faire valider par la direction

- [ ] Coordonnées officielles (email, téléphone) — marqueurs dans les pages légales
- [ ] Textes des pages légales (`/mentions-legales`, `/confidentialite`)
- [ ] Logo officiel (actuel : monogramme SVG générique)
- [ ] Plaquette institutionnelle PDF (si nécessaire — le lien mort a été retiré)