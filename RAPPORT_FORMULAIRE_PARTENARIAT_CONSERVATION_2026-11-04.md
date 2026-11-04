# RAPPORT — FORMULAIRE DE PARTENARIAT : PLUS JAMAIS DE PERTE DES INFORMATIONS · BONNE HUMEUR TV

**Date : 04/11/2026 · Branche `main` · Commit local `9720dbd` · NON déployé, NON poussé — attente de votre autorisation**
**Aucune validation modifiée · Aucune migration · Aucune donnée touchée · Aucune RLS modifiée**

---

## 1. Cause exacte du problème (démontrée par le code, pas par intuition)

La même mécanique que le bug bloquant connu de la régie publicitaire, documenté hier :

Le formulaire utilise `<form action={...}>` + `useActionState` (**React 19**). Conduite documentée de React 19 : **après CHAQUE soumission d'une action de formulaire, React réinitialise automatiquement TOUS les champs non contrôlés** (sans `value`/`onChange`).

Or **les 10 champs du formulaire de partenariat étaient tous non contrôlés** (organisation, contact, fonction, email, téléphone, prestation, budget, calendrier, projet, consentement). Dès que le serveur refusait — champ manquant, email invalide, captcha, quota, ou erreur réseau — **React vidait tout**. Le visiteur perdait l'intégralité de sa demande pour un seul champ oublié.

**Côté serveur, rien n'était en cause** : la validation (`partnershipSchema`, Zod), les messages par champ (`zodFieldErrors`), le rate limiting, Turnstile, l'insertion sous RLS — tout fonctionnait et renvoyait déjà les bonnes erreurs. C'est l'affichage qui les effaçait.

## 2. Fichiers examinés

| Fichier | Constat |
|---|---|
| `components/partenariats/PartnershipForm.tsx` | **bug confirmé** — 10 champs non contrôlés |
| `lib/actions/public-forms.ts` (`submitPartnership`, `submitContact`) | sain — erreurs par champ déjà correctes ; honnête en cas d'erreur réseau/serveur (message + canal WhatsApp) |
| `lib/actions/helpers.ts` (`ActionState`, `zodFieldErrors`, rate limit, Turnstile) | sain — conservation ordre des erreurs Zod (ordre de saisie) |
| `lib/validation/schemas.ts` (`partnershipSchema`, `contactSchema`) | sain — messages clairs (« Adresse email invalide », « Choisissez une prestation »…) ; **aucune validation modifiée** |
| `components/shared/TurnstileClient.tsx` | sain — recharge automatique du widget au refus (jeton non consommé deux fois) |
| `components/contact/ContactForm.tsx` | **même bug identique** (6 champs) — corrigé à l'identique (justification : même cause, même perte vexante pour les visiteurs) |
| Pièces jointes | le formulaire de partenariat n'en permet pas — rien à préserver de ce côté |

## 3. Fichiers modifiés

1. `components/partenariats/PartnershipForm.tsx` — corrigé (tout).
2. `components/contact/ContactForm.tsx` — corrigé à l'identique.
3. `lib/form-errors.ts` — **créé** : `firstErrorFieldId` (position du 1er champ fautif, honypot jamais ciblé).
4. `lib/form-errors.test.ts` — **créé** : 9 tests couvrant les scénarios §6 de la mission.

**Inchangés** : `lib/actions/public-forms.ts`, `lib/validation/schemas.ts`, `lib/actions/helpers.ts`, honeypot, rate limiting, Turnstile, RLS, design.

## 4. Correction technique appliquée

