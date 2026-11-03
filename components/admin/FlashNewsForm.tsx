"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import type { BreakingNewsItem } from "@/lib/types";
import { saveBreakingNews, renewBreakingNews } from "@/lib/actions/content";
import {
  classifyFlash,
  computeExpiry,
  DEFAULT_DURATION_MINUTES,
  DURATION_OPTIONS,
  formatConakryDateTime,
  formatConakryTime,
  humanizeDuration,
  isFlashLevel,
  parseConakryInput,
  type FlashLevel,
} from "@/lib/flash/flash-core";
import { FLASH_BANNER_STYLES } from "@/lib/flash/flash-style";
import {
  FieldError,
  FormMessage,
  SubmitButton,
  idleActionState,
  inputClass,
  labelClass,
} from "./form-ui";
import FlashCountdown from "./FlashCountdown";
import type { FlashLifecycle } from "@/lib/flash/flash-core";

/**
 * Flash Info (§2–§7 du cahier des charges) :
 *  • création : texte + niveau + DURÉE (menu déroulant) + programmation
 *    facultative — publier ou brouillon. La date de début/fin est
 *    CALCULÉE PAR LE SERVEUR (jamais saisie manuellement).
 *  • modification : dates affichées + temps restant ; le texte éditable
 *    ne RESET jamais la période (§7) ; prolongation/réactivation
 *    explicites (formulaire séparé, durée re-choisie).
 * L'horloge du navigateur ne sert qu'aux ESTIMATIONS affichées (« est. ») :
 * le calcul définitif est serveur.
 */

const LEVEL_CHOICES: FlashLevel[] = ["normal", "important", "urgent"];

/** Sélecteur de durée réutilisé (création, prolongation). */
function DurationSelect({
  value,
  onChange,
  id,
}: {
  value: number;
  onChange: (minutes: number) => void;
  id: string;
}) {
  return (
    <select
      id={id}
      name="duration_minutes"
      required
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={inputClass}
    >
      {DURATION_OPTIONS.map((option) => (
        <option key={option.minutes} value={option.minutes}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/**
 * Statut du flash calculé par l'HORLOGE SERVEUR au rendu + compte à
 * rebours client (30 s, indicatif). Les valeurs affichées (dates) viennent
 * de la base — jamais de recalcul local d'une décision.
 */
function FlashStatusLine({ item }: { item: BreakingNewsItem }) {
  const lifecycleNow = classifyFlash(
    new Date().toISOString(),
    item.is_active,
    item.start_at,
    item.end_at
  );

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600 dark:border-white/10 dark:bg-white/5 dark:text-neutral-300">
      {lifecycleNow === "scheduled" && item.start_at && (
        <>
          <span className="font-semibold">Programmé</span>
          <span>Diffusable à partir de {formatConakryDateTime(item.start_at)}</span>
          {item.end_at && <span>Fin prévue {formatConakryDateTime(item.end_at)}</span>}
        </>
      )}
      {lifecycleNow === "active" && item.end_at && (
        <>
          <span className="font-semibold">En diffusion</span>
          {item.start_at && <span>Début {formatConakryDateTime(item.start_at)}</span>}
          <span>Expiration {formatConakryDateTime(item.end_at)}</span>
          <FlashCountdown endIso={item.end_at} />
        </>
      )}
      {lifecycleNow === "active_no_expiry" && (
        <>
          <span className="font-semibold">En diffusion (sans expiration)</span>
          <span>Flash historique : durée non programmée</span>
        </>
      )}
      {lifecycleNow === "expired" && item.end_at && (
        <>
          <span className="font-semibold">Expiré</span>
          <span>Fin à {formatConakryDateTime(item.end_at)}</span>
        </>
      )}
      {lifecycleNow === "inactive" && (
        <>
          <span className="font-semibold">Brouillon / désactivé</span>
          <span>Non diffusé — utilisez la réactivation en dessous pour le rediffuser</span>
        </>
      )}
    </div>
  );
}

/** Sélecteur de durée + délai « Prolonger / Réactiver » (§7). */
function FlashRenewForm({ item }: { item: BreakingNewsItem }) {
  const [state, formAction] = useActionState(renewBreakingNews, idleActionState);
  const [mounted, setMounted] = useState(false);
  const [minutes, setMinutes] = useState(DEFAULT_DURATION_MINUTES);
  useEffect(() => setMounted(true), []);

  const lifecycle = mounted
    ? classifyFlash(new Date().toISOString(), item.is_active, item.start_at, item.end_at)
    : null;

  if (!mounted) return null;
  if (lifecycle === "scheduled") {
    return (
      <p className="mt-4 rounded-xl border border-guinea-yellow/40 bg-guinea-yellow/10 px-4 py-3 text-xs text-neutral-700 dark:text-neutral-200">
        Programmation en attente : le flash n&apos;est pas encore en diffusion.
        Pour changer sa durée, modifiez le texte puis publiez-le manuellement à l&apos;heure voulue, ou attendez le début programmé pour le prolonger.
      </p>
    );
  }
  const mode = lifecycle === "inactive" || lifecycle === "expired" ? "reactivate" : "extend";
  const baseIso = mode === "extend" ? new Date().toISOString() : new Date().toISOString();
  const endEstimate = computeExpiry(baseIso, minutes) ?? formatConakryTime(new Date().toISOString()) ?? "?";
  const isReactivate = mode === "reactivate";

  return (
    <form action={formAction} className="mt-4 rounded-xl border border-neutral-200 p-4 dark:border-white/10">
      <input type="hidden" name="id" value={item.id} />
      <input type="hidden" name="mode" value={mode} />
      {state.message && <FormMessage state={state} />}
      <div className="mb-3">
        <label htmlFor={`renew-durée-${item.id}`} className={labelClass}>
          {isReactivate ? "Durée de la nouvelle diffusion" : "Nouvelle durée (à partir de la confirmation)"}
        </label>
        <div className="sm:max-w-xs">
          <DurationSelect id={`renew-durée-${item.id}`} value={minutes} onChange={setMinutes} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton
          label={isReactivate ? "Réactiver la diffusion" : "Prolonger la diffusion"}
          pendingLabel="Traitement…"
          variant={isReactivate ? "success" : "neutral"}
        />
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          {isReactivate ? "Départ immédiat — " : "Expiration recalculée à partir de maintenant — "}
          fin estimée {mounted ? formatConakryTime(endEstimate) : "…"} (heure de Conakry).
        </span>
      </div>
    </form>
  );
}

export default function FlashNewsForm({ item }: { item?: BreakingNewsItem }) {
  const [state, formAction] = useActionState(saveBreakingNews, idleActionState);
  const [mounted, setMounted] = useState(false);
  const [minutes, setMinutes] = useState(DEFAULT_DURATION_MINUTES);
  const [level, setLevel] = useState<FlashLevel>("normal");
  const [scheduleOn, setScheduleOn] = useState(false);
  const [scheduleValue, setScheduleValue] = useState("");
  useEffect(() => setMounted(true), []);

  // ── ESTIMATIONS d'affichage (horloge du navigateur, honnête) ──
  const scheduleIso = mounted && scheduleOn ? parseConakryInput(scheduleValue) : null;
  const baseIsoEstimate = scheduleIso ?? (mounted ? new Date().toISOString() : null);
  const endEstimate = mounted && baseIsoEstimate ? computeExpiry(baseIsoEstimate, minutes) : null;
  const isScheduled = Boolean(scheduleIso);
  const levelStyles = FLASH_BANNER_STYLES[level];

  if (item) {
    // ═══ FORMULAIRE DE MODIFICATION (§7) ═══
    return (
      <>
        <form action={formAction} className="flex flex-col gap-4">
          {item.id && <input type="hidden" name="id" value={item.id} />}
          <input type="hidden" name="flash_intent" value="update" />

          <FormMessage state={state} />
          <FlashStatusLine item={item} />

          <div>
            <label htmlFor={`content-${item.id}`} className={labelClass}>
              Texte du Flash Info * (200 max)
            </label>
            <input
              id={`content-${item.id}`}
              name="content"
              type="text"
              required
              minLength={5}
              maxLength={200}
              defaultValue={item.content ?? ""}
              placeholder="⚠ L'information à diffuser en urgence…"
              className={inputClass}
            />
            <FieldError errors={state.fieldErrors} name="content" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`link-${item.id}`} className={labelClass}>
                Lien interne (facultatif)
              </label>
              <input
                id={`link-${item.id}`}
                name="link"
                type="url"
                maxLength={300}
                defaultValue={item.link ?? ""}
                placeholder="https://…/actualites/…"
                className={inputClass}
              />
              <FieldError errors={state.fieldErrors} name="link" />
            </div>
            <div>
              <label htmlFor={`position-${item.id}`} className={labelClass}>
                Ordre d&apos;affichage (0–999)
              </label>
              <input
                id={`position-${item.id}`}
                name="position"
                type="number"
                min={0}
                max={999}
                defaultValue={item.position ?? 0}
                className={inputClass}
              />
            </div>
          </div>

          <fieldset className="flex flex-wrap items-center gap-2">
            <legend className={labelClass}>Niveau</legend>
            {LEVEL_CHOICES.map((choice) => (
              <label
                key={choice}
                className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-neutral-300 px-3 py-1.5 text-xs font-semibold dark:border-white/15"
              >
                <input
                  type="radio"
                  name="level"
                  value={choice}
                  defaultChecked={(isFlashLevel(item.level) ? item.level : "normal") === choice}
                  className="h-3.5 w-3.5 accent-guinea-red"
                />
                {FLASH_BANNER_STYLES[choice].label}
              </label>
            ))}
          </fieldset>

          <div className="flex flex-wrap gap-3">
            <SubmitButton label="Enregistrer les modifications (période conservée)" />
          </div>
          <p className="text-[11px] text-neutral-400">
            La période de diffusion n&apos;est JAMAIS réinitialisée par une simple modification de texte.
            Pour l&apos;étendre : formulaire « Prolonger / Réactiver » ci-dessous.
          </p>
        </form>

        <FlashRenewForm item={item} />
      </>
    );
  }

  // ═══ FORMULAIRE DE CRÉATION (§2–§6) ═══
  return (
    <form action={formAction} className="flex flex-col gap-4">
      {/* Pas de caché pour l'intention : la valeur vient EXCLUSIVEMENT du bouton soumis (publish / draft) — un champ caché contiendrait la première valeur et masquerait le bouton. */}
      <FormMessage state={state} />
      <FieldError errors={state.fieldErrors} name="duration_minutes" />
      <FieldError errors={state.fieldErrors} name="schedule_start" />

      <div>
        <label htmlFor="flash-new-content" className={labelClass}>
          Message du Flash Info * (200 max)
        </label>
        <input
          id="flash-new-content"
          name="content"
          type="text"
          required
          minLength={5}
          maxLength={200}
          defaultValue=""
          placeholder="⚠ L'information à diffuser en urgence…"
          className={inputClass}
        />
        <FieldError errors={state.fieldErrors} name="content" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="flash-new-link" className={labelClass}>
            Lien interne (facultatif)
          </label>
          <input
            id="flash-new-link"
            name="link"
            type="url"
            maxLength={300}
            defaultValue=""
            placeholder="https://…/actualites/…"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="flash-new-position" className={labelClass}>
            Ordre d&apos;affichage (0–999)
          </label>
          <input
            id="flash-new-position"
            name="position"
            type="number"
            min={0}
            max={999}
            defaultValue={0}
            className={inputClass}
          />
        </div>
      </div>

      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className={labelClass}>Niveau</legend>
        {LEVEL_CHOICES.map((choice) => (
          <label
            key={choice}
            className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-neutral-300 px-3 py-1.5 text-xs font-semibold dark:border-white/15"
          >
            <input
              type="radio"
              name="level"
              value={choice}
              defaultChecked={choice === "normal"}
              onChange={() => setLevel(choice)}
              className="h-3.5 w-3.5 accent-guinea-red"
            />
            {FLASH_BANNER_STYLES[choice].label}
          </label>
        ))}
      </fieldset>

      <div>
        <label htmlFor="flash-new-duree" className={labelClass}>
          Durée de diffusion après publication *
        </label>
        <div className="sm:max-w-xs">
          <DurationSelect id="flash-new-duree" value={minutes} onChange={setMinutes} />
        </div>
      </div>

      {/* Programmation FACULTATIVE (§6) — jamais requise pour publier. */}
      <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold">
        <input
          type="checkbox"
          checked={scheduleOn}
          onChange={(e) => setScheduleOn(e.target.checked)}
          className="h-4 w-4 accent-guinea-red"
        />
        Programmer le Flash Info (facultatif — sinon publication immédiate)
      </label>
      {scheduleOn && (
        <div className="sm:max-w-xs">
          <label htmlFor="flash-new-schedule" className={labelClass}>
            Début de diffusion (heure de Conakry)
          </label>
          <input
            id="flash-new-schedule"
            name="schedule_start"
            type="datetime-local"
            step={60}
            value={scheduleValue}
            onChange={(e) => setScheduleValue(e.target.value)}
            className={inputClass}
          />
          <p className="mt-1 text-[11px] text-neutral-400">
            La durée démarre à L&apos;HEURE PROGRAMMÉE.
          </p>
        </div>
      )}

      {/* Prévisualisation dynamique (§4) — ESTIMATION navigateur :
          le calcul définitif est effectué par le serveur (§3). */}
      <div
        className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${levelStyles.band}`}
      >
        <span className="mr-2 text-[10px] font-extrabold uppercase tracking-widest opacity-80">
          {levelStyles.label}
        </span>
        {scheduleValue && isScheduled ? "Flash programmé" : "Flash à venir"}
      </div>
      {mounted && (
        <div className="rounded-xl border border-guinea-red/30 bg-guinea-red/5 px-4 py-3 text-sm text-neutral-700 dark:border-guinea-red/40 dark:text-neutral-200">
          <p className="font-semibold">
            Ce Flash Info sera diffusé pendant {humanizeDuration(minutes)}.
          </p>
          {endEstimate && baseIsoEstimate && (
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              {isScheduled
                ? `Publication prévue ${formatConakryDateTime(baseIsoEstimate)} — expiration estimée à ${formatConakryTime(endEstimate)} (Conakry).`
                : `Publication prévue maintenant — expiration estimée à ${formatConakryTime(endEstimate)} (heure de Conakry). Le serveur calcule la valeur définitive au clic.`}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <SubmitButton
          label="Publier le Flash Info"
          value="publish"
          name="flash_intent"
        />
        <SubmitButton label="Enregistrer comme brouillon" value="draft" name="flash_intent" variant="neutral" />
      </div>
    </form>
  );
}