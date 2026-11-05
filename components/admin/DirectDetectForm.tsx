"use client";

import { useActionState } from "react";
import { RefreshCw } from "lucide-react";
import { testDirectDetection, type DetectDirectState } from "@/lib/actions/direct";
import type { LiveConfig } from "@/lib/direct/core";

/**
 * Bouton « Tester la détection maintenant » — la détection s'exécute
 * SERVEUR (clé API jamais exposée) ; le dernier état réel est enregistré
 * dans live_config (last_state / last_checked_at) pour l'affichage de la
 * rédaction. Aucune écriture autre que la trace d'état.
 */

const idle: DetectDirectState = {
  ok: false,
  status: null,
  videoId: null,
  title: null,
  message: "",
};

const STATUS_BADGES: Record<
  string,
  { label: string; className: string }
> = {
  live: {
    label: "DIRECT CONFIRMÉ",
    className: "bg-guinea-green/10 text-guinea-green border-guinea-green/40",
  },
  none: {
    label: "PAS DE DIRECT",
    className: "bg-neutral-100 text-neutral-600 border-neutral-300 dark:bg-white/5 dark:text-neutral-300 dark:border-white/15",
  },
  unconfigured: {
    label: "CLÉ API MANQUANTE",
    className: "bg-amber-500/10 text-amber-600 border-amber-500/40",
  },
  error: {
    label: "ERREUR — NOUVEL ESSAI PLUS TARD",
    className: "bg-guinea-red/10 text-guinea-red border-guinea-red/40",
  },
};

export default function DirectDetectForm({ config }: { config: LiveConfig }) {
  const [state, formAction] = useActionState(testDirectDetection, idle);

  const badge = state.status ? STATUS_BADGES[state.status] : null;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.message && (
        <div
          role={state.ok && state.status !== "error" ? "status" : "alert"}
          className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-100 px-4 py-3 text-sm font-medium dark:border-white/10 dark:bg-white/5"
        >
          {badge && (
            <span className={`rounded-full border px-3 py-0.5 text-[11px] font-extrabold tracking-wide ${badge.className}`}>
              {badge.label}
            </span>
          )}
          {state.message}
          {state.videoId && state.status === "live" && (
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              (vidéo {state.videoId}
              {state.title ? ` — « ${state.title} »` : ""})
            </span>
          )}
        </div>
      )}

      {!state.message && !badge && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {config.lastState && config.lastCheckedAt
            ? `Dernier état enregistré : ${config.lastState} (vérifié le ${new Date(
                config.lastCheckedAt
              ).toLocaleString("fr-FR")}).`
            : "Aucun test de détection enregistré pour le moment."}
        </p>
      )}

      <button
        type="submit"
        className="inline-flex w-fit items-center gap-2 rounded-xl border border-neutral-300 px-5 py-2.5 text-sm font-bold transition-colors hover:border-guinea-red hover:text-guinea-red dark:border-white/15"
      >
        <RefreshCw className="h-4 w-4" />
        Tester la détection maintenant
      </button>
    </form>
  );
}
