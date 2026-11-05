# RAPPORT — MISSION ASSISTANTS IA (Phase C : implémentation)
**Bonne Humeur TV — 05/11/2026**

---

## 1. RÉSULTAT : les deux assistants sont CODÉS, TESTÉS et COMPILÉS

| Élément | État |
|---|---|
| Assistant IA privé admin (rédaction) | ✅ Codé — `/admin/assistant` + endpoint `/api/ai/admin` |
| Chatbot public « Assistant Bonne Humeur TV » | ✅ Codé — bouton flottant site + endpoint `/api/ai/public` |
| Migration 0032 (quotas en base) | ✅ Écrite — **NON APPLIQUÉE** (attend votre autorisation) |
| Tests vitest | ✅ 321/321 (dont 24 nouveaux pour le module IA) |
| TypeScript `tsc --noEmit` | ✅ 0 erreur |
| ESLint | ✅ 0 avertissement |
| `next build` | ✅ Succès — 3 nouvelles routes (`/admin/assistant`, `/api/ai/admin`, `/api/ai/public`) |
| `opennextjs-cloudflare build` | ✅ Worker généré |
| Déploiement / push / écriture base | ❌ AUCUN — en attente de vos autorisations explicites |

---

## 2. Modèle IA choisi — preuves réelles (zéro dollar)

Avant d'écrire, j'ai fait un **banc d'essai réel** (Worker local hors dépôt, appels authentiques à Workers AI, 4 épreuves : rédaction article Conakry, correction, reformulation, contexte rentrée) :

| Modèle | Verdict | Coût mesuré |
|---|---|---|
| **`@cf/qwen/qwen3-30b-a3b-fp8`** | ✅ **RETENU par défaut** — excellent français, rapide (2-6 s) | ≈ 12 Neurons/échange |
| `@cf/mistralai/mistral-small-3.1-24b-instruct` | ✅ Repli configuré (excellent, rapide) | ≈ 48 Neurons/échange |
| glm-4.7-flash, gpt-oss-20b | ❌ Écartés — modèles à « raisonnement », réponses incomplètes sous un budget raisonnable | — |
| **GLM 5.x / GLM 5.3 / GLM 5.3 Flash** | ❌ **EXCLUS comme exigé** — listés « frontier payants » dans la documentation officielle Workers AI | paiement requis |
| llama-3.1-8b | ❌ Déprécié par Cloudflare (erreur réelle 5028) | — |

- **Plan Free Workers AI : 10 000 Neurons/jour, AUCUN moyen de paiement possible** (vérifié sur la documentation officielle). Le budget du projet reste **strictement 0 USD/mois**.
- Avec qwen3 : ≈ **800 échanges/jour** au global — très au-dessus des quotas choisis.
- Les GLM 5.3 / 5.3 Flash sont **exclus du code** : ils ne sont ni en défaut, ni en repli, nulle part.
- Modèle changeable sans réécrire le code (variable `WORKERS_AI_MODEL`), et la couche d'abstraction (`lib/ai/client.ts`) permettrait de changer de fournisseur un jour sans toucher les assistants.

## 3. Accès au modèle : par le binding, aucune clé API

- `wrangler.jsonc` : `"ai": { "binding": "AI" }` — **il n'existe littéralement aucune clé API pour Workers AI** : rien à exposer, rien à régénérer, rien à fuir.
- Aucun secret ajouté, aucune variable de paiement.

---

## 4. Assistant privé « Assistant IA — Rédaction » (`/admin/assistant`)

- **Accès** : admin + éditeur uniquement (garde serveur `requireRole` sur la page ET l'endpoint — l'UI n'est jamais le contrôle d'accès). Le reporter n'y a pas accès. Entrée visible dans la Sidebar.
- **Boutons d'actions rapides (10)** : Rédiger un article · Communiqué → article · Proposer des titres · Proposer un résumé · Corriger · Reformuler · Publication Facebook · Description YouTube · Questions d'interview · Idées de sujets.
- **Anti-invention inscrite dans le prompt système** : tout fait non fourni doit être écrit `[à vérifier]` ; jamais de citation inventée, jamais de chiffre ou de date inventé.
- **« Envoyer vers le CMS »** : quand l'assistant produit un article structuré (format TITRE / RÉSUMÉ / CONTENU / MOTS-CLÉS, parseur tolérant au markdown), un **formulaire éditable** s'ouvre : la rédaction RELIT chaque champ, puis « Enregistrer comme brouillon » passe par l'action CMS existante `saveArticle` avec statique verrouillée **« draft »** et intention « draft » (cachés dans le formulaire, jamais publiables depuis l'assistant).
  - **L'IA ne publie jamais.**
  - **Elle ne contourne aucune permission** : la RLS et `requireRole admin/editor/reporter` de `saveArticle` s'appliquent exactement comme pour un article saisi à la main.
  - **Elle ne modifie jamais un article publié** (aucune action de mise à jour appelée depuis l'assistant).
- Bouton **Copier** sur chaque réponse (presse-papiers du navigateur).
- **Confidentialité** : rien n'est stocké — la conversation vit dans l'état du composant et disparaît au rechargement ; l'histoire envoyée au modèle est bridée aux 4 derniers messages (coût maîtrisé). Aucune donnée repart au navigateur que le texte généré + nom du modèle.
- Demande plafonnée à **6 000 caractères** ; réponse plafonnée à 900 tokens.

## 5. Chatbot public « Assistant Bonne Humeur TV »

- **Bouton flottant discret en bas à GAUCHE** (le WhatsApp reste en bas à droite — zéro chevauchement) ; panneau mobile-first (pleine largeur sur mobile, boîte 22rem sur écran large). Monté dans le layout public uniquement — le back-office ne l'exécute pas.
- **Périmètre strict, posé dans le prompt système** : ne répond que sur Bonne Humeur TV (programmes, articles/vidéos publiés, chaîne YouTube, contacts, partenariat). Tout le reste → **le message exact exigé par la direction** : « Je ne dispose pas actuellement de cette information sur Bonne Humeur TV. Vous pouvez contacter notre équipe pour en savoir davantage. » Vérifié par test unitaire d'égalité caractère par caractère.
- **RAG textuel PostgreSQL** (comme demandé, pas de vectoriel avant preuve) : la question passe par la fonction `search_published` existante (security definer — **ne renvoie que du publié** : jamais de brouillon, jamais de programmé, jamais de donnée admin), complétée par une petite base statique vérifiée (chaîne YouTube, page contact, page partenariats, WhatsApp +224 662 860 976, état du direct). Réponse bornée à 3 phrases + ligne « Source : » avec le titre et le lien de l'article/vidéo utilisés.
- **Les contenus récupérés sont des DONNÉES, jamais des instructions** : c'est écrit dans le prompt, et testé — le contexte injecté ne contient aucun secret (test unitaire cherche SUPABASE/service_role/BREVO/API_KEY → interdits).
- **Aucune donnée personnelle** : pas de nom, pas de stockage, conversation perdue au rechargement. Empreinte anti-abus = sha256(IP + UA + jour UTC) **rotée chaque jour** — l'IP n'est jamais stockée (même motif que l'analytics existante, migration 0025).
- **Bots refusés** (même garde `isBotUserAgent` que la collecte d'audience). En cas d'échec du modèle : TOUJOURS le message de recadrage — jamais une erreur brute, jamais d'invention.
- Message plafonné à **2 000 caractères**.

## 6. Quotas centralisés (migration 0032 — écrits, NON appliqués)

Deux compteurs **DISTINCTS** dans la table `form_submissions` existante (fonction `check_rate_limit` de la migration 0002 étendue + contrainte CHECK alignée) :

| Compteur | Public | Admin |
|---|---|---|
| Fenêtre courte | 12 / 10 min par visiteur | 40 / 10 min par rédacteur |
| Quota journalier global | 400/j | **120/j — part RÉSERVÉE** |

- Le public écrit dans `assistant_public`, l'administration dans `assistant_admin` : **le public ne peut jamais épuiser le quota de l'administration**, et réciproquement les quotas sont indépendants.
- **Défense en profondeur pendant que 0032 n'est PAS appliquée** : la base refuse l'appel RPC → état « degraded » documenté → un **limiteur en mémoire prend le relais** (testé par 7 tests). Aucune requête n'échappe à tout contrôle, avant comme après la migration.
- Quota atteint → HTTP 429 propre + message visible ; **jamais** de bascule vers une API payante.
- Migration **minimale et additive** : aucune table nouvelle, aucune colonne nouvelle, aucune donnée touchée, aucune policy modifiée. Les anciennes lignes `form_submissions` restent valides.

## 7. Sécurité — récapitulatif

- Clés/secrets : **absents du code** ; le seul accès au modèle est le binding Workers (aucune clé) ; l'endpoint admin n'expose jamais autre chose que le texte généré ; AUCUNE clé dans le chat public.
- service_role : uniquement via la fonction centrale existante pour les compteurs de quota — jamais dans la requête d'un visiteur.
- Contrôles d'accès : page admin (requireRole) + endpoint admin (requireRole) + RLS de `saveArticle` en dernier ressort.
- Injections : contenus publiés injectés comme données avec consigne ignore-toute-instruction + question visiteur tronquée à 300 caractères pour le contexte RAG (anti-prompt-injection volumique, testée).

## 8. Qualité — preuves

```
npx vitest run        → 19 fichiers, 321/321 PASS (24 nouveaux tests IA)
npx tsc --noEmit      → 0 erreur
npx eslint            → 0 avertissement (fichiers nouveaux/modifiés)
npx next build        → succès (routes /admin/assistant, /api/ai/admin, /api/ai/public)
npx opennextjs-cloudflare build → Worker .open-next généré
```

Nouveaux fichiers : `lib/ai/client.ts`, `lib/ai/quotas.ts`, `lib/ai/prompts.ts`, `lib/ai/knowledge.ts`, `lib/ai/parse-article.ts`, `lib/ai/ai.test.ts`, `app/api/ai/admin/route.ts`, `app/api/ai/public/route.ts`, `app/admin/assistant/page.tsx`, `components/admin/AiAssistant.tsx`, `components/home/AiChatWidget.tsx`, `supabase/migrations/0032_assistants_ia.sql`.
Modifiés (additifs) : `wrangler.jsonc` (binding AI), `lib/actions/helpers.ts` (types de `checkRateLimit` élargis, logique inchangée), `components/admin/Sidebar.tsx` (entrée « Assistant IA »), `app/(public)/layout.tsx` (montage du widget).

---

## 9. CE QUE JE DEMANDE À LA DIRECTION (autorisations séparées)

1. **Autorisation 1 — appliquer la migration 0032** sur le serveur Supabase (quotas en base ; avant son application, l'assistant fonctionne déjà grâce au filet mémoire).
2. **Autorisation 2 — déployer** le Worker sur le preview pour les tests réels navigateur (assistant admin connecté + chatbot public).
3. **Autorisation 3 — commit + push GitHub.**

Aucune de ces trois actions n'a été faite. Rien n'a été touché au CMS, aux publicités, au direct, à l'analytics — aucune fonctionnalité existante modifiée (les 3 fichiers touchés sont strictement additifs).

---

*Fin du rapport — Mission Assistants IA, Phase C complète.*
