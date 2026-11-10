/* Service worker — Bonne Humeur Média Admin (v1).
 *
 * DÉLIBÉRÉMENT « RÉSEAU SEUL » : ce worker N'INTERCEPTE rien et ne sert
 * JAMAIS une réponse depuis un cache. Rôle = rendre l'application
 * INSTALLABLE et gérer proprement son cycle de vie ; il ne peut ni
 * afficher du contenu privé hors ligne, ni servir une ancienne version
 * de l'administration, ni retenir des cookies. La vie hors ligne de
 * l'app est de la responsabilité du composant client PwaAdmin
 * (indicateur OFFLINE + reprise automatique au retour du réseau).
 *
 * Stratégie de mise à jour (simple et sûre) :
 *  • le navigateur compare sw.js à chaque navigation — un changement de
 *    fichier installe la nouvelle version automatiquement ;
 *  • le worker n'ayant AUCUN état, une version installée est activée
 *    immédiatement (skipWaiting + claim) sans jamais recharger la page —
 *    une saisie en cours n'est jamais interrompue ;
 *  • AUCUN cache de pages, aucune donnée : rien à purger à la
 *    déconnexion (le cache navigateur est déjà barré par les en-têtes
 *    no-store de /admin/* et /api/*).
 */

const VERSION = "bhtv-admin-v2-installer";

self.addEventListener("install", () => {
  // Rien à précacher (aucune ressource ne doit survivre au réseau).
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Purge défensive : supprime tout cache éventuel d'une version
  // antérieure (jamais créé par ce worker — filet de sécurité).
  event.waitUntil(
    (async () => {
      if (self.caches && caches.keys) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

// Gestionnaire fetch PRÉSENT mais SILENCIEUX (compatibilité installer) :
// Chrome — et plusieurs navigateurs Android — exigent « un fetch
// handler » pour juger l'app INSTALLABLE. Un listener sans respondWith
// laisse chaque requête suivre le réseau NORMALEMENT : ce worker ne
// répond toujours JAMAIS depuis un cache, ne met rien en cache, et
// l'indicatrice hors ligne reste dans PwaAdmin. Comportement réseau :
// identique à sans-listener — critère installer : rempli.
self.addEventListener("fetch", () => {
  /* passthrough volontaire : réseau seul, aucune réponse substituée */
});

// L'indicateur hors ligne est affiché par PwaAdmin (documenté).
console.info(`[BHM Admin SW] ${VERSION} actif — réseau seul, aucun cache, installer OK.`);
