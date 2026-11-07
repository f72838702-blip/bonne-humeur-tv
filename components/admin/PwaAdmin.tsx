"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/**
 * PWA Admin — composant CLIENT du back-office, monté UNIQUEMENT dans
 * app/admin/layout.tsx (jamais dans la façade publique) :
 *
 *  1. Enregistrement du service worker /sw.js — worker « réseau seul »
 *     (il ne sert JAMAIS une réponse depuis un cache : aucune donnée
 *     privée ne peut être réaffichée hors ligne). Une mise à jour du
 *     worker est activée immédiatement, sans jamais recharger la page.
 *
 *  2. Indicateur « Hors ligne » : bandeau fixe et discret tant que la
 *     connexion manque (navigator.onLine + événements online/offline).
 *     Au retour de la connexion, le bandeau disparaît et la page peut
 *     être utilisée normalement (reprise = rechargement manuel, aucune
 *     synchronisation complexe — règle du cahier Phase 6).
 *
 * Le composant ne stocke RIEN (aucun localStorage, aucune donnée privée)
 * et ne touche à aucune fonctionnalité existante.
 */
export default function PwaAdmin() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    // 1. Enregistrement du SW (échec silencieux : navigateur sans SW /
    //    environnement de test — la page reste parfaitement utilisable).
    if ("serviceWorker" in navigator) {
      const register = () => {
        navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {
          /* aucune conséquence fonctionnelle */
        });
      };
      if (document.readyState === "complete") register();
      else window.addEventListener("load", register, { once: true });
    }

    // 2. État réseau — init + suivi (les navigateurs firent « online »
    //    au retour de la connexion : reprise normale).
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!offline) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-[60] flex items-center justify-center gap-2 bg-neutral-900 px-4 py-2 text-center text-xs font-semibold text-white shadow-lg lg:bottom-4 lg:left-auto lg:right-4 lg:rounded-full lg:px-4 lg:text-sm"
    >
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      Connexion perdue — réessayez quand le réseau est de retour.
    </div>
  );
}
