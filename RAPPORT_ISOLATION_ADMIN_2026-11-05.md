# RAPPORT — ISOLATION DE L'INTERFACE ADMINISTRATEUR (04-05/11/2026)

**Projet : bonne-humeur-tv · Commit : `786a708` · AUCUN déploiement ni push (en attente de votre autorisation).**

## 1. Cause exacte

Le layout racine `app/layout.tsx` rendait directement `<Header />`, `<Footer />`, `<WhatsAppFloat />` (et le tracker d'audience) pour **toutes les routes de l'application**, y compris `/admin/*` — le back-office étant imbriqué DANS ce layout racine, chaque page administrative héritait du chrome public : navigation visiteur, bouton WhatsApp flottant, pied de page, éléments de contact et de promotion.

C'est un défaut d'architecture (le layout racine portait deux expériences), pas un problème de permissions — l'authentification et les rôles fonctionnaient déjà correctement.

## 2. Correction — séparation propre au niveau Next.js (route group)

Aucune condition CSS dispersée, aucun masquage :

1. **`app/(public)/layout.tsx`** (Nouveau) — la façade visiteur ENTIERE vit ici : Header (navigation publique), Footer, bouton WhatsApp flottant, publicités (elles n'existaient que dans les pages publiques), JsonLd Organization et le tracker d'audience. Un route group entre parenthèses ne change AUCUNE URL : les visiteurs ne voient aucune différence.
2. **`app/layout.tsx`** — réduit au châssis minimal : `<html>`, thème clair/sombre, polices, balises `<head>`. Plus aucun composant public.
3. **Toutes les routes publiques déplacées** dans `app/(public)/` (git mv, historique préservé) : accueil, `/actualites`, `/videos`, `/contact`, `/partenariats`, `/recherche`, `/confidentialite`, `/mentions-legales`. Les handlers `/ads/*` et `/api/*` restent à la racine (pas d'UI).
4. **`app/not-found.tsx`** — les URL totalement inconnues (ex. `/xyz`) rendent leur 404 avec le chrome public explicitement (aucune régression pour les visiteurs).
5. **`app/admin/not-found.tsx`** (Nouveau) — une URL inconnue sous `/admin/*` affiche désormais une 404 administrative épurée (retour au tableau de bord), sans aucun élément public.

## 3. Bouton « Voir le site public » (demande §3)

Placé dans la carte d'identité de la barre latérale du back-office (icône « ouverture externe ») : ouvre le site public dans un **nouvel onglet** (`target="_blank" rel="noopener"`) — la session et la page de travail restent ouvertes. C'est le **seul** accès public de l'administration connectée.

Note délibérée : l'écran de connexion `/admin/login` garde son lien discret « ← Retour au site public » — c'est un écran pré-connexion, pas un espace de travail (l'administration n'a plus aucun autre lien public).

## 4. Composants retirés de l'administration (via le layout, pas supprimés du site)

- `Header` (navigation publique Accueil / Actualités / Vidéos / etc.) ;
- `Footer` (pied de page public) ;
- `WhatsAppFloat` (bouton flottant de contact) ;
- Publicités et bandeaux (rendus dans Accueil / Actualités / Vidéos — ils n'ont jamais été importés par l'admin mais héritaient du même layout parent, la séparation racine y met fin définitivement) ;
- Collecte d'audience : TrackerStats est maintenant monté **uniquement** dans le layout public — le back-office n'exécute même plus ce composant (le client ne fait plus aucune requête d'analyse depuis /admin, en plus de l'exclusion côté code existant).

## 5. Tests réalisés

- `tsc --noEmit` : **EXIT 0** (après purge du cache des types générés périmés — le premier échec venait des stubs de l'ancien build, pas du code réel) ;
- ESLint : **0 erreur** ; vitest : **282/282 PASS** (17 fichiers) ;
- `next build` : **OK, 40/40 pages générées, aucune URL modifiée** (/, /actualites, /admin/* présentes comme avant) ;
- **Test visuel sur serveur de production local** (`next start`) :
  - Page publique `/` : navigation, WhatsApp, wa.me présents (chrome intact ✓) ;
  - `/admin/login` : **DOM visible = 100 % administratif** — aucun `<footer>`, `<header>`, `<nav>` ni bouton WhatsApp rendu (les seules chaînes « wa.me »/« Actualités » résidaient dans des scripts d'auto-préchargement de lien, jamais rendues) ;
  - URL inconnue publique → 404 avec chrome ; URL inconnue `/admin/*` → redirection/404 administrative sans chrome.

## 6. Non-régression (garanties §5)

- Aucune permission, aucune règle RLS, aucune authentification touchée (0 fichier `lib/auth`, 0 migration) ;
- Toutes les routes admin continuent d'exiger `requireRole()` identiquement ;
- Le site public rend EXACTEMENT les mêmes composants qu'avant (Header/Footer/WhatsApp/pub/collecte), juste depuis son layout dédié.

## 7. Fichiers

Modifiés : `app/layout.tsx`, `app/not-found.tsx`, `components/admin/Sidebar.tsx` · Créés : `app/(public)/layout.tsx`, `app/admin/not-found.tsx` · Déplacés (12 fichiers, git renames) : accueil + 8 segments publics → `app/(public)/`.

**En attente de votre autorisation pour le déploiement Cloudflare et le push GitHub.**
