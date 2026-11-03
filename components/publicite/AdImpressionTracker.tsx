"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Enveloppe de déduplication d'impression (§10) :
 *   - IntersectionObserver à 50 % de visibilité (au moins la moitié
 *     de la création à l'écran) ;
 *   - UN SEUL envoi par navigateur, par jour, par créative
 *     (sessionStorage) — le serveur redéduplique par empreinte
 *     (SHA-256 IP|UA|créative|jour) de toute façon ;
 *   - garde `sent` pour le double montage en Strict Mode :
 *     aucune double impression.
 * Aucun fingerprint n'est calculé côté client — le serveur seul
 * décide (anti-fraude minimale, chiffres indicatifs).
 */

interface Props {
  creativeId: string;
  placement: string;
  children: ReactNode;
}

export default function AdImpressionTracker({ creativeId, placement, children }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sentRef = useRef(false);

  useEffect(() => {
    if (sentRef.current) return;

    const dayKey = new Date().toISOString().slice(0, 10);
    const storageKey = `bhtv-ad-imp-${creativeId}`;
    try {
      if (typeof window !== "undefined" && window.sessionStorage.getItem(storageKey) === dayKey) {
        sentRef.current = true;
        return;
      }
    } catch {
      // SessionStorage indisponible : la déduplication serveur prend le relais.
    }

    const container = containerRef.current;
    if (!container || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || sentRef.current) continue;
          sentRef.current = true;
          observer.disconnect();

          try {
            window.sessionStorage.setItem(storageKey, dayKey);
          } catch {
            // échec silencieux (navigation privée) — envoi quand même
          }

          void fetch("/ads/track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ creative_id: creativeId, placement }),
            keepalive: true,
          }).catch(() => {
            // impression non comptée : jamais bloquant pour l'utilisateur
          });
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, [creativeId, placement]);

  return (
    <div ref={containerRef} className="block">
      {children}
    </div>
  );
}