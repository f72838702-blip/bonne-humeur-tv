# Sauvegarde & restauration — Bonne Humeur TV

## Ce qu'il faut sauvegarder

| Élément | Contenu | Fréquence recommandée |
|---------|---------|----------------------|
| Base Supabase | articles, vidéos, profils, demandes B2B, messages, catégories, flash-infos | Hebdomadaire + avant chaque migration |
| Storage Supabase (`media`) | Images des articles/vidéos | Hebdomadaire |
| Dépôt GitHub | Code + migrations (history = sauvegarde native) | À chaque push |
| Variables d'environnement | `.env.local` (local) + Vercel | À chaque modification (copie hors-ligne sécurisée) |

## Base de données

**Automatique (dashboard)** : Database → Backups. Rétention selon le plan
Supabase (plan gratuit : 7 jours).

**Export manuel via CLI** (à exécuter depuis un poste disposant des accès) :

```bash
# Structure + données (remplacer $REF par l'identifiant du projet)
supabase db dump --project-ref $REF -f backup-$(date +%F).sql

# Restauration (nouveau projet vierge, migrations appliquées puis) :
psql "$DATABASE_URL" -f backup-2026-10-31.sql
```

**Périodique avant migration** : chaque application d'un fichier de
`supabase/migrations/` doit être précédée d'un export complet.

## Storage

```bash
# Listing puis téléchargement des objets du bucket « media »
supabase storage ls media --project-ref $REF -r
supabase storage download media uploads/ ./backup-media/
```

## Secrets

- Ne JAMAIS committer `.env.local` (vérifié par `.gitignore`).
- Conserver une copie chiffrée des clés (service_role incluse) hors du dépôt.

## Restauration complète (ordre)

1. Recréer le projet Supabase.
2. Appliquer les migrations 0001 → 0006 (ordre strict, cf. supabase/README-CONFIGURATION.md).
3. Restaurer les données (`psql -f backup-…sql`).
4. Restaurer le Storage (`supabase storage upload …`).
5. Redéfinir les variables Vercel puis redéployer.
6. Vérifier : `/admin` connexion, `/actualites`, `/videos`, un envoi de formulaire de test.