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
| 2 | `0002_functions.sql` | Fonctions rôles, trigger création profil, audit, `check_rate_limit`, `search_published` |
| 3 | `0003_rls.sql` | Row Level Security : chaque table verrouillée, règles par rôle |
| 4 | `0004_storage.sql` | Bucket `media` (public en lecture, 5 Mo, images uniquement) |
| 5 | `0005_seed_categories.sql` | Catégories éditoriales structurelles (Politique, Société, Économie…) |
| 6 | `0006_scheduled_publish.sql` *(optionnel)* | Publication programmée via pg_cron |
| 7 | `0007_video_position.sql` | Colonne `videos.position` (épinglage accueil) — **OBLIGATOIRE avant toute utilisation du formulaire vidéo** (sinon l'INSERT échoue) |
| 8 | `0008_media_folders.sql` | Plafond bucket 2 Mo + lecture publique restreinte aux 5 dossiers logiques (`articles/`, `categories/`, `thumbnails/`, `reporters/`, `branding/`) |

Notes de validation (exécution RÉELLE sur PostgreSQL 17 isolé, émulation Supabase —
harnais dans `supabase/test-local/`, cf. `RAPPORT_CONTROLE_FINAL_BONNE_HUMEUR_TV.md`) :

- **L'ordre ancien (0002_rls avant 0003_functions) a été PROUVÉ INVALIDE** par exécution :
  `CREATE POLICY` résout les fonctions à la création — l'ancien ordre échouait avec
  « function public.has_role(unknown) does not exist ». Les fichiers ont été renumérotés
  (fonctions en 0002, RLS en 0003) : l'ordre ci-dessus est celui validé.
- Les 8 migrations s'exécutent depuis une base vierge **sans aucune erreur**
  (22 tests RLS/sécurité PASS — anti-élévation, anti-auto-publication, rate limiting,
  Storage, recherche, publication programmée, 0007).

Chaque fichier est idempotent ou s'exécute une seule fois : ne PAS relancer un
fichier déjà appliqué sans vérification.

## 3. Premier compte administrateur

L'inscription publique crée toujours des comptes **reporter** (trigger
`handle_new_user` — personne ne peut s'attribuer un rôle privilégié).

1. **D'abord créer le compte dans Auth** : Dashboard → Authentication → Users →
   **Add user → Create new user** (email + mot de passe, cocher *Auto Confirm*).
2. **Ensuite promouvoir** en admin (le trigger `handle_new_user` a créé la
   ligne `profiles` avec le rôle `reporter`) — SQL Editor, une seule fois :

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'admin@exemple.gn');
```

3. Vérifier dans la table `profiles` (le rôle doit afficher `admin`).

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

## 6. Checklist finale du propriétaire (contrôle de livraison)

**Organisation & projet**
- [ ] Organisation Supabase créée (plan Free, 1 seul projet actif + 1 en pause max)
- [ ] Projet créé dans une région proche des lecteurs (ex. `eu-west` / Paris ou Londres)
- [ ] **NOTE** : un projet Free est suspendu après ~1 semaine d'inactivité —
  réactivation en 1 clic depuis le Dashboard ; prévoir une visite hebdomadaire
  (ou une utilisation réelle du site, ce qui suffit)
- [ ] **NOTE** : aucun backup automatique quotidien en Free — faire un export
  `pg_dump` / CSV manuel au moins après chaque lot de contenu important (voir §7)

**Migrations**
- [ ] Les 8 migrations exécutées dans l'ordre 0001 → 0008 via SQL Editor
  (noms corrigés : `0002_functions.sql` PUIS `0003_rls.sql` — l'ancien
  ordre a été prouvé invalide par exécution réelle, voir
  `supabase/test-local/RESULTAT_MIGRATIONS_POSTGRESQL.txt`)
- [ ] Vérification : 11 tables publiques + 11 catégories + table `audit_logs` remplie au moindre update

**Admin & connexion**
- [ ] Compte admin créé via Auth → Add user (Auto Confirm) AVANT tout
- [ ] Promotion SQL en `role='admin'` exécutée (§3)
- [ ] Connexion `/admin/login` → tableau de bord avec compteurs réels

**Variables d'environnement**
- [ ] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SUPABASE_SERVICE_ROLE_KEY` (serveur uniquement) configurées
  chez l'hébergeur **et** en local (`.env.local`)

**Permissions & sécurité**
- [ ] Un compte `reporter` de test ne peut ni publier ni se promouvoir admin
- [ ] `contact`/`partenariats` : le public peut envoyer mais ne peut RIEN lire
- [ ] `/admin` inaccessible sans session (redirection vers `/admin/login`)

**Upload d'images**
- [ ] Upload d'une image article (< 2 Mo, WebP compressé) → visible sur le site
- [ ] (sans `service_role` connecté : médiathèque désactivée = état attendu)

**Formulaires, recherche & CMS**
- [ ] Formulaire contact → message visible dans `/admin/demandes`
- [ ] Formulaire partenariat → visible dans `/admin/demandes`
- [ ] Deux envois rapides → 3e bloqué (rate limiting en base)
- [ ] Recherche `/recherche?q=` : ne retourne QUE les articles publiés
- [ ] Créer un article → publier → visible sur `/actualites` (et dans le flux RSS du sitemap)
- [ ] Ajouter une vraie vidéo YouTube → épinglage éventuel → visible sur `/videos`
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