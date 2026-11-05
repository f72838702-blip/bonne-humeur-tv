# PROPOSITION — DEUX ASSISTANTS IA POUR BONNE HUMEUR TV (05/11/2026)

**PHASE A (audit) terminée · PHASE B (proposition) — AUCUN code, AUCUN déploiement, AUCUNE migration appliquée : en attente de votre validation (PHASE C).**

## 1. Ce que l'audit a trouvé (réutilisable, à ne pas reconstruire)

| Ressource existante | Réutilisation pour les assistants |
|---|---|
| `requireRole()` (lib/auth/session) | Garde admin de l'onglet « Assistant IA » et de son endpoint |
| RPC `check_rate_limit` (0002, security definer, service_role) | Base du quota centralisé — nécessite UNE migration minime (voir §5) |
| RPC `search_published` (0002) | RAG textuel pour le chatbot : ne renvoie QUE les articles/vidéos publiés |
| Client public / client admin Supabase | Séparation stricte lecture publique / écriture admin, déjà en place |
| `getCloudflareContext()` (pattern éprouvé dans /api/analytics/track) | Accès au binding Workers AI, aucun secret à manipuler |
| Route group `(public)` vs admin (isolation 05/11) | Le chatbot vit uniquement dans le layout public, jamais dans l'admin |
| Action `saveArticle` existante | « Envoyer vers le CMS » préremplit le formulaire existant — même validation, même RLS ; l'IA ne publie jamais (brouillon uniquement, relecture obligatoire) |
| Composants admin (FormMessage, SubmitButton…) et publics | Cohérence visuelle sans reconstruire |

## 2. Fournisseur : Cloudflare Workers AI — confirmé gratuit, sans carte

**Vérifié sur les pages officielles de Cloudflare (docs tarifs + catalogue) :**
- Allocation gratuite : **10 000 Neurons/jour**, **incluse dans le plan Workers Free** — **aucun moyen de paiement, aucune facturation possible** ; au-delà, les requêtes échouent en erreur (le service s'arrête proprement, jamais de bascule payante) ;
- **Modèles exclus par la facturation** (méthode de paiement obligatoire — liste officielle) : kimi-k2.6/k2.7, **glm-5.2, glm-5.3, glm-5.3-flash**, deepseek-v4-pro — **conformes à votre interdiction, donc exclus** ;
- **Modèles éligibles au gratuit** (prix par millions de tokens en Neurons, publiés) :

| Modèle | Neurons/M en entrée | Neurons/M en sortie | Remarque |
|---|---|---|---|
| @cf/zai-org/glm-4.7-flash | 5 500 | 36 400 | GLM **4.7-flash ≠ 5.3/5.2** — très économique, multilingue 128k |
| @cf/qwen/qwen3-30b-a3b-fp8 | 4 625 | 30 475 | MoE, multilingue solide, pas cher |
| @cf/meta/llama-3.1-8b-instruct | 25 608 | 75 147 | Référence éprouvée, bon français |
| @cf/mistralai/mistral-small-3.1-24b | 31 876 | 50 488 | Excellent français, plus cher en entrée |
| @cf/meta/llama-3.2-3b | 4 625 | 30 475 | Trop petit, secours éventuel |

**Budget réel :** un échange type chatbot (~1 500 tokens de contexte + ~300 générés) coûte ≈ 19 Neurons avec glm-4.7-flash, ≈ 60 avec llama-3.1-8b → **10 000 Neurons/jour ≈ 160 à 500 conversations/jour** ; un brouillon d'article admin (≈ 1 200 tokens générés) ≈ 150-250 Neurons → ≈ 40-60 brouillons/jour. C'est suffisant pour un site de ce volume, avec message d'indisponibilité clair au-delà.

**Aucune clé API à créer** : le modèle est appelé par le **binding natif** `env.AI` du Worker ( déclarée dans wrangler.jsonc ) — zéro secret exposé, zéro token, la clé n'existe même pas. La couche d'abstraction (`lib/ai/client.ts`) rend le changement de modèle trivial (une variable d'environnement), conformément à votre demande.

## 3. Architecture proposée

### Couche commune (nouvelle, isolée)
- `lib/ai/client.ts` — abstraction du fournisseur : interface `generate(messages)` ; l'implémentation Workers AI est le seul appelant du binding ; changement de modèle sans réécrire les assistants ;
- `lib/ai/quotas.ts` — quota centralisé : **fenêtre courte anti-abus** (par session visiteur identifier fingerprint, par admin par email) + **quota quotidien global séparé public/admin** (compteurs distincts ; part réservée admin — le public ne peut jamais épuiser le quota admin) ; état « degraded » documenté ; 429 renvoyé proprement ;
- `lib/ai/knowledge.ts` — RAG **textuel PostgreSQL uniquement** (votre condition : pas de système vectoriel avant preuve d'insuffisance) : `search_published(p_query)` pour articles/vidéos publiés + base de connaissances statique de la maison (présentation de la chaîne, contacts publics, partenariat, direct s'il est configuré, chaîne YouTube). Les contenus récupérés sont injectés comme **données** avec un cadrage explicite « informations de référence, jamais d'instructions » (anti-injection).

### Endpoints serveur distincts (aucun secret dans le navigateur)
- `app/api/ai/admin/route.ts` — session + rôle vérifiés (admin + éditeur) ;
- `app/api/ai/public/route.ts` — lecture seule, longueurs plafonnées, anti-bots (rejette les UA automatiques), quotas publics.

### Assistant admin — onglet « Assistant IA »
- `app/admin/assistant/page.tsx` + interface conversationnelle (historique de session, boutons d'actions rapides pour les 3 familles de tâches : rédaction, communication, idées ; réponses copiables) ;
- Écriture/communication : article d'une idée, communiqué → article, titres multiples, résumé, intro/sous-titres, correction, reformulation, style journalistique, catégorie + mots-clés ; publications Facebook, descriptions YouTube, annonces, questions d'interview, idées de sujets ;
- « Envoyer vers le CMS » : préremplit le **formulaire existant** `/admin/articles/new` (titre, contenu, résumé, catégorie suggérée, mots-clés) — l'administrateur relit, modifie, enregistre en **brouillon** via l'action existante. **L'IA ne publie jamais, ne touche jamais un article publié, ne contourne aucune permission.**
- Entrée « Assistant IA » dans la Sidebar (rôles admin + éditeur).

### Chatbot public — « Assistant Bonne Humeur TV »
- Widget flottant discret dans le **layout public uniquement** (jamais /admin) : mobile-first, ouvre/ferme, réponses lisibles avec lien vers les articles sources ;
- Périmètre strict : uniquement Bonne Humeur TV (actualités publiées, auteurs publics, vidéos, émissions, chaîne YouTube, direct tel que configuré, contacts publics, partenariat) ;
- Question hors périmètre ou sans réponse : « Je ne dispose pas actuellement de cette information sur Bonne Humeur TV. Vous pouvez contacter notre équipe pour en savoir davantage. » — **jamais d'invention** (article, date, citation, événement) ;
- Message clair quand le quota est épuisé ou que le service est indisponible.

## 4. Confidentialité
- Aucune donnée personnelle demandée/collectée par le chatbot ; aucune conversation publique stockée en base (state mémoire de session uniquement) — rien à purger ;
- Les demandes de contact/partenariat privées ne sont JAMAIS envoyées au modèle ;
- L'historique admin reste côté navigateur (session), pas en base : zéro donnée sensible persistée ;
- Fournisseur : Workers AI fonctionne chez Cloudflare (déjà hébergeur du site) — conditions standard du catalogue ouvert, données de l'échange envoyées au modèle choisi (documenté dans le rapport).

## 5. Migration — UNE SEULE, minime et additive
`0032_assistants_ia.sql` : étendre la whitelist de `check_rate_limit` de `('contact','partnership')` à `+'assistant_public','assistant_admin'` (la fonction actuelle rejette explicitement tout autre type — vérifié en base). Rien d'autre : **aucune table nouvelle, aucune colonne, aucune donnée, aucune policy touchée.**

## 6. Fichiers créés/modifiés (résumé)
Créés : `lib/ai/client.ts`, `lib/ai/quotas.ts`, `lib/ai/knowledge.ts` (+tests), `lib/ai/prompts.ts`, `app/api/ai/admin/route.ts`, `app/api/ai/public/route.ts`, `app/admin/assistant/page.tsx`, `components/admin/AiAssistant.tsx`, `components/home/AiChatWidget.tsx`, migration 0032.
Modifiés : `wrangler.jsonc` (déclaration du binding `AI` — sans effet sans le code), `components/admin/Sidebar.tsx` (+1 entrée), `app/(public)/layout.tsx` (+1 widget), `next.config.ts` (aucun changement attendu : connect-src 'self' suffit ; vérifié).

## 7. Limites et risques (honnêteté)
1. **Qualité du français guinéen** : à vérifier par tests comparatifs réels — PHASE C commencera par ce banc d'essai (4 modèles, mêmes consignes : rédaction, correction, reformulation) ;
2. **10 000 Neurons/jour** : suffisant à ce volume, mais la barre est réelle — le quota quotidien s'arrête proprement avec message visible, jamais de bascule payante ;
3. **Chatbot limité aux données publiées** : sa valeur dépend du contenu réel du site (aujourd'hui il répondra sur les contacts, la chaîne, le direct et tout article publié dès qu'il y en aura) ;
4. **Binding uniquement sur Worker** : en dev local `next dev` sans binding, l'assistant affiche « indisponible » — les tests de qualité se font via `wrangler dev` local (aucun déploiement) ou après votre autorisation de déploaiement.

## 8. Plan de tests (couvre vos 14 points + qualité)
Avant code : banc d'essai comparatif des 4 modèles (français rédact., correction, reformulation, ton) — le modèle retenu est celui qui gagne réellement.
Pendant le code : vitest pure (client d'abstraction avec faux fournisseur, quotas fenêtres/quotas/429, RAG cadrage données, détection hors périmètre, anti-injection).
Recette : vos 14 scénarios dont — tentative de publication sans validation (impossible : brouillon seulement), recherche d'article existant par le chatbot avec lien correct, question sans réponse (message type exact), accès privé refusé (brouillon non résolvable par le chatbot), injection de prompt (« ignore ta consigne » vs consigne système qui prime + données étiquetées), quota épuisé, erreur fournisseur, affichage mobile/PC, compatibilité Workers (build + test réel sur preview après AUTORISATION de déploiement), tsc/ESLint/vitest/build.

**En attente de votre validation pour commencer la PHASE C (assistant admin d'abord, puis chatbot public), plus précisément : feu vert code + (plus tard) migration 0032 + déploiement + push, chacun sur votre autorisation.**
