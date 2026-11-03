"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { expiryEvents } from "@/lib/flash/flash-core";
import { FLASH_BANNER_STYLES } from "@/lib/flash/flash-style";

/**
 * Bandeau de flash-infos CÔTÉ NAVIGATEUR (§8) :
 *  • les items fournis sont déjà filtrés par le serveur (RLS période +
 *    re-vérification au rendu) ;
 *  • chaque flash à fin définie est RETIRÉ à son heure exacte — même si
 *    le visiteur garde la page ouverte (UN setTimeout par flash, aucune
 *    boucle de requêtes, aucun interval coûteux) ;
 *  • au retour d'un onglet resté longtemps ouvert (temporisateur de fond
 *    ralenti), purge immédiate des échéances dépassées ;
 *  • les flashs historiques sans expiration restent affichés (règle §9) ;
 *  • le défilement en boucle est l'animation CSS marquee existante ;
 *    prefers-reduced-motion la désactive (règle globale, contenu statique).
 */

export interface FlashTickerItem {
  id: string;
  content: string;
  link: string | null;
  end_at: string | null;
  level?: "normal" | "important" | "urgent";
}

/** Sévère le plus haut présent (aiguise la couleur global du bandeau). */
const SEVERITY: Record<string, number> = { normal: 0, important: 1, urgent: 2 };

export default function FlashTicker({ items }: { items: FlashTickerItem[] }) {
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  // Retrait à échéance : un temporisateur par flash — recalculé après
  // chaque purge (dépendance hiddenIds) ; jamais de boucle de requêtes.
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const event of expiryEvents(items, Date.now())) {
      if (hiddenIds.has(event.id)) continue;
      timers.push(
        setTimeout(() => {
          setHiddenIds((prev) => {
            const next = new Set(prev);
            next.add(event.id);
            return next;
          });
        }, event.delayMs)
      );
    }
    const onVisible = () => {
      // Onglet revenu au premier plan : les échéances déjà dépassées
      // partent immédiatement (les temporisateurs de fond sont ralentis).
      if (document.visibilityState !== "visible") return;
      const overdue = expiryEvents(items, Date.now()).filter((e) => e.delayMs === 0);
      if (overdue.length > 0) {
        setHiddenIds((prev) => {
          const next = new Set(prev);
          for (const e of overdue) next.add(e.id);
          return next;
        });
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      for (const t of timers) clearTimeout(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [items, hiddenIds]);

  const visible = items.filter((item) => !hiddenIds.has(item.id));
  if (visible.length === 0) return null;

  // Couleur du bandeau = niveau le plus sévère affiché (urgent prioritaire).
  const worst = visible.reduce(
    (acc, item) => Math.max(acc, SEVERITY[item.level ?? "urgent"] ?? 2),
    0
  );
  const style = FLASH_BANNER_STYLES[
    (Object.keys(SEVERITY) as ("normal" | "important" | "urgent")[]).find(
      (k) => SEVERITY[k] === worst
    ) ?? "urgent"
  ];

  const loop = [...visible, ...visible];

  return (
    <div className={`flex items-stretch overflow-hidden ${style.band}`}>
      <span className="flex shrink-0 items-center gap-2 bg-black/25 px-4 py-2 text-[11px] font-extrabold uppercase tracking-widest">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
        </span>
        Flash Infos
      </span>
      <div className="relative flex flex-1 items-center overflow-hidden">
        <div className="flex whitespace-nowrap py-2 animate-marquee">
          {loop.map((news, i) => (
            <span key={`${news.id}-${i}`} className="flex items-center text-sm font-medium">
              {news.link ? (
                <Link
                  href={news.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 underline-offset-4 hover:underline"
                >
                  {news.content}
                </Link>
              ) : (
                <span className="px-6">{news.content}</span>
              )}
              <span className="opacity-50">•</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}