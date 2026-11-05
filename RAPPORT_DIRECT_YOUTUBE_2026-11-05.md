# RAPPORT — INTÉGRATION DIRECT YOUTUBE (05/11/2026)

**Projet : bonne-humeur-tv · Base : `27d59a3` · AUCUN déploiement, AUCUN push, AUCUNE migration appliquée — tout est local, en attente de votre validation.**

Chaîne : https://www.youtube.com/@Bonnehumeurt (identifiant résolu et vérifié : `UCc7NeYxDS7k8iVgRl97uOnA`).

## 1. Ce que le site fait désormais

Page d'accueil — section « EN DIRECT » pilotée par une règle unique, honnête dans tous les cas :

1. **Direct réel confirmé** (detection automatique côté serveur) OU **lien posé par la rédaction** : lecteur YouTube intégré sous un bandeau « EN DIRECT » clair, lecteur en façade — **YouTube n'est contacté par le navigateur QUE lorsque le visiteur choisit de lancer la lecture** (aucun iframe préchargé, aucune connexion à YouTube sans choix explicite).
2. **Pas de direct** (ou détection impossible/erreur) : présentation discrète des « Aucun direct pour le moment » + bouton « Voir notre chaîne YouTube » — **JAMAIS un lecteur vide, jamais une ancienne diffusion présentée comme un direct**.
3. **Rediffusion** : champ facultatif d'un lien de rediffusion, affiché dans une sous-section clairement étiquetée « Rediffusion récente », distincte de la partie direct, jamais confondue.
4. **Rubrique désactivée ou mode « off »** : la section ne s'affiche pas du tout (zéro footprint).

Aucun module existant n'est modifié : le bandeau « EN DIRECT MAINTENANT » du CMS (vidéo `is_live` de la rédaction), les publicités, les statistiques, l'éditeur, tout reste intérieur à leurs propres fichiers — la nouvelle section est un composant additionnel inséré dans la page d'accueil.

## 2. Détection automatique — comment

Dans l'ordre, uniquement côté serveur :

1. **Flux RSS officiel de la chaîne** (`youtube.com/feeds/videos.xml?channel_id=UC…`) — gratuit, sans clé, conforme aux conditions d'utilisation de YouTube : les 15 dernières vidéos sont identifiées de façon pure et testable (`parseRssEntries`, lib/direct/core.ts). **Aucun scraping HTML fragile.**
2. **Confirmation via YouTube Data API v3** (`videos.list`, 1 unité de quota par détection) : une vidéo du lot récent doit répondre `liveBroadcastContent === "live"` — « upcoming » (« à venir ») et « none » (« ordinaire ») sont explicite-ment REJETÉS. C'est la clé qui évite de présenter une vidéo normale comme un direct.
3. **Cache mémoire Worker de ~3 minutes** : même avec des dizaines de visiteurs, seuls quelques appels ont lieu par heure. Quota gratuit = 10 000 unités/jour — consommation estimée < 500 unités/jour en usage réel, sous 10 % du quota gratuit.

## 3. Clé API — jamais exposée

- La clé vit dans la variable `YOUTUBE_API_KEY` du Worker (secret, même mécanisme que la clé Brevo déjà en place). **Elle n'apparaît JAMAIS dans le navigateur**, jamais dans le bundle client, jamais dans l'HTML : la détection est un appel serveur uniquement.
- Sans clé : statut honnête « unconfigured » — le site N'affiche pas de lecteur (jamais de faux direct), la rubrique passe en présentation de chaîne discrète ; le mode manuel de la rédaction reste disponible SANS aucune clé (secours sans quota).
- `.env.example` documentait déjà la variable (ligne 36) : rien à créer côté fichier de configuration.

## 4. Administration — /admin/direct (nouveauté, rôle ADMIN)

Entrée « Direct » dans la barre latérale (admin uniquement) :

- **Activer / désactiver** la rubrique ;
- **Trois modes** : « Détection automatique » (par défaut), « Lien posé par la rédaction » (main gardée, aucun quota, aucune clé), « Désactivé » ;
- **Lien du direct précis** (facultatif) : accepte watch/youtu.be/live/embed ou l'identifiant à 11 caractères — normalisé par la bibliothèque existante `extractYouTubeId` ; toute URL externe à YouTube est REFUSÉE ;
- **Lien de rediffusion** (facultatif) ;
- **Prévisualisation** du lecteur public avant enregistrement ;
- **Bouton « Tester la détection maintenant »** : force une détection réelle (sans cache) et enregistre l'état + l'horodatage — le résultat s'affiche avec un badge honnête (DIRECT CONFIRMÉ / PAS DE DIRECT / CLÉ API MANQUANTE / ERREUR).

Toutes les écritures passent par `requireRole(["admin"])` + la RLS `has_role('admin')` (défense en profondeur, client de session, **jamais service_role**).

## 5. Fichiers (tous locaux, rien d'appliqué)

**Créés :**
- `supabase/migrations/0031_live_config.sql` — table `live_config` mono-ligne (activation, mode, lien manuel, rediffusion, dernier état + horodatage). Lecture publique (contenu purement public), écriture ADMIN uniquement. **Le module est livré DÉSACTIVÉ par défaut.** ⚠️ NON APPLIQUÉE à Supabase ;
- `lib/direct/core.ts` — noyau pure : parsing RSS, choix du direct dans la réponse API, décision d'affichage `applyLiveConfig` ;
- `lib/direct/detect.ts` — détection serveur (RSS + API v3 + cache mémoire 3 min) ;
- `lib/direct/config.ts` — lecture de `live_config` (RLS public) + normalisation des saisies ;
- `lib/actions/direct.ts` — Server Actions admin (enregistrement + test de détection) ;
- `components/home/LiveSection.tsx` — section accueil (décision pure, jamais de faux direct) ;
- `components/home/DirectLivePlayer.tsx` — lecteur en façade (clic → iframe youtube-nocookie, 16:9 responsive) ;
- `components/admin/DirectSettingsForm.tsx` — formulaire de configuration + prévisualisation ;
- `components/admin/DirectDetectForm.tsx` — test de détection ;
- `app/admin/direct/page.tsx` — écran d'administration (requireRole admin) ;
- `lib/direct/core.test.ts` — 15 tests du noyau pur.

**Modifiés (additifs minimaux, 7 lignes au total) :**
- `app/(public)/page.tsx` — import + insertion `<LiveSection />` après le bandeau direct du CMS ;
- `components/admin/Sidebar.tsx` — entrée « Direct » (admin).

## 6. Confidentialité / CSP (vérification)

- iframe UNIQUEMENT sur `www.youtube-nocookie.com` (aucune cookie de suivi avant lecture) — CSP `frame-src` **déjà autorisée** (lignes 18-27 de next.config.ts), **AUCUNE modification CSP nécessaire** ;
- miniatures depuis `i.ytimg.com` / `img.youtube.com` — déjà autorisées dans `img-src` ;
- appels API et RSS = côté serveur seulement (CSP navigateur non concernée) ;
- la confidentialité existante (page /confidentialite) reste exactement la même.

## 7. Quota & secours (sans abonnement)

| Scénario | Quota consommé | Comportement |
|---|---|---|
| Détection activée, pas de clé | 0 | Présentation chaîne discrète + mode manuel possible |
| Clé + visiteurs normaux | ~1 unité / 3 min (cache) | < 500 unités/jour, très sous le quota gratuit |
| YouTube indisponible | 0 (échec) | Présentation discrète, retour automatique |
| Secours total | 0 | Mode manuel de la rédaction (aucune API) |

Zéro coût : RSS gratuit, API gratuite jusqu'à 10 000 unités/jour, `pg_cron` déjà en place, aucun service payant introduit.

## 8. Tests réalisés / résultats

- **Vitest : 297/297 PASS** (18 fichiers — les 282 existants sont conservés, 15 nouveaux tests du noyau direct : parsing RSS, rejet d'« upcoming », matrice de décision complète) ;
- `tsc --noEmit` : **EXIT 0** ;
- ESLint : **0 erreur** ;
- `next build` : **OK — 41/41 pages générées**, route `/admin/direct` présente, aucune URL existante modifiée ;
- `opennextjs-cloudflare build` : **OK** ( Worker généré — c'est le build de compatibilité, PAS un déploiement).

## 9. Ce qui reste à FAIRE — avec votre autorisation

1. **Créer la clé API YouTube** (5 minutes, je vous guide pas-à-pas) : console.cloud.google.com → créer un projet → activer « YouTube Data API v3 » → créer une clé API → restrictions (référent absent, restreindre à l'API YouTube). Je pose ensuite le secret SANS jamais l'afficher : `printf '%s' 'VOTRE_CLE' | npx wrangler secret put YOUTUBE_API_KEY` (à saisir par vous, pas dans ce chat si vous préférez).
2. **Appliquer la migration 0031** sur Supabase (API Management, même méthode éprouvée).
3. **Déployer** sur Cloudflare Workers puis **pousser sur GitHub**.
4. **Test en réel** : activer la rubrique dans /admin/direct, poser le lien d'un direct si besoin, vérifier la page d'accueil (PC + mobile).

**En attente de votre feu vert — aucune opération distante n'a été effectuée.**
