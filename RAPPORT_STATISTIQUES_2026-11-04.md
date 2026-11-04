# RAPPORT FINAL — TABLEAU DE BORD STATISTIQUES (mission « Statistiques d'audience »)

**Date : 04/11/2026 · Projet : bonne-humeur-tv · Statut : CODE TERMINÉ ET VALIDÉ LOCALEMENT — en attente de VOTRE autorisation pour (1) migration 0029 distante, (2) déploiement Cloudflare, (3) push GitHub.**

---

## 1. Ce qui a été livré

Un onglet **« Statistiques »** (visible de l'administrateur uniquement) au panneau d'administration, alimenté par une collecte **propriétaire, anonyme, gratuite** (0 USD/mois, aucune dépendance ajoutée, aucun service tiers) :

- **6 indicateurs** avec comparaison à la période précédente : Sessions estimées, Pages vues, Durée d'engagement estimée (visible uniquement), Lectures d'articles, Lectures engagées (≥ 30 s), Pages abandonnées (< 10 s).
- **Graphiques SVG rendus côté serveur (zéro JS client)** :
  - A. Courbe d'évolution (trait plein période courante, pointillés période précédente, infobulles au survol) ;
  - B. Pays : **classement à drapeaux + CARTE DU MONDE SVG** (celle que vous avez validée) — silhouettes schématiques, points positionnés sur les coordonnées réelles de chaque pays, taille proportionnelle aux pages vues, infobulles ;
  - C. Articles les plus lus (cliquables → fiche détaillée par article) ;
  - D/E. Sources de trafic (WhatsApp, Facebook, Google, direct, etc.), appareils, navigateurs ;
  - F. Grille jours × heures (heure de Conakry GMT+0) + **3 meilleures heures de publication**.
- **Filtres** : Aujourd'hui / Hier / 7 / 30 / 90 jours / période personnalisée (liens serveur + formulaire GET — aucun JavaScript client nécessaire).
- **Export CSV** (UTF-8 avec BOM + point-virgules pour Excel), même filtres que le tableau de bord.
- **Fiche détaillée par article** : lectures, lecteurs uniques, engagement moyen, taux de lecture engagée, abandons, évolution par jour.
- **Mention de vie privée ajoutée à /confidentialite** (section 2, « Mesure d'audience anonyme »), date mise à jour novembre 2026.

## 2. Architecture (validée, appliquée conforme)

```
Navigateur (TrackerStats, composant léger)
   │  1 requête/page : {t:"pv", sid, eid, chemin, tz}   (keepalive)
   │  1 req./30 s max si du temps VISIBLE s'est écoulé + sendBeacon final
   ▼
Worker Cloudflare — POST /api/analytics/track
   │  refuse les bots (UA vide/connu) · classe appareil/navigateur/provenance
   │  PAYS = request.cf.country (Cloudflare, gratuit, IP jamais stockée)
   │  empreinte anti-abus = SHA-256(IP + UA + jour UTC), rotée chaque jour
   ▼
Supabase — 2 fonctions SQL (security definer), validations en dernier ressort
   │  insert_analytics_page_view : plafond 240 événements/h/empreinte,
   │    résolution de l'article par le slug du chemin, INSERT idempotent
   │  analytics_engagement : UPDATE GREATEST sur UNE ligne ( Jamais de ligne
   │    par heartbeat, jamais de baisse, jamais de doublon de comptage)
   ▼
Table analytics_page_views — RLS : AUCUNE policy publique, lecture ADMIN
   ▼
Tableau de bord (requireRole(["admin"]) + RLS) : agrégation en TypeScript
   pur, cap 25 000 lignes/période au-delà → refus honnête, jamais tronqué.
```

**Fichiers** : migration `supabase/migrations/0029_analytics_visiteurs.sql` (1 table, 5 index, 2 RPC, 1 purge, RLS admin-only) ; `lib/analytics/classes.ts` + `aggregate.ts` + `queries.ts` + `analytics.test.ts` ; `components/analytics/TrackerStats.tsx` ; `app/api/analytics/track/route.ts` ; `components/admin/stats/charts.tsx` ; `app/admin/statistiques/page.tsx` + `articles/[id]/page.tsx` + `export/route.ts` ; `components/admin/Sidebar.tsx` (entrée « Statistiques » admin) ; `app/layout.tsx` ; `app/confidentialite/page.tsx` ; `.env.example`.

**Configuration requise après déploiement : AUCUNE** — aucun secret supplémentaire (la collecte utilise la clé anon publique ; l'administrateur n'a rien à activer).

## 3. Vie privée (conforme au §9 de la mission)

- Aucun cookie, aucune IP stockée, aucune donnée personnelle, aucun identifiant durable : la session est un UUID aléatoire en sessionStorage (régénéré après 30 min d'inactivité ou à la fermeture de l'onglet).
- Empreinte anti-abus : hachage non réversible roté chaque jour, jamais exploitable pour identifier quelqu'un (même motif que le journal anti-spam 0025).
- Temps d'engagement : compté **seulement quand la page est visible** ; transmission groupée toutes les 30 s max.
- Exclusions prouvées dans le code : chemins `/admin` (refusés au client ET au serveur ET en SQL), robots (détectés côté client et serveur), environnements de développement (NODE_ENV enlined), hôtes privés/localhost.
- Conservation 12 mois, purge `purge_analytics()` fournie.
- Lecture des données : administrateur uniquement (policy RLS SELECT `analytics_page_views_admin_select`).

## 4. Tests — 282/282 PASS (17 fichiers), scénarios §12 couverts

Nouvelle suite `lib/analytics/analytics.test.ts` (7 groupes) prouve en noyau pur : trafic automatisé exclu (12-9) ; classement appareils/navigateurs serveur (12-1/2/3/8) ; pays — absent → « Inconnu » jamais fusionné ni inventé (12-11/12) ; engagement = temps visible, seuils 30 s / 10 s exacts, plafonnement (12-4/5/6/7) ; sessions distinctes ≠ pages vues, deltas honnêtes (base à 0 → « pas de comparaison ») ; articles — classement, lecture engagée, article retiré → libellé neutre (12-14) ; sources WhatsApp/Facebook/moteurs/direct (12-10) ; grille jours×heures ; filtres presets/custom/repli honnête (12-13).

**Portes qualité : `tsc` EXIT 0 · ESLint EXIT 0 (0 erreur) · vitest 282/282 · `next build` OK (les nouvelles routes /admin/statistiques, /admin/statistiques/articles/[id], /admin/statistiques/export, /api/analytics/track compilent dans le Worker).**

## 5. Honnêteté des chiffres (règles implémentées)

- Aucun chiffre fictif nulle part ; absence de données = messages d'état explicites.
- « Durée d'engagement **estimée** » : étiquette affichée à chaque occurrence (mission §5).
- « Lecture engagée » : règle fixe ≥ 30 s de page visible, affichée comme carte de transparence sur les fiches article.
- Comparaison période précédente impossible (base à 0 ou période précédente trop volumineuse) → « — pas de comparaison », jamais de +∞ ni de faux pourcentage.
- Période trop volumineuse (> 25 000 visites) → message d'état et export CSV par tranches ; jamais de graphique tronqué présenté comme complet.
- Article supprimé → agrégat conservé sous « (article retiré ou indisponible) », titre jamais inventé.
- Pays non détecté → bucket « Inconnu » distinct ; pays sans position sur la carte → compté au classement, jamais placé au hasard.

## 6. Aucune régression

Formulaires publics, RLS existante, module Demandes/Réponses, régie : rien n'a été modifié hors les fichiers ci-dessus (layout + Sidebar + confidentialité : changements purement additifs). Le tracker ne s'exécute qu'en production, jamais sur /admin, /api, ni en local.

## 7. En attente de VOS autorisations (dans l'ordre)

1. **Migration 0029 sur la base distante** (Supabase beinalmwqkxbqitvuobr) — via CLI + vérification réelle (policies, RPC, grants).
2. **Déploiement Cloudflare** — la collecte démarre dès la mise en ligne (les données s'accumulent à partir de ce moment ; les stats resteront vides quelques heures/jours — c'est le message honnête prévu).
3. **Push GitHub** (branche main).

Après validation, vous pourrez tester : onglet Statistiques, filtres, fiche d'un article, export CSV — et la mention de confidentialité sur /confidentialite.
