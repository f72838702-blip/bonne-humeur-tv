"use client";

import { useEffect, useState } from "react";
import { WifiOff, Download } from "lucide-react";

/**
 * PWA Admin — composant CLIENT du back-office, monté UNIQUEMENT dans
 * app/admin/layout.tsx (jamais dans la façade publique) :
 *
 *  1. Enregistrement du service worker /sw.js — worker « réseau seul »
 *     (il ne sert JAMAIS une réponse depuis un cache : aucune donnée
 *     privée ne peut être réaffichée hors ligne). Une mise à jour du
 *     worker est activée immédiatement, sans jamais recharger la page.
 *     Avec `offlineOnly` (page sans session : /admin/login), le SW
 *     N'EST PAS enregistré : l'installation exige une connexion
 *     (les artefacts du manifest sont rendus côté serveur uniquement
 *     dans la branche avec session du layout).
 *
 *  2. Bouton « Installer l'application » (session connectée seulement) :
 *     le navigateur émet beforeinstallprompt UNIQUEMENT quand l'app est
 *     installable (SW actif + manifest + HTTPS). Nous capturons cet
 *     événement et affichons notre propre bouton — l'installation ne
 *     dépend donc pas d'un menu de navigateur, qui varie selon les
 *     versions. Discret, jamais bloquant, disparaît après installation
 *     (appinstalled) ou en mode standalone (déjà installée).
 *
 *  3. Indicateur « Hors ligne » : bandeau fixe et discret tant que la
 *     connexion manque (navigator.onLine + événements online/offline).
 *     Au retour de la connexion, le bandeau disparaît et la page peut
 *     être utilisée normalement (reprise = rechargement manuel, aucune
 *     synchronisation complexe — règle du cahier Phase 6).
 *
 * Le composant ne stocke RIEN (aucun localStorage, aucune donnée privée)
 * et ne touche à aucune fonctionnalité existante.
 */
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

export default function PwaAdmin({ offlineOnly = false }: { offlineOnly?: boolean }) {
  const [offline, setOffline] = useState(false);
  const [installEvt, setInstallEvt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    // 1. Enregistrement du SW — UNIQUEMENT côté session connectée
    //    (échec silencieux : navigateur sans SW / environnement de test
    //    — la page reste parfaitement utilisable).
    if (!offlineOnly && "serviceWorker" in navigator) {
      const register = () => {
        navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {
          /* aucune conséquence fonctionnelle */
        });
      };
      if (document.readyState === "complete") register();
      else window.addEventListener("load", register, { once: true });
    }

    // 2..3. État réseau — init + suivi (les navigateurs firent « online »
    //    au retour de la connexion : reprise normale).
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, [offlineOnly]);

  useEffect(() => {
    // 2. Bouton d'installation — session connectée seulement ; jamais
    //    en mode standalone (l'app est déjà installée).
    if (offlineOnly) return;
    if (typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches) return;
    const onPrompt = (event: Event) => {
      event.preventDefault(); // on affiche NOTRE bouton, pas l'infobar
      setInstallEvt(event as InstallPromptEvent);
    };
    const onInstalled = () => setInstallEvt(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [offlineOnly]);

  const install = async () => {
    if (!installEvt) return;
    try {
      await installEvt.prompt();
      const choice = await installEvt.userChoice;
      if (choice.outcome === "accepted") setInstallEvt(null);
    } catch {
      /* annulé par le navigateur : le bouton reste discret, rien à casser */
    }
  };

  if (!offline && !installEvt) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 lg:inset-x-auto lg:bottom-4 lg:right-4 lg:items-end">
      {offline && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-auto w-full flex items-center justify-center gap-2 bg-neutral-900 px-4 py-2 text-center text-xs font-semibold text-white shadow-lg lg:w-auto lg:rounded-full lg:px-4 lg:text-sm"
        >
          <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
          Connexion perdue — réessayez quand le réseau est de retour.
        </div>
      )}
      {installEvt && (
        <button
          type="button"
          onClick={install}
          className="pointer-events-auto w-full flex items-center justify-center gap-2 rounded-full bg-[#CE1126] px-4 py-2 text-center text-xs font-semibold text-white shadow-lg lg:w-auto lg:px-4 lg:text-sm"
        >
          <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
          Installer l’application
        </button>
      )}
    </div>
  );
}