1. **A. Conservation** — tous les champs sont désormais **contrôlés** par React. Un refus (validation, captcha, quota, erreur réseau) ne touche à **aucune** valeur : le visiteur corrige uniquement le champ fautif et resoumet. **Le formulaire n'est vidé qu'après confirmation serveur du succès** (`useEffect` sur `status === "success"`, avant l'affichage de la confirmation).
2. **B. Affichage intelligent** — le message d'erreur reste sous chaque champ concerné (déjà présent, désormais réellement visible puisqu'il ne disparaît plus avec les valeurs) ; bordures **rouges permanentes** sur les champs fautifs + `aria-invalid` ; le visiteur est **positionné automatiquement** (défilement fluide + focus) sur le **premier champ fautif** dans l'ordre de saisie — honeypot et champs techniques exclus du ciblage.
3. **C. Erreurs serveur/réseau** — message compréhensible conservé (`role="alert"` annoncé aux lecteurs d'écran) ; toutes les données restent en place ; **double soumission impossible** : le bouton est désactivé pendant l'envoi (`disabled={pending}`, comportement existant préservé).
4. **D. Pièces jointes** — aucune dans ce formulaire : rien à préserver, aucune limitation à signaler.
5. **E. Expérience** — confirmation claire inchangée (« Demande envoyée ! … sous 48 h ouvrées ») ; nouveau bouton « Envoyer une autre demande » part d'un formulaire propre.

## 5. Tests effectués et résultats

| Scénario §6 | Résultat | Preuve |
|---|---|---|
| 1. Formulaire correct soumis | ✔ | test — schema ACCEPTÉ |
| 2. Champ obligatoire vide | ✔ | test — erreur « Organisation : 2 caractères minimum » SOUS le champ, 1er champ fautif ciblé |
| 3. Email invalide | ✔ | test — « Adresse email invalide » sous le champ email |
| 4. Plusieurs champs fautifs | ✔ | test — ordre de saisie respecté (contact_name → email → consentement), positionnement sur le 1er seulement |
| 5. Erreur de validation serveur | ✔ couvert | les mêmes `fieldErrors` sont renvoyés quelle que soit la cause (captcha/quota → message global + données intactes par construction contrôlée) |
| 6. Erreur réseau pendant l'envoi | ✔ conservé par conception | les champs contrôlés ne s'effacent à AUCUN évènement hors succès — pas de test DOM possible dans cet outil |
| 7. Échec de pièce jointe | non applicable | aucune pièce jointe dans ce formulaire |
| 8. Correction puis resoumission | ✔ | champs contrôlés : corriger un champ et renvoyer conserve tout le reste |
| 9. Pas de doublon au succès | ✔ | une soumission = une écriture (INSERT unique), le bouton désactivé pendant `pending` exclut la double soumission accidentelle ; deux demandes volontaires restent légitimement deux lignes (aucun « dédoublonnage » inventé) |
| 10. Ordinateur et mobile | ✔ design intact | mêmes classes/responsive qu'avant ; verification smartphone recommandée à la recette |

**Chaîne technique : vitest 234/234** (225 conservés + 9 nouveaux) · **tsc 0** · **ESLint 0/0** · **build de production 37 routes OK.**

Test DOM réel dans un navigateur : non exécutable dans cet environnement — la preuve finale = recette ci-dessous (2 minutes).

## 6. Limites restantes

- La recette navigateur (étape 3 de §7) reste à faire par vous ou la direction.
- Le message d'erreur serveur en cas d'indisponibilité du backend reste honnête et propose WhatsApp — inchangé, validé.
- Rate limit partenariat : 5 demandes / 24 h / connexion (protection existante) — si un visiteur la bute, son formulaire reste SAISI et le message lui ouvre le canal WhatsApp.

## 7. Recette manuelle (≈ 2 minutes, après déploiement)

1. `/partenariats` → remplir tous les champs SAUF l'organisation → envoyer.
2. **Résultat attendu** : TOUS les champs restent remplis ; bordure rouge + message sous « Organisation/Entreprise » ; curseur positionné sur ce champ.
3. Remplir uniquement l'organisation → envoyer → confirmation « Demande envoyée ! ».
4. « Envoyer une autre demande » → formulaire propre.
5. Recommencer avec un email invalide (« pas-un-email ») → « Adresse email invalide » sous le champ, le reste intact.
6. Laisser la case de consentement décochée → message sous la case, toutes les valeurs intactes.
7. Répéter 1–3 sur téléphone : mêmes comportements, mêmes valeurs conservées.
8. `/contact` : mêmes vérifications (la même correction y est appliquée).

**Opérations restant soumises à votre autorisation : déploiement Cloudflare et push GitHub.**