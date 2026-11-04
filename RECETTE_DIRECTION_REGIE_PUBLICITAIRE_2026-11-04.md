# RECETTE — RÉGIE PUBLICITAIRE ULTRA SIMPLE (pour la direction)

**Site : https://bonne-humeur-tv-preview.bonne-humeur-tv.workers.dev · Version en ligne : `39b47d1d` (régie ultra simple, déployée le 04/11/2026)**
**Durée totale : 15 à 25 minutes · Aucune compétence technique requise · Coût de chaque test : 0 USD**

Ce document décrit les tests que la direction doit faire, un par un, en cochant
la case « ✔ » quand tout se passe bien. En cas de problème : noter le numéro
de l'étape et ce qui s'est affiché, puis le transmettre à Claude — chaque
problème est corrigible et la version d'avant reste disponible en 1 minute
(roulage arrière automatique).

---

## 0. Préparation (2 min)

- [ ] Ouvrir https://bonne-humeur-tv-preview.bonne-humeur-tv.workers.dev/admin/login
- [ ] Se connecter avec le compte administrateur
- [ ] Dans le menu de gauche, cliquer **« Publicités »**

**À voir immédiatement** : un GROS bouton rouge **« + Créer une publicité »**,
plus 3 chiffres en haut — *Publicités en cours · Publicités programmées ·
Publicités terminées* — puis les publicités groupées (aujourd'hui il n'y en a
aucune : le message « Aucune publicité pour l'instant » est NORMAL).

- [ ] ✔ La page est simple, sans tables ni termes techniques

---

## 1. CRÉER UNE BANNIÈRE (le test principal — 5 min)

1. Cliquer **« + Créer une publicité »**
2. **Étape 1 — Que veux-tu publier ?** → cliquer la carte **« Bannière publicitaire »** (elle se surligne en rouge)
3. **Étape 2 — Ajouter la publicité** :
   - « Entreprise ou annonceur » → cliquer **« Une nouvelle entreprise »**, taper par ex. **« Boutique Test »** comme nom (le téléphone est facultatif)
   - « Ajouter une image » → choisir une image horizontale (paysage, bannière) depuis l'appareil — attendre la mention **« Image ajoutée ✔ »**
   - Renseigner « Texte alternatif » (ex. « Boutique Test — vêtements pour tous »)
4. **Étape 3 — Où et combien de temps ?** :
   - les emplacements compatibles sont déjà précochés (laisser tout)
   - durée : laisser **« 7 jours »** (déjà sélectionné)
5. **Étape 4 — Vérifiez, puis publiez** : regarder l'APERÇU (l'image, le bouton) — puis cliquer le gros bouton rouge **« PUBLIER MA PUBLICITÉ »**

**Résultat attendu** : message vert de confirmation, retour sur « Publicités »,
la carte **« Boutique Test · Bannière publicitaire »** apparaît dans le groupe
**« En diffusion »** avec son image, son annonceur, sa date de fin et le badge
**« En diffusion »**.

- [ ] ✔ Création terminée sans blocage ni message d'erreur
- [ ] ✔ La publicité est visible dans « En diffusion »
- [ ] ✔ L'aperçu avant publication ressemble à la publicité réelle

### Vérification PUBLIQUE (1 min plus tard)

- [ ] Ouvrir https://bonne-humeur-tv-preview.bonne-humeur-tv.workers.dev (dans un autre onglet)
- [ ] ✔ La bannière s'affiche EN HAUT de la page d'accueil (délai maximal : 2 minutes de cache)
- [ ] ✔ Cliquer la bannière → ouvre le lien choisi (ou rien si aucun lien n'a été saisi)

---

## 2. LES AUTRES FORMATS (10 min — un test par carte)

Répéter le même parcours « + Créer une publicité » pour chaque format. Les
étapes changent légèrement ; voici quoi vérifier pour chacun :

| Format | Ce qu'on saisit | Ce qu'on doit voir à la fin |
|---|---|---|
| **Carte publicitaire** | titre, description, image | la carte apparaît dans « En diffusion » ; côté public : une carte avec image + texte dans la page et dans les listes d'actualités |
| **Vidéo YouTube** *(nouvellement disponible)* | coller un lien YouTube (ex. une vidéo de la chaîne), un titre | l'APERÇU montre la vignette de la vidéo ; côté public : la carte vidéo dans la rubrique vidéos / accueil |
| **Bandeau promotionnel** | un message court + choisir une couleur de fond | l'APERÇU montre un bandeau coloré avec le message ; côté public : bandeau en haut de l'accueil |
| **Article sponsorisé** | choisir un article publié dans la liste déroulante | l'APERÇU montre la mention « Sponsorisé » + le nom de l'entreprise ; côté public : l'article apparaît dans les listes avec le badge « Sponsorisé » |
| **Logo partenaire** | logo de l'entreprise (le nom affiché = celui de l'entreprise choisie) | côté public : le logo s'affiche dans l'espace partenaires de l'accueil |

- [ ] ✔ Carte publicitaire : créée ET visible côté public
- [ ] ✔ Vidéo YouTube : l'aperçu montre la vignette, puis créée ET visible
- [ ] ✔ Bandeau promotionnel : couleur visible côté public
- [ ] ✔ Article sponsorisé : badge « Sponsorisé » visible
- [ ] ✔ Logo partenaire : dans l'espace partenaires

### Tests d'ERREUR volontaires (2 min — tout doit rester propre)

- [ ] Cliquer « Publier ma publicité » SANS remplir le champ obligatoire → message rouge clair sous le champ exact, **rien ne se casse**
- [ ] Coller un lien YouTube faux (ex. « https://erreur ») → message clair, publication impossible
- [ ] Aucune donnée endommagée après ces tentatives (la liste reste intacte)

---

## 3. GÉRER UNE PUBLICITÉ (5 min)

Sur la page « Publicités », chaque carte a des boutons à droite :

| Action | À faire | Ce qui doit se produire |
|---|---|---|
| **Suspendre** | cliquer sur la bannière « Boutique Test » | elle quitte « En diffusion », badge « Suspendue », **elle disparaît du site public** (≤ 2 min) |
| **Réactiver** | cliquer « Réactiver » | badge « En diffusion », **elle revient sur le site public** |
| **Prolonger** | choisir « 7 jours » dans « Prolonger » | la date de fin recule de 7 jours, la diffusion continue sans interruption |
| **Modifier** | cliquer « Modifier » | page détaillée classique (gestion avancée) — vérifier que le contenu est bien celui saisi |
| **Supprimer** | (admin seulement) cliquer « Supprimer » | une CONFIRMATION est demandée ; seulement si confirmé, disparaît définitivement |

- [ ] ✔ Suspendre → disparaît du site public
- [ ] ✔ Réactiver → revient sur le site public
- [ ] ✔ Prolonger → date de fin reculée, diffusion continue
- [ ] ✔ Supprimer → confirmation demandée, suppression propre

### Publicité PROGRAMMÉE (optionnel, 2 min)

- [ ] Créer une publicité avec « Commencer plus tard » = demain → badge **« Programmée »**, elle N'est PAS sur le site public maintenant, et apparaîtra seule à la date choisie

---

## 4. Rôle ÉDITEUR (si un compte rédacteur existe — optionnel)

- [ ] Se connecter en tant qu'éditeur → « Publicités » est accessible, la zone « Gestion avancée » est **absente** (réservée aux administrateurs)
- [ ] Un éditeur peut créer une publicité ; la carte affiche alors au public **« À valider par un administrateur »** jusqu'à ce qu'un administrateur approuve son visuel

---

## 5. Ce qu'on ne teste PAS (et pourquoi)

- Les statistiques et impressions : elles existent dans « Gestion avancée » (admin) mais restent **indicatives, jamais une audience certifiée**.
- Les règlements et contrats : zone admin avancée, inchangée, hors recette.
- Le site public lui-même : seule la régie publicitaire est concernée.

---

## 6. Grille de résumé à retourner à Claude

Pour chaque ligne : ✔ (tout OK) ou ✘ + numéro d'étape + message affiché.

| Scénario | Résultat |
|---|---|
| Page « Publicités » simple, 3 compteurs, gros bouton |  |
| Bannière créée de bout en bout, visible sur l'accueil |  |
| Carte publicitaire visible |  |
| Vidéo YouTube (aperçu vignette + affichage) |  |
| Bandeau promotionnel (couleur) |  |
| Article sponsorisé (mention Sponsorisé) |  |
| Logo partenaire (espace partenaires) |  |
| Suspendre / Réactiver (disparaît puis revient) |  |
| Prolonger (date de fin reculée) |  |
| Supprimer (avec confirmation) |  |
| Publicité programmée (apparait seule à la date) |  |
| Messages d'erreur clairs quand il manque une info |  |

**Si tout est ✔** : la régie est officiellement terminée et remise à la
direction — on clôt la campagne « invisible » du jour.
**Si un ✘** : noter exactement ce qui s'est passé à l'étape indiquée ; le
correctif partira de là — et la production peut revenir à l'état précédent
en 1 minute si besoin.