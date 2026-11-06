"use client";

import { useEffect, useRef, useState } from "react";
import { cssDesignStyle } from "@/lib/design/tokens";
import type { DesignConfig } from "@/lib/design/schema";
import { cn } from "@/lib/utils";

const DEVICES = {
  desktop: "100%",
  tablet: "768px",
  mobile: "390px",
} as const;

/**
 * APERÇU DU STUDIO — iframe de la façade publique réelle (brouillon).
 * • Couleurs / typographie / arrondis / ombres / hauteur d'en-tête :
 *   réaction INSTANTANÉE (injection des variables --bhtv-* dans le
 *   document de l'iframe, sans rechargement).
 * • Ordre/visibilité/titres/colones/pied de page : rendus côté serveur —
 *   actualisés par « Prévisualiser » (brouillon enregistré + rechargement).
 */
export function StudioPreviewFrame({
  config,
  reloadKey = 0,
}: {
  config: DesignConfig;
  /** Signal de rechargement (Le parent l'incrémente après enregistrement.) */
  reloadKey?: number;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [device, setDevice] = useState<keyof typeof DEVICES>("desktop");
  const [localKey, setLocalKey] = useState(0); // bouton ↻
  const [loaded, setLoaded] = useState(false);

  // Injection LIVE des variables dans le document de l'iframe.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument;
    if (!doc) return;
    // Rattrapage : si l'iframe a chargé AVANT l'hydration, l'événement
    // load a été manqué — readyState fait foi (sans rechargement).
    if (!loaded) {
      if (doc.readyState !== "complete") return;
      setLoaded(true);
    }
    try {
      let el = doc.querySelector<HTMLStyleElement>("style[data-bhtv-design]");
      if (!el) {
        el = doc.createElement("style");
        el.setAttribute("data-bhtv-design", "");
        doc.head.appendChild(el);
      }
      el.textContent = cssDesignStyle(config);
    } catch {
      // même origine — n'arrive jamais en pratique ; silence.
    }
  }, [config, loaded]);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-800/90 dark:border-white/10">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">
          Aperçu
        </span>
        <div className="flex items-center gap-1.5">
          {(Object.keys(DEVICES) as (keyof typeof DEVICES)[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDevice(d)}
              className={cn(
                "rounded-xl border px-4 py-2 text-xs font-bold transition-colors sm:text-sm",
                device === d
                  ? "border-guinea-red bg-guinea-red/10 text-guinea-red"
                  : "border-neutral-600 text-neutral-400 hover:text-neutral-200",
              )}
            >
              {d === "desktop" ? "💻 Ordinateur" : d === "tablet" ? "▭ Tablette" : "📱 Téléphone"}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setLoaded(false);
              setLocalKey((k) => k + 1);
            }}
            aria-label="Recharger l'aperçu"
            className="ml-1 rounded-xl border border-neutral-600 px-3 py-2 text-sm font-semibold text-neutral-400 hover:text-neutral-200"
          >
            ↻
          </button>
        </div>
      </div>
      <div className="flex min-h-[60vh] justify-center border-t border-neutral-700/50 p-2">
        <iframe
          ref={iframeRef}
          key={reloadKey + localKey}
          src="/studio-preview"
          title="Aperçu du design"
          onLoad={() => setLoaded(true)}
          className="h-[75vh] min-h-[480px] rounded-lg border border-neutral-600 bg-white"
          style={{ width: DEVICES[device], maxWidth: "100%" }}
        />
      </div>
    </div>
  );
}
