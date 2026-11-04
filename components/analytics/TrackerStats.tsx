"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  ENGAGEMENT_CAP_MS,
  HEARTBEAT_SEND_MS,
  SESSION_IDLE_MS,
  capEngagement,
} from "@/lib/analytics/classes";

/**
 * Collecte d'audience ANONYME, légère et honnête (module Statistiques 0029).
 *
 *   • Session = UUID ALÉATOIRE éphémère (sessionStorage, régénéré après 30 min
 *     d'inactivité) — AUCUN cookie, AUCUNE donnée personnelle, AUCUN profil.
 *   • page_view : 1 requête par page (changements de routes Next inclus,
 *     sans rechargement complet).
 *   • Engagement : comptage local SEULEMENT quand la page est VISIBLE
 *     (onglet actif) ; transmission groupée toutes les 30 s max + envoi
 *     final fiable via sendBeacon au départ. Jamais 1 requête par seconde ;
 *     la base ne stocke qu'UNE ligne par page vue (upsert monotone).
 *   • Exclusions : environnements de développement (NODE_ENV inlined à la
 *     compilation), localhost/RFC1918, chemins /admin (les administrateurs
 *     ne sont JAMAIS comptés), robots (navigator.webdriver).
 *   • Le serveur décide de tout ce qui est rapportable (pays, appareil,
 *     provenance) — le navigateur ne rapporte QUE sid/eid/chemin/durée.
 */

const STORAGE_KEY = "bhtv.asid";

function isPrivateHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    /^127\./.test(hostname) ||
    /^0\.0\.0\.0$/.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  );
}

function loadSession(): string {
  try {
    const now = Date.now();
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { sid?: string; ts?: number };
      if (parsed.sid && typeof parsed.ts === "number" && now - parsed.ts < SESSION_IDLE_MS) {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ sid: parsed.sid, ts: now }));
        return parsed.sid;
      }
    }
    const sid = crypto.randomUUID();
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ sid, ts: now }));
    return sid;
  } catch {
    // sessionStorage indisponible (navigation privée stricte) : session
    // purement en mémoire — on collecte tout de même de façon anonyme.
    return crypto.randomUUID();
  }
}

export default function TrackerStats() {
  const pathname = usePathname();
  const eventId = useRef<string>("");
  const engagedMs = useRef(0);
  const sentMs = useRef(0);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!pathname || pathname.startsWith("/admin") || pathname.startsWith("/api/")) return;
    if (typeof navigator !== "undefined" && navigator.webdriver) return; // bot
    if (isPrivateHost(window.location.hostname)) return;

    const sid = loadSession();
    const eid = crypto.randomUUID();
    eventId.current = eid;
    engagedMs.current = 0;
    sentMs.current = 0;

    const tzOffset = new Date().getTimezoneOffset();

    // ——— page view : 1 requête par page (keepalive : survit à la fermeture)
    fetch("/api/analytics/track", {
      method: "POST",
      keepalive: true,
      credentials: "omit",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ t: "pv", sid, eid, path: pathname, tz: tzOffset }),
    }).catch(() => {}); // échec silencieux : les stats ne cassent JAMAIS le site

    // ——— comptage d'engagement : 1 s seulement si la page est VISIBLE
    const tick = setInterval(() => {
      if (document.visibilityState === "visible") {
        engagedMs.current = Math.min(engagedMs.current + 1000, ENGAGEMENT_CAP_MS);
      }
    }, 1000);

    // ——— transmission groupée max 1 / 30 s, seulement si du temps visible s'est écoulé
    const send = (final: boolean) => {
      const delta = engagedMs.current - sentMs.current;
      if (delta <= 0 && !final) return;
      const msCap = capEngagement(engagedMs.current);
      if (msCap <= 0 && !final) return;
      if (typeof navigator !== "undefined" && navigator.sendBeacon && final) {
        // Envoi fiable au départ (page masquée / quittée) — sans header.
        navigator.sendBeacon(
          "/api/analytics/track",
          new Blob([JSON.stringify({ t: "eng", sid, eid, ms: msCap })], { type: "application/json" })
        );
      } else {
        fetch("/api/analytics/track", {
          method: "POST",
          keepalive: true,
          credentials: "omit",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ t: "eng", sid, eid, ms: msCap }),
        }).catch(() => {});
      }
      sentMs.current = msCap;
    };

    const heartbeat = setInterval(() => send(false), HEARTBEAT_SEND_MS);
    const sendFinal = () => send(true);
    const onHide = () => {
      if (document.visibilityState === "hidden") send(true);
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", sendFinal);

    return () => {
      clearInterval(tick);
      clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", sendFinal);
      // Changement de route Next (sans rechargement complet) : clôture de la
      // page vue courante — aucune seconde visible décomptée n'est perdue.
      if (eventId.current === eid) send(true);
    };
  }, [pathname]);

  return null;
}