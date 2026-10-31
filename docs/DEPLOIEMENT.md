# Déploiement — Bonne Humeur TV

## Environnements

| Environnement | Branche | URL |
|---------------|---------|-----|
| Production | `main` | https://bonne-humeur-tv.vercel.app |
| Preview (par PR) | toute PR | URL éphémère Vercel |

## Flux de mise en production

1. Développement sur une branche dédiée (ex : `feature/plateforme-media`).
2. `npm run lint && npx tsc --noEmit && npm test && npm run build` — tout doit passer.
3. PR vers `main` → CI GitHub Actions (lint, types, tests, build, audit).
4. Revue, puis merge → Vercel déploie automatiquement la production.
5. **Aucun déploiement sans validation explicite de la direction** (règle du projet).

## Variables Vercel (Production ET Preview)

Voir `.env.example` : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`, clés Turnstile (optionnel).

Règles :
- `SUPABASE_SERVICE_ROLE_KEY` : serveur uniquement — ne JAMAIS la préfixer
  `NEXT_PUBLIC_`.
- Après toute modification : **Redeploy** (les variables ne sont lues qu'au build
  pour les valeurs NEXT_PUBLIC_*).

## Migrations base de données

- Les migrations ne sont JAMAIS appliquées automatiquement au déploiement :
  procédure manuelle dans `supabase/README-CONFIGURATION.md` (ordre strict
  0001 → 0006, sauvegarde préalable — voir `docs/SAUVEGARDE.md`).
- Le site déployé SANS backend configuré fonctionne : toutes les pages affichent
  des états honnêtes (« non configuré » / listes vides), jamais de contenu fictif.

## Vérifications post-déploiement (checklist)

- [ ] Accueil charge, bandeau flash-info absent ou réel
- [ ] `/actualites`, `/videos`, `/recherche` répondent
- [ ] `/admin/login` → connexion admin opérationnelle
- [ ] En-têtes de sécurité présents : `curl -sI https://… | grep -i content-security`
- [ ] `/sitemap.xml` et `/robots.txt` répondent
- [ ] Formulaire contact : envoi réel → message serveur de succès + entrée dans `/admin/demandes`

## Retour arrière

Vercel → Deployments → **Rollback** sur le déploiement précédent (instantané,
aucune intervention base requise sauf si une migration a été appliquée entre-temps
— voir alors `docs/SAUVEGARDE.md` § restauration).