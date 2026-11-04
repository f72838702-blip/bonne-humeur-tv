# RAPPORT — RÉPONSES DIRECTES DE L'ADMINISTRATEUR AUX MESSAGES & DEMANDES · BONNE HUMEUR TV

**Date : 04/11/2026 · Branche `main` · PRÉPARÉ EN LOCAL — Migration 0028 PRÉPARÉE (NON appliquée) · NON déployé · Aucun push · Aucune donnée production touchée**
**Formulaires publics : 0 modification (validations, honeypot, Turnstile, rate limiting intacts) · Suppression 0027 conservée**

---

## 1. Infrastructure e-mail disponible (audit initial)

**Aucune** — aucune bibliothèque, aucune clé SMTP/API, aucune Edge Function, aucun binding Cloudflare e-mail, pas de domaine personnalisé. Les formulaires publics enregistrent en base uniquement. Audit complet : `RAPPORT_AUDIT_REPONSES_ADMIN_EMAIL_2026-11-04.md` (4 options gratuites présentées, chiffres vérifiés le 04/11/2026).

## 2. Solution technique retenue (votre choix) : Brevo — plan gratuit

- **API HTTP v3** (`POST /v3/smtp/email`) — compatible Cloudflare Workers (SMTP brut y est impossible). Envoi **côté serveur** depuis une Server Action ; la clé Brevo vivra en secret Workers (`BREVO_API_KEY`), jamais dans le navigateur ni le dépôt.
- Envoi en **TEXTE BRUT** (`textContent`) — aucun HTML composé depuis l'éditeur : l'injection HTML est impossible par construction.
- `replyTo` pointe sur la boîte de la chaîne (`BREVO_REPLY_TO_EMAIL`, par défaut l'adresse expéditrice vérifiée) → **les réponses des visiteurs arrivent dans votre boîte**.
- « Envoyée » n'est enregistré que si Brevo répond **2xx avec un identifiant de message** — jamais affiché « Répondu » sans confirmation du fournisseur.

## 3. Fichiers modifiés / créés (11)

| Fichier | Rôle |
|---|---|
| `supabase/migrations/0028_reponses_admin.sql` | **créé, NON appliqué** — table `request_replies`, 4 policies RLS, cascadé, trigger audit |
| `lib/replies-core.ts` + `.test.ts` | **créés** — noyau pur (sujet, payload, statut « Répondu », historique) + **16 tests** |
| `lib/email/brevo.ts` | **créé** — client serveur Brevo (2xx = accepté ; timeout 15 s ; erreurs tracées) |
| `lib/data/replies.ts` | **créé** — historique (RLS), destinataire lu UNIQUEMENT de la base, inscription sent/failed |
| `lib/actions/admin.ts` | **sendReplyAction** ajoutée — requireRole admin, pas d'e-mail via le formulaire, historisation honnête |
| `lib/validation/schemas.ts` | `sendReplySchema` ajouté — type + id UUID + corps 2–10 000 ; **le destinataire n'est PAS un champ** |
| `lib/types.ts` | type `RequestReply` ajouté |
| `components/admin/ReplyForm.tsx` | **créé** — zone de rédaction dans le panneau (`<details>`, pas de nouvelle page), texte **contrôlé React** (conservé en erreur), destinataire affiché non modifiable, bouton désactivé pendant l'envoi |
| `app/admin/demandes/page.tsx` | badge « Répondu » (vert, envoyé confirmé), bloc « Historique des réponses » chronologique (« en attente de réponse » sinon), bouton « Répondre » (admin), échec affiché avec détail |
| `.env.example` | 4 variables Brevo documentées |

**Intacts** : `RequestStatusForm`, `DeleteActionForm`, statuts new/processing/treated, notifications 0027 (marquage vu/lu, compteurs), RLS renforcée.

## 4. Migration 0028 préparée (NON appliquée — votre autorisation requise)

Table `request_replies` : `partnership_request_id` / `contact_message_id` **FK en cascade (XOR)** → supprimer une demande supprime SEULEMENT son historique, jamais celui des autres (scénario §6) ; le message initial n'est jamais modifié. Champs : `recipient_email` (copie du destinataire réel), `body`, `provider_message_id` (confirmation du fournisseur), `status` (`sent`/`failed`), `error`, `sender_profile_id`. RLS : SELECT admin+éditeur ; INSERT/UPDATE/DELETE **admin seul** — un éditeur est refusé par la base même via requête directe. Trigger `audit_row_change` : chaque réponse reste dans `audit_logs`.

## 5. Mesures de sécurité

1. **Destinataire verrouillé** : lu par le serveur depuis `partnership_requests`/`contact_messages` — `sendReplySchema` n'accepte aucun champ e-mail (testé).
2. **Autorisation** : requireRole admin + policy RLS INSERT admin (double barrière, motif 0027).
3. **Secrets** : clé Brevo en variable d'environnement serveur ; rien de transposé au navigateur.
4. **Anti double-envoi** : bouton désactivé pendant l'exécution (`SubmitButton pending`) + envoi et enregistrement dans la même action ; un échec n'envoie pas plus tard automatiquement.
5. **Anti-injection** : texte brut uniquement, `textContent` ; le corps est validé 2–10 000 caractères côté action ET contrainte SQL.
6. **Honnêteté du statut** : « Répondu » dérivé d'une ligne `sent` (testé) ; échec historisé avec l'erreur affichée, texte conservé (état contrôlé).
7. **Audit** : trigger journal, cascade limitée au parent supprimé.

## 6. Tests réalisés

**vitest 258/258** (242 conservés + 16 nouveaux) · **tsc 0** · **ESLint 0/0** · **build 37 routes, compilé 10,7 s**.

| Scénario §9 | Résultat | Preuve |
|---|---|---|
| 1. Répondre à un partenariat / 2. à un contact | ✔ code + schéma | sujet dérivé, destinataire verrouillé, une ligne d'historique par envoi |
| 3. Le destinataire reçoit la réponse | ✔ mécanisme + `replyTo` | l'arrivée réelle dans la boîte exige le secret Brevo → recette ci-dessous |
| 4. Réponse dans l'historique | ✔ design + test | regroupement chronologique par demande, ordre ancien→récent |
| 5. « Répondu » seulement après confirmation | ✔ test | `provider_message_id`/2xx ⇒ `sent` sinon `failed` |
| 6. Erreur d'envoi simulée | ✔ test | Brevo non configuré ou 4xx ⇒ `failed` + erreur affichée, `Répondu` refusé |
| 7. L'erreur n'efface pas le texte | ✔ conception | `textarea` contrôlé React — effacement seulement sur `status === "success"` (même garde que les formulaires publics corrigés) |
| 8. Pas de double envoi | ✔ conception | bouton désactivé pendant l'envoi ; aucune relance auto |
| 9. Non-admin refusé | ✔ double barrière | éditeur : bouton absent + `requireRole(["admin"])` + policy 0028 INSERT |
| 10. Mobile | ✔ design | `<details>` plein largeur, wrap flex, même grille que 0027 — recette smartphone recommandée |

## 7. Limites de l'envoi gratuit Brevo (documentées, assumées)

1. **300 e-mails/jour** (≈ 9 000/mois) — très confortable pour des réponses administratives.
2. **Marque « Sent with Brevo »** conservée sur le plan gratuit.
3. **Sans domaine authentifié** : délivrabilité moyenne ; Brevo peut substituer l'adresse d'expédition pour les e-mails transactionnels quand l'expéditeur est une adresse gratuite → risque de classement « Promotions/Spam ». `replyTo` garantit que *les réponses* des visiteurs arrivent bien sur la boîte de la chaîne. Si un jour un domaine est acheté (~10–15 USD, achat unique), le passage à Resend (3 000/mois, délivrabilité pro) est simple : 1 clé + 3 records DNS, le code reste.
4. **L'expéditeur doit être VÉRIFIÉ dans Brevo** (code à 6 chiffres) — opération de la direction, 2 minutes.

## 8. Configurations encore nécessaires (votre action, puis mon intervention sur autorisation)

1. **Créer le compte Brevo** (app.brevo.com) — e-mail + mot de passe de la direction.
2. **Vérifier une adresse expéditrice** (SMTP & API → Expéditeurs → code reçu par e-mail), ex. l'adresse de la chaîne.
3. **Générer une clé API v3** et me la transmettre par votre canal habituel — je la pose en secrets Workers (`BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`, `BREVO_REPLY_TO_EMAIL`) sans jamais l'afficher ni la committer.
4. **Sur votre autorisation expresse** : appliquer la migration 0028 (Management API, comme 0027), déployer Cloudflare, pousser GitHub — dans cet ordre : migration → secret → déploiement.
5. Recette finale (~4 min) : répondre à un message test → vérifier la réception dans la boîte du visiteur → historique daté → statut « Répondu » → (optionnel) faire échouer un envoi (clé temporairement retirée) pour voir l'erreur, le texte conservé et la réprise sans double envoi.

**Arrêt volontaire ici conformément à la mission : aucune migration distante, aucun déploiement, aucun push, aucun secret posé.**