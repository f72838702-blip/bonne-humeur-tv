# RAPPORT — ONGLET « DEMANDES » : NOTIFICATIONS INTELLIGENTES + SUPPRESSION · BONNE HUMEUR TV

**Date : 04/11/2026 · Branche `main` · Commit local `53e913b` · NON déployé · Migration 0027 PRÉPARÉE (NON appliquée) · Aucune donnée touchée**
**Formulaire public partenariat/contact : 0 modification (validations et anti-spam intacts)**

---

## 1. Diagnostic de l'existant (audit avant toute modification)

| Élément audit | Constat |
|---|---|
| Tables `partnership_requests` / `contact_messages` | statut global `new/processing/treated`, `admin_note`, `processed_at`, `ip_hash` — **aucun suivi de lecture** (pas de `seen_at`/`read_at`) |
| Politiques RLS (0003) | anon : INSERT seulement ; staff (admin+editor) : SELECT/UPDATE — **aucune policy DELETE** |
| Notifications | tableau de bord comptait **TOUTES** les demandes et les messages de statut `new` → ré-apparaissaient à chaque connexion, même traités (le problème constaté) ; aucune répétition à l'actualisation à corriger côté onglet |
| Realtime / polling | aucun mécanisme — les pages admin sont serveur-rendu à la navigation |
| Écrans | onglets Partenariats/Messages (compteur = TOTAL), `RequestStatusForm` (statut + note), aucune suppression, aucun badge « Nouveau/Non lu » |
| Architecture des statuts | **GLOBALE** (une colonne partagée, pas de rangée par admin) → le suivi de lecture doit être global aussi (décision documentée, §3) |

## 2. Fonctionnement actuel des notifications (avant)

Chaque connexion affichait « Demandes de partenariat : N » (total de la table) et « Messages non traités » (statut `new`) — y compris pour les éléments déjà traités/consultés → notifications répétitives, aucune notion de « nouveau pour un admin qui vient de regarder ».

## 3. Corrections effectuées — décision d'architecture documentée

**Suivi de lecture GLOBAL** (`seen_at` partenariats, `read_at` messages) : cohérent avec le modèle existant (les statuts, notes et dates de traitement sont déjà globaux et partagés entre admins). Pas de table `per-admin`, pas de doublon de fonctionnalité. Multi-admins : un élément lu par un admin cesse de notifier tout le monde — lecture unique d'une boîte commune, conforme à l'existant.

1. **Badge « Nouveau » / « Non lu »** : affiché uniquement quand `seen_at`/`read_at` est NULL (jamais vu). Les statuts de traitement (`new/processing/treated`) restent inchangés — la lecture ne « traite » rien.
2. **Consultation = marquage** : à l'ouverture de l'onglet, les éléments AFFICHÉS sont marqués vu/lu — **une seule UPDATE bornée aux ids à l'état NULL, idempotente, et AUCUNE écriture quand il n'y a rien de nouveau** → pas de notification répétée à l'actualisation (§2.C), pas de re-notification des anciennes demandes à chaque connexion (état persistant en base), pas d'écrasement d'horodatage.
3. **Compteurs intelligents** : onglets (« 2 nouvelles », « 3 non lus » en rouge, seulement si > 0), badge rouge sur l'entrée « Demandes » de la **sidebar** (2 requêtes `count` légères par navigation admin, **aucune requête pour les reporters**, zéro polling/zéro Realtime — quotas Supabase Free et Workers Free préservés), tableau de bord relabellisé « Nouvelle demande de partenariat » / « Messages non lus » (compte les jamais consultés, plus le total).
4. **Actualisation fluide** : bouton « Actualiser » (`router.refresh()` — rejoue seulement les composants serveur de la page, aucun rechargement complet, aucun coût).
5. **Suppression (nouvelle)** : bouton « Supprimer » (admin SEUL — l'éditeur ne le voit pas ET la base le refuse via la policy DELETE même via requête directe), **confirmation intégrée** (composant existant `DeleteActionForm`, pas d'alert JS), suppression DÉFINITIVE choisie plutôt que soft delete : **purge les données personnelles** (email/téléphone) — l'opération reste **journalisée dans `audit_logs`** (triggers étendus à DELETE), jamais déclenchée par une consultation, liste et compteurs revalidés immédiatement (sans rechargement complet), suppression individuelle ; pas de suppression en lot (pas de demande préexistante — proposable plus tard si souhaité).

## 4. Fichiers modifiés / créés (13)

| Fichier | Rôle |
|---|---|
| `supabase/migrations/0027_demandes_lu_et_suppression.sql` | **créé, NON appliqué** — colonnes `seen_at`/`read_at`, 2 policies DELETE admin, triggers d'audit étendus à DELETE |
| `lib/types.ts` | `seen_at`/`read_at` sur les types ; `DashboardStats` → compteurs « jamais consultés » |
| `lib/data/requests.ts` | marquage vu/lu (idempotent), suppression validée UUID, `getDemandesNotificationCount` (2 requêtes head) |
| `lib/requests-core.ts` + `lib/requests-core.test.ts` | **créés** — noyau pur (compteurs, ids à marquer) + 8 tests |
| `lib/actions/admin.ts` | `deleteRequestAction` (requireRole **admin** + schéma + revalidations) ; `setRequestStatus` intact |
| `lib/validation/schemas.ts` | `requestDeleteSchema` ajouté — aucune validation existante modifiée |
| `app/admin/demandes/page.tsx` | badges, compteurs d'onglets, marquage à la consultation, boutons Supprimer (admin), bouton Actualiser |
| `app/admin/layout.tsx` + `components/admin/Sidebar.tsx` | badge rouge sur « Demandes » (staff seulement) |
| `lib/data/dashboard.ts` + `app/admin/page.tsx` | compteurs intelligents relabellisés |
| `components/admin/RefreshButton.tsx` | **créé** — actualisation légère |

**Intacts** : `submitPartnership`/`submitContact` + `contactSchema`/`partnershipSchema` (§8), honeypot/rate-limit/Turnstile, RLS (renforcées, jamais affaiblies), toutes les autres pages admin.

## 5. Migration préparée (pourquoi, exactement)

`0027_demandes_lu_et_suppression.sql` est **indispensable** : aucun mécanisme de lecture ni de policy DELETE n'existe — impossible de satisfaire la mission sans colonnes ni permissions. Contenu minimal : 2 colonnes NULL par défaut (aucune donnée existante modifiée : les demandes en cours apparaîtront « Nouveau » une seule fois, puis seront marquées vues à la première consultation — exactement le comportement demandé), 2 policies DELETE admin, 2 triggers d'audit étendus (la fonction `audit_row_change` gère déjà l'opération DELETE, prouvé lignes 102-103 de 0002). **Ser appliquée à la base seulement sur votre autorisation expresse.**

## 6. Tests effectués et résultats

**Chaîne : vitest 242/242** (234 conservés + 8 nouveaux) · **tsc 0** · **ESLint 0/0** · **build 37 routes** (`/admin/demandes` 2.83 kB).

| Scénario §7 | Résultat | Preuve |
|---|---|---|
| 1. Nouvelle demande → notification | ✔ test | 1 demande `seen_at` NULL = 1 « nouvelle » |
| 2. Consultation → statut actualisé | ✔ conception + test | marquage idempotent des ids affichés ; badge disparaît au chargement suivant |
| 3. Nouveau message → notification | ✔ test | compteur « non lu » = 1 |
| 4. Message lu → compteur diminué | ✔ test | lu ⇒ 0 |
| 5. Actualisation — pas de répétition | ✔ test | ids déjà marqués exclus, liste vide ⇒ **aucune requête** |
| 6. Déconnexion/reconnexion | ✔ état en base | `seen_at`/`read_at` persistants (pas un état d'écran) |
| 7/8. Suppression demande/message | ✔ code + policy | action + RLS DELETE admin ; exécution réelle après migration + recette |
| 9. Annulation de confirmation | ✔ composant | `<details>` fermable, rien n'est envoyé sans « Confirmer » |
| 10. Compteurs après chaque action | ✔ code | revalidation `/admin/demandes` + `/admin` après suppression ; compteurs calculés sur l'état de lecture |
| 11. Non-autorisé = refusé | ✔ double barrière | interface (bouton masqué) + `requireRole(["admin"])` + **policy RLS DELETE admin** (l'éditeur est refusé par la base) |
| 12. Ordinateur + mobile | ✔ design existant | flex-wrap partout, mêmes composants éprouvés ; recette smartphone recommandée |

Tests DOM navigateur : non exécutables dans cet environnement — recette administrative ci-dessous après déploiement + migration.

## 7. Limites restantes

1. La migration 0027 n'est **pas appliquée** et le code n'est **pas déployé** — la fonctionnalité complète exige les deux, dans cet ordre : migration puis déploiement.
2. Suivi de lecture global (pas par admin) : assumé et conforme à l'architecture des statuts — si vous voulez un suivi par administrateur plus tard, ce sera une table dédiée (non fabriquée sans examen).
3. Pas de suppression en lot (sélection multiple) : ajout simple possible sur demande.
4. Pas de notification temps réel (zéro polling choisi pour les quotas) : le badge se met à jour à chaque navigation admin et via « Actualiser ».

## 8. Instructions de test dans l'administration (≈ 5 min, après migration + déploiement)

1. Connectez-vous en admin → **badge rouge sur « Demandes »** si du nouveau (demandes existantes : apparaissent « Nouveau » une seule fois lors de la première visite — volontaire).
2. Envoyez (ou demandez à quelqu'un d'envoyer) une demande de partenariat depuis le site public → revenez dans l'admin : badge + onglet « 1 nouvelle », carte marquée **« Nouveau »**.
3. Rafîraîchissez ou naviguez : la carte perd son badge, le compteur retombe à 0 — **jamais re-notifiée**.
4. Déconnectez-vous, reconnectez-vous : compteur toujours 0 (état conservé).
5. Même scénario pour un message de contact (badge « Non lu », onglet « 1 non lu »).
6. Cliquez « Supprimer » sur une ancienne demande → panneau de confirmation → « Confirmer la suppression » → carte disparue, compteurs à jour **sans rechargement complet**.
7. Re-testez avec **Annuler** (fermer le panneau) : rien n'est supprimé.
8. Connectez-vous avec un compte **éditeur** : bouton « Supprimer » absent ; en compteur, badge visible ; toute requête de suppression directe est refusée par la base (policy).

**Opérations restant soumises à votre autorisation : application de la migration 0027 (Supabase), déploiement Cloudflare, push GitHub.**