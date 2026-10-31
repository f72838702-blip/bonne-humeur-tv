"use client";

import { useActionState, useState } from "react";
import type { ActionState } from "@/lib/actions/helpers";
import { submitPartnership } from "@/lib/actions/public-forms";
import TurnstileClient from "@/components/shared/TurnstileClient";

/**
 * Formulaire de demande de devis B2B — validation 100 % serveur
 * (Server Action + Zod), succès uniquement après confirmation serveur.
 * Anti-spam : honeypot + rate limiting en base + Turnstile (optionnel).
 */

const initialState: ActionState = { status: "idle", message: "" };

const inputClass =
  "w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition-colors placeholder:text-neutral-400 focus:border-guinea-red focus:ring-2 focus:ring-guinea-red/20 dark:border-white/15 dark:bg-night-900 dark:focus:border-guinea-red";

const SERVICE_OPTIONS = [
  { value: "couverture", label: "Couverture médiatique" },
  { value: "interview", label: "Interview / Portrait" },
  { value: "production", label: "Production audiovisuelle" },
  { value: "digitale", label: "Communication digitale" },
  { value: "autre", label: "Autre prestation" },
];

const BUDGET_OPTIONS = [
  { value: "lt5m", label: "Moins de 5 millions GNF" },
  { value: "5-15m", label: "5 à 15 millions GNF" },
  { value: "15-50m", label: "15 à 50 millions GNF" },
  { value: "gt50m", label: "Plus de 50 millions GNF" },
  { value: "unknown", label: "À discuter" },
];

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-guinea-red">{message}</p>;
}

export default function PartnershipForm() {
  const [state, formAction, pending] = useActionState(submitPartnership, initialState);
  const [dismissed, setDismissed] = useState(false);

  const success = state.status === "success" && !dismissed;

  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-guinea-green/30 bg-guinea-green/5 px-6 py-12 text-center">
        <span className="text-4xl">🤝</span>
        <h3 className="font-display text-xl font-bold">Demande envoyée !</h3>
        <p className="max-w-md text-sm text-neutral-500 dark:text-neutral-400">
          {state.message}
        </p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="mt-2 rounded-full border border-neutral-300 px-6 py-2.5 text-sm font-semibold transition-colors hover:border-guinea-red hover:text-guinea-red dark:border-white/20"
        >
          Envoyer une autre demande
        </button>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="grid gap-4 rounded-2xl border border-neutral-200 bg-white p-6 dark:border-white/10 dark:bg-night-800 sm:p-8"
      noValidate
    >
      {/* Honeypot anti-bots : invisible pour les humains */}
      <input
        type="text"
        name="website"
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="part-organisation" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">
            Organisation / Entreprise *
          </label>
          <input id="part-organisation" name="organisation" placeholder="Ex. Ministère de…, SARL…" className={inputClass} />
          <FieldError message={state.fieldErrors?.organisation} />
        </div>
        <div>
          <label htmlFor="part-contact-name" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">
            Nom du contact *
          </label>
          <input id="part-contact-name" name="contact_name" placeholder="Votre nom complet" className={inputClass} />
          <FieldError message={state.fieldErrors?.contact_name} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="part-fonction" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">
            Fonction
          </label>
          <input id="part-fonction" name="fonction" placeholder="Ex. Directeur de la communication" className={inputClass} />
          <FieldError message={state.fieldErrors?.fonction} />
        </div>
        <div>
          <label htmlFor="part-email" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">
            Email professionnel *
          </label>
          <input id="part-email" name="email" type="email" placeholder="vous@organisation.gn" className={inputClass} />
          <FieldError message={state.fieldErrors?.email} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="part-phone" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">
            Téléphone / WhatsApp
          </label>
          <input id="part-phone" name="phone" type="tel" placeholder="+224 … (facultatif)" className={inputClass} />
          <FieldError message={state.fieldErrors?.phone} />
        </div>
        <div>
          <label htmlFor="part-service" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">
            Prestation souhaitée *
          </label>
          <select id="part-service" name="service" defaultValue="" className={inputClass}>
            <option value="" disabled>
              Sélectionnez…
            </option>
            {SERVICE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <FieldError message={state.fieldErrors?.service} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="part-budget" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">
            Budget estimé (GNF)
          </label>
          <select id="part-budget" name="budget" defaultValue="" className={inputClass}>
            <option value="">Non précisé</option>
            {BUDGET_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <FieldError message={state.fieldErrors?.budget} />
        </div>
        <div>
          <label htmlFor="part-timeline" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">
            Calendrier envisagé
          </label>
          <input id="part-timeline" name="timeline" placeholder="Ex. T3 2026, dès que possible…" className={inputClass} />
          <FieldError message={state.fieldErrors?.timeline} />
        </div>
      </div>

      <div>
        <label htmlFor="part-message" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">
          Votre projet *
        </label>
        <textarea
          id="part-message"
          name="message"
          rows={4}
          placeholder="Décrivez votre besoin : contexte, objectifs, calendrier…"
          className={inputClass}
        />
        <FieldError message={state.fieldErrors?.message} />
      </div>

      <div>
        <label className="flex items-start gap-3 text-sm text-neutral-600 dark:text-neutral-300">
          <input
            type="checkbox"
            name="consent"
            className="mt-0.5 h-4 w-4 accent-guinea-red"
          />
          <span>
            J&apos;accepte que mes données soient utilisées pour traiter ma
            demande de devis, conformément à la{" "}
            <a href="/confidentialite" className="underline underline-offset-2 hover:text-guinea-red">
              politique de confidentialité
            </a>
            . *
          </span>
        </label>
        <FieldError message={state.fieldErrors?.consent} />
      </div>

      <TurnstileClient actionState={state} />

      {state.status === "error" && (
        <p className="rounded-xl bg-guinea-red/10 px-4 py-3 text-sm font-medium text-guinea-red">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-guinea-red px-8 py-4 text-sm font-bold text-white shadow-glow transition-all hover:scale-[1.02] disabled:opacity-60"
      >
        {pending ? "Envoi en cours…" : "Envoyer ma demande de devis"}
      </button>
    </form>
  );
}