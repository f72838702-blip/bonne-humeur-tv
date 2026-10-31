# Configuration Supabase — Bonne Humeur TV

Ce document décrit la mise en production réelle du backend. **Aucune de ces
étapes n'a été exécutée automatiquement** : elles nécessitent les accès au
dashboard Supabase, détenus par la direction.

## 1. Création du projet

1. Créer un compte sur [supabase.com](https://supabase.com).
2. Créer un projet (région la plus proche de la Guinée : `eu-west` ou `eu-central`).
3. Noter l'URL du projet et les clés dans **Settings → API**.

## 2. Application des migrations (ORDRE STRICT)

Dans le **SQL Editor** du dashboard, exécuter dans l'ordre les fichiers de
`supabase/migrations/` :

| Ordre | Fichier | Contenu |
|-------|---------|---------|
| 1 | `0001_schema.sql` | Tables : profiles, categories, tags, articles, article_tags, videos, breaking_news, partnership_requests, contact_messages, form_submissions, audit_logs |
| 2 | `0002_rls.sql` | Row Level Security : chaque table verrouillée, règles par rôle |
| 3 | `0003_functions.sql` | Fonctions rôles, trigger création profil, audit, `check_rate_limit`, `search_published` |
| 4 | `0004_storage.sql` | Bucket `media` (public en lecture, 5 Mo, images uniquement) |
| 5 | `0005_seed_categories.sql` | Catégories éditoriales structurelles (Politique, Société, Économie…) |
| 6 | `0006_scheduled_publish.sql` *(optionnel)* | Publication programmée via pg_cron |

Chaque fichier est idempotent ou s'exécute une seule fois : ne PAS relancer un
fichier déjà appliqué sans vérification.

## 3. Premier compte administrateur

L'inscription publique crée toujours des comptes **reporter** (trigger
`handle_new_user` — personne ne peut s'attribuer un rôle privilégié).
Pour promouvoir le premier admin :

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'admin@exemple.gn');
```

(à faire une seule fois, depuis le SQL Editor, puis vérifier dans la table
`profiles`).

## 4. Variables d'environnement

Local : copier `.env.example` vers `.env.local` et renseigner.
Vercel : **Settings → Environment Variables**, ajouter :

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` *(serveur uniquement — jamais côté client)*
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` *(optionnel)*
- `YOUTUBE_API_KEY` *(optionnel — serveur uniquement, jamais NEXT_PUBLIC_* :
  import des métadonnées YouTube dans le CMS ; sans elle, l'ajout manuel
  fonctionne, cache serveur 1 h pour préserver le quota de l'API)*

Redéployer après modification.

## 5. Rôles et permissions

| Rôle | Droits |
|------|--------|
| `reporter` | Rédige et modifie **ses** articles en brouillon / à valider. Ne publie pas. |
| `editor` | Tout le contenu : articles (publication), vidéos, flash-infos, catégories, médiathèque, demandes B2B/contact. |
| `admin` | Tout + gestion des utilisateurs (rôles, invitations, désactivation) + journal d'audit. |

Le changement de rôle est réservé aux admins (RLS `profiles_update` :
comparaison avec `current_role()` — un utilisateur ne peut pas s'auto-promouvoir).

## 6. Vérifications post-déploiement

- [ ] `/admin/login` affiche le formulaire (pas d'erreur)
- [ ] Connexion admin → tableau de bord avec compteurs réels
- [ ] Créer un article → publier → visible sur `/actualites`
- [ ] Ajouter une vraie vidéo YouTube → visible sur `/videos`
- [ ] Formulaire contact → message apparaît dans `/admin/demandes`
- [ ] `https://<site>/sitemap.xml` et `/robots.txt` répondent

## 7. Sauvegarde

- **Base** : Dashboard → Database → Backups (rétention selon le plan).
  Pour un plan gratuit, exporter régulièrement (`pg_dump` via CLI ou
  Export CSV des tables critiques).
- **Storage** : bucket `media` — exporter les fichiers périodiquement.
- **Procédure détaillée** : voir `docs/SAUVEGARDE.md`.

## 8. Limitations connues

- Sans `SUPABASE_SERVICE_ROLE_KEY` : invitations, médiathèque et rate limiting
  sont désactivés (états honnêtes affichés) — le reste fonctionne.
- La publication programmée exige pg_cron (`0006`, optionnel) : sans lui,
  les articles `scheduled` restent non publiés jusqu'à édition manuelle.
- Le CSP autorise `script-src 'unsafe-inline'` (hydratation Next.js) —
  documenté dans le rapport final ; passage aux nonces = évolution future.