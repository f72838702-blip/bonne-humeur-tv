# AUDIT — RÉPONSES DIRECTES AUX MESSAGES ET DEMANDES · BONNE HUMEUR TV

**Date : 04/11/2026 · Branche `main` · ÉTAT : AUDIT SEUL — 0 fichier de code modifié, 0 migration préparée, 0 déploiement, 0 push, 0 donnée touchée**

---

## 1. Infrastructure e-mail actuellement disponible : AUCUNE

| Élément audit | Constat |
|---|---|
| `package.json` | **Aucune bibliothèque e-mail** (pas de nodemailer, resend, sendgrid, mailgun, postmark, brevo…) |
| Variables d'environnement (`.env.local` / `.env.example`) | Aucune clé SMTP/Resend/SendGrid/Brevo — uniquement Supabase, SITE_URL, Turnstile, YouTube |
| `supabase/config.toml` | SMTP présent **en commentaire** (réservé à l'auth locale) — `auth.email.smtp` jamais configuré |
| `supabase/functions` | Dossier inexistant — aucune Edge Function |
| Wrangler (`wrangler.jsonc`) | Aucun binding e-mail (pas de `send_email`), pas de domaine personnalisé (uniquement `*.workers.dev`) |
| Formulaires publics (`lib/actions/public-forms.ts`) | `submitPartnership`/`submitContact` **enregistrent en base uniquement** — aucun e-mail n'est envoyé aujourd'hui, ni au visiteur ni à la rédaction |
| Supabase Auth | Envoie bien des e-mails (invitation/réinitialisation) via SON propre expéditeur par défaut — ** inexploitable pour répondre aux visiteurs** (réservé aux utilisateurs auth de la base, contenu non personnalisable par message) |
| Cloudflare Email Routing | Permet seulement de **recevoir/transférer** vers des adresses vérifiées — impossible d'envoyer à des visiteurs arbitraires |
| Contrainte technique Workers | **SMTP brut impossible depuis Cloudflare Workers** (pas de TCP sortant SMTP) → toute solution doit passer par une **API HTTP** (fetch) |

## 2. Ce qui est prêt de notre côté (indépendant du fournisseur)

L'architecture existante répond déjà à toutes les exigences de sécurité de la mission ; seule la couche « transport » manque :

- **Envoi côté serveur** : Server Action `requireRole(["admin"])` (les éditeurs/reporters sont refusés avant toute requête) — le secret du fournisseur vivra dans les variables d'environnement Workers, **jamais dans le navigateur**.
- **Destinataire verrouillé** : lu depuis `partnership_requests.email` / `contact_messages.email` en base — **jamais** pris dans un champ de formulaire modifiable.
- **Historique** : une nouvelle table `request_replies` (migration 0028, à préparer après votre choix) : `id`, `request_type` (partnership/contact), `request_id`, `sender_profile_id`, `body`, `recipient_email`, `provider_message_id`, `status` (`sent`/`failed`), `error`, `created_at` — le message initial n'est **jamais** modifié, historique chronologique par demande.
- **Statuts** : « Répondu » dérivé de l'existence d'une réponse `sent` en base ; « En attente de réponse » = consultation + demande non répondue. Rien ne casse dans les statuts existants `new/processing/treated` ni dans les notifications 0027 (une réponse envoyée **ne crée pas** de nouvelle notification — le marquage vu/lu est déjà en place).
- **Anti double-envoi** : bouton désactivé pendant l'exécution (`pending`) + enregistrement de la réponse par la même action serveur qu'envoi.
- **Anti-injection HTML** : réponse envoyée en **texte brut** au fournisseur (aucun HTML composé depuis l'éditeur).
- **Suppression** : conservée telle quelle (0027) — la suppression d'une demande supprimera sa propre historique via `ON DELETE CASCADE` uniquement, sans toucher aux autres demandes.

## 3. Options d'envoi gratuites (vérifiées le 04/11/2026, chiffres officiels)

### Option A — Répondre avec un lien `mailto:` — 0 USD, aucun compte, disponible immédiatement

Le bouton « Répondre » ouvre le client e-mail de l'administrateur avec l'adresse et l'objet préremplis. Zéro secret, zéro fournisseur, zéro quota, fonctionne dès la première seconde. **Limites** : pas d'historique d'envoi (la réponse passe par votre messagerie, pas par la plateforme), pas de statut « Répondu » fiable, dépend d'un client e-mail configuré sur la machine.

### Option B — Brevo gratuit — 0 USD/mois, **aucun domaine nécessaire** ⭐ si 0 USD strict

- **300 e-mails/jour** (~9 000/mois), API HTTP compatible Workers, envoi à **n'importe quel destinataire** après vérification d'UNE adresse expéditrice (code à 6 chiffres reçu par e-mail — pas de DNS requis).
- **Limites documentées** : logo « Sent with Brevo » conservé ; si l'expéditeur vérifié est une adresse gratuite (Gmail…), Brevo peut **remplacer l'adresse d'envoi** (ex. `…t-sender-sib.com`) → les réponses des visiteurs risquent d'arriver sur une boîte technique au lieu de votre boîte, et la délivrabilité (Gmail/Yahoo/微软 strict depuis 2024-2025) est dégradée sans domaine authentifié.

### Option C — Resend gratuit + un nom de domaine — 0 USD/mois de service, ~10–15 USD **d'achat unique** du domaine

- **3 000 e-mails/mois** (100/jour), API HTTP compatible Workers, **meilleure délivrabilité** : réponses authentifiées SPF/DKIM/DMARC depuis un vrai domaine (ex. `reponse@bonnehumeurtv.com`) → les visiteurs peuvent répondre directement dans votre boîte.
- **Limite** : Resend exige un **domaine vérifié** (3 records DNS) pour écrire à des visiteurs arbitraires — sans domaine, l'adresse de test `onboarding@resend.dev` n'envoie qu'à l'adresse du compte Resend lui-même. Le coût n'est donc pas 0 USD strict (achat ponctuel du domaine), mais **aucun abonnement**.

### Option D — SMTP2GO gratuit — 0 USD/mois

1 000 e-mails/mois, 200/jour, **25/jour par heure** tant qu'aucun domaine n'est vérifié (cap levée avec domaine), API HTTP disponible. Sérieux mais quantité la plus faible des trois — option de repli.

**Écarté** : Gmail SMTP (non professionnel + contre les conditions d'utilisation), Supabase auth (cf. §1), Cloudflare Email Routing (cf. §1), tout service payant (interdit par la mission).

## 4. Recommandation

- **Si 0 USD strict et pas de domaine** : **Brevo gratuit** (option B) — seule voie qui écrit réellement à n'importe quel visiteur depuis le panneau sans rien payer ni acheter. Assumons ses deux limites (marque + délivrabilité).
- **Si le projet peut investir 10–15 USD une fois** : **Resend + domaine** (option C) — c'est la seule solution *professionnelle* de la liste : vraie adresse au nom de la chaîne, réponses des visiteurs reçues dans votre boîte, délivrabilité propre. Aucun abonnement ; le service reste 0 USD/mois.
- **En attendant votre choix** : l'option A (`mailto:`) peut être livrée immédiatement et reste compatible avec une migration vers B ou C ensuite (même interface, même historique, seul le transport change) — mais ne fabrique rien sans votre feu vert.

## 5. Ce qui manque et sera nécessaire après votre accord (aucune action faite aujourd'hui)

1. **Création du compte chez le fournisseur choisi** (par vous — e-mail + mot de passe du PDG ; je n'ai besoin que d'UNE clé API à poser en secret Workers).
2. **Migration 0028** (`request_replies` + RLS admin/éditeur + cascade) — préparée, présentée, appliquée seulement sur votre autorisation.
3. **Implémentation** : panneau de réponse dans `/admin/demandes`, Server Action d'envoi, historique consultable, statut « Répondu », tests (vitest + tsc + ESLint + build), rapport final.
4. **Poser le secret du fournisseur** dans l'environnement Cloudflare (`wrangler secret put`) — jamais dans le dépôt.

**Arrêt volontaire ici, conformément à la mission : aucun nouveau fournisseur ajouté, aucune migration, aucun code, aucun déploiement, aucun push.**

---

*Sources quotas (consultées 04/11/2026) : resend.com/pricing · resend.com/docs (quotas & production approval) · help.brevo.com (limits Free plan, create a new sender) · brevo.com/features/email-api · smtp2go.com/pricing.*