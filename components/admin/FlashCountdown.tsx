"use client";

import { useEffect, useState } from "react";
import { remainingLabel } from "@/lib/flash/flash-core";

/**
 * Compte à rebours admin — purement indicatif (le retrait RÉEL est
 * appliqué par le serveur et par le bandeau public). Mise à jour légère
 * (30 s) + recalcul immédiat au retour d'un onglet resté ouvert
 * (les temporisateurs de fond sont ralentis par les navigateurs).
 */
export default function FlashCountdown({ endIso }: { endIso: string }) {
  const [nowIso, setNowIso] = useState<string | null>(null);

  useEffect(() => {
    // Hydratation cohérente : le premier rendu serveur n'affiche rien.
    const tick = () => setNowIso(new Date().toISOString());
    tick();
    const id = setInterval(tick, 30_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (nowIso === null) return null;
  const label = remainingLabel(nowIso, endIso);
  if (!label) {
    return <span className="text-[11px] font-semibold text-guinea-red">expiré</span>;
  }
  return <span className="text-[11px] font-semibold text-emerald-600 dark:text-guinea-green">{label}</span>;
}