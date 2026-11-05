"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { extractYouTubeId } from "@/lib/youtube/url";
import { saveDirectConfig, type SaveDirectState } from "@/lib/actions/direct";
import type { LiveConfig } from "@/lib/direct/core";
import DirectLivePlayer from "@/components/home/DirectLivePlayer";
import { inputClass, labelClass } from "./form-ui";

/**
 * Formulaire de configuration du direct (page /admin/direct) :
 * • activation + mode (auto = détection YouTube confirmée par API,
 *   manual = lien posé par la rédaction — secours sans clé ni quota,
 *   off = détecteur coupé) ;
 * • champ facultatif « lien du direct précis » (mode manual) +
 *   « rediffusion » (toujours affichée comme UNE REDIFFUSION, jamais
 *   comme un direct) ;
 * • PRÉVISUALISATION immédiate du lecteur (le clic du prévisualisation
 *   ne contacte YouTube que sur un choix explicite, comme en public) ;
 * • toute normalisation passe par extractYouTubeId (URL YouTube ou ID
 *   à 11 caractères) — une URL externe est refusée.
 */

const MODES: { value: "auto" | "manual" | "off"; label: string; hint: string }[] = [
  {
    value: "auto",
    label: "Détection automatique",
    hint: "Le lecteur n'apparaît que si YouTube confirme un direct (clé API requise).",
  },
  {
    value: "manual",
    label: "Lien posé par la rédaction",
    hint: "La rédaction colle l'adresse du direct en cours — aucun quota, main-tenue manuellement.",
  },
  {
    value: "off",
    label: "Désactivé",
    hint: "Aucun lecteur automatique (présentation de la chaîne seule).",
  },
];

const idle: SaveDirectState = { ok: true, message: "" };

export default function DirectSettingsForm({ config }: { config: LiveConfig }) {
  const [state, formAction] = useActionState(saveDirectConfig, idle);
  const [mode, setMode] = useState(config.mode);
  const [enabled, setEnabled] = useState(config.enabled);
  const [manualRaw, setManualRaw] = useState(
    config.manualVideoId ? `https://www.youtube.com/watch?v=${config.manualVideoId}` : ""
  );
  const manualId = extractYouTubeId(manualRaw);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state.message && (
        <p
          role={state.ok ? "status" : "alert"}
          className={
            state.ok
              ? "rounded-xl border border-guinea-green/40 bg-guinea-green/10 px-4 py-3 text-sm font-medium text-guinea-green"
              : "rounded-xl border border-guinea-red/40 bg-guinea-red/10 px-4 py-3 text-sm font-medium text-guinea-red"
          }
        >
          {state.message}
        </p>
      )}

      {/* Activation de la rubrique */}
      <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-neutral-100 px-4 py-3 dark:bg-white/5">
        <input
          type="checkbox"
          name="enabled"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-5 w-5 accent-guinea-red"
        />
        <span className="text-sm font-semibold">
          Activer la rubrique « EN DIRECT » sur la page d&apos;accueil
        </span>
      </label>
      {!enabled && (
        <p className="-mt-3 text-xs text-neutral-500 dark:text-neutral-400">
          Rubrique inactive : AUCUN élément lié au direct n&apos;apparaît sur
          la page d&apos;accueil (module entièrement masqué).
        </p>
      )}

      {/* Mode */}
      <fieldset className="flex flex-col gap-2">
        <legend className={labelClass}>Mode de détection</legend>
        {MODES.map((m) => (
          <label
            key={m.value}
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-neutral-200 px-4 py-3 dark:border-white/10"
          >
            <input
              type="radio"
              name="mode"
              value={m.value}
              checked={mode === m.value}
              onChange={() => setMode(m.value)}
              className="mt-0.5 h-4 w-4 accent-guinea-red"
            />
            <span>
              <span className="block text-sm font-bold">{m.label}</span>
              <span className="block text-xs text-neutral-500 dark:text-neutral-400">
                {m.hint}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      {/* Lien du direct (manuel) */}
      <div>
        <label htmlFor="manual_url" className={labelClass}>
          Lien du direct précis (facultatif — requis en mode manuel)
        </label>
        <input
          id="manual_url"
          name="manual_url"
          type="text"
          value={manualRaw}
          onChange={(e) => setManualRaw(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=YYYYYYYYYYY  (ou youtu.be, /live/…)"
          className={`${inputClass} mt-1`}
        />
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          {manualRaw && !manualId
            ? "Lien non reconnu : seul un lien YouTube (watch, youtu.be, /live/, /embed/) ou un identifiant à 11 caractères est accepté."
            : "Existe-t-il un direct ? Collez ici son adresse exacte. Une URL externe à YouTube est refusée."}
        </p>
      </div>

      {/* Rediffusion */}
      <div>
        <label htmlFor="replay_url" className={labelClass}>
          Lien de rediffusion (facultatif — présenté distinctement, jamais
          comme un direct)
        </label>
        <input
          id="replay_url"
          name="replay_url"
          type="text"
          defaultValue={
            config.replayVideoId
              ? `https://www.youtube.com/watch?v=${config.replayVideoId}`
              : ""
          }
          placeholder="https://www.youtube.com/watch?v=YYYYYYYYYYY"
          className={`${inputClass} mt-1`}
        />
      </div>

      {/* Prévisualisation — uniquement si un identifiant à 11 caractères est valide */}
      {(mode === "manual" || config.mode === "manual") && manualId && (
        <div className="rounded-xl border border-neutral-200 p-4 dark:border-white/10">
          <p className="mb-3 text-xs font-extrabold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
            Prévisualisation du lecteur public
          </p>
          <div className="max-w-xl">
            <DirectLivePlayer videoId={manualId} title={null} isLive={true} />
          </div>
        </div>
      )}

      <SaveBar />
    </form>
  );
}

function SaveBar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-xl bg-guinea-red px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-guinea-red/90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Enregistrement…" : "Enregistrer la configuration"}
    </button>
  );
}
