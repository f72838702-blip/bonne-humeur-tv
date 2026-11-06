"use client";

import { useActionState, useEffect, useState } from "react";
import type { ActionState } from "@/lib/actions/helpers";
import { submitPartnership } from "@/lib/actions/public-forms";
import TurnstileClient from "@/components/shared/TurnstileClient";
import { firstErrorFieldId } from "@/lib/form-errors";

/**
 * Formulaire de demande de devis B2B — validation 100 % serveur
 * (Server Action + Zod), succès uniquement après confirmation serveur.
 * Anti-spam : honeypot + rate limiting en base + Turnstile (optionnel).
 *
 * CONSERVATION DES DONNÉES (règle fondamentale) : tous les champs de
 * saisie sont CONTRÔLÉS par React. Conduite de React 19 : une soumission
 * d'action réinitialise les champs non contrôlés — ce qui vidait TOUTE
 * la demande dès qu'un champ était refusé. Désormais :
 *   • un refus serveur (champ manquant, invalide, captcha, quota,
 *     erreur réseau) ne touche à AUCUNE valeur saisie ;
 *   • le formulaire n'est vidé qu'après une confirmation serveur.
 */

const initialState: ActionState = { status: "idle", message: "" };

const inputClass =
  "w-full rounded-xl border border-neutral-300 bg-surface px-4 py-3 text-sm outline-none transition-colors placeholder:text-neutral-400 focus:border-guinea-red focus:ring-2 focus:ring-guinea-red/20 dark:border-white/15 dark:bg-night-900 dark:focus:border-guinea-red";

/** Bordure rouge permanente tant que le champ est fautif (aria-invalid lié). */
const invalidClass = "border-guinea-red";

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

/** Champ Zod → id d'élément : défilement automatique au 1er champ fautif. */
const ID_BY_FIELD: Record<string, string> = {
  organisation: "part-organisation",
  contact_name: "part-contact-name",
  fonction: "part-fonction",
  email: "part-email",
  phone: "part-phone",
  service: "part-service",
  budget: "part-budget",
  timeline: "part-timeline",
  message: "part-message",
  consent: "part-consent",
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-guinea-red">{message}</p>;
}

export default function PartnershipForm() {
  const [state, formAction, pending] = useActionState(submitPartnership, initialState);
  const [dismissed, setDismissed] = useState(false);

  // Valeurs contrôlées — la source de vérité est le visiteur, un refus
  // serveur ne les efface jamais.
  const [organisationValue, setOrganisationValue] = useState("");
  const [contactNameValue, setContactNameValue] = useState("");
  const [fonctionValue, setFonctionValue] = useState("");
  const [emailValue, setEmailValue] = useState("");
  const [phoneValue, setPhoneValue] = useState("");
  const [serviceValue, setServiceValue] = useState("");
  const [budgetValue, setBudgetValue] = useState("");
  const [timelineValue, setTimelineValue] = useState("");
  const [messageValue, setMessageValue] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);

  // Remise à zéro UNIQUEMENT après un envoi confirmé par le serveur.
  useEffect(() => {
    if (state.status !== "success") return;
    setOrganisationValue("");
    setContactNameValue("");
    setFonctionValue("");
    setEmailValue("");
    setPhoneValue("");
    setServiceValue("");
    setBudgetValue("");
    setTimelineValue("");
    setMessageValue("");
    setConsentChecked(false);
  }, [state]);

  // Un refus positionne le visiteur sur le PREMIER champ fautif — il
  // corrige sans rechercher, tout le reste reste saisi.
  useEffect(() => {
    if (state.status !== "error" || !state.fieldErrors) return;
    const id = firstErrorFieldId(state.fieldErrors, ID_BY_FIELD);
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    if (el instanceof HTMLElement && !(el instanceof HTMLInputElement && el.type === "hidden")) {
      el.focus({ preventScroll: true });
    }
  }, [state]);

  const fieldErrors = state.fieldErrors;

  const success = state.status === "success" && !dismissed;

  if (success) {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-4 rounded-2xl border border-guinea-green/30 bg-guinea-green/5 px-6 py-12 text-center"
      >
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
      className="grid gap-4 rounded-2xl border border-neutral-200 bg-surface p-6 dark:border-white/10 dark:bg-night-800 sm:p-8"
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
          <input
            id="part-organisation"
            name="organisation"
            placeholder="Ex. Ministère de…, SARL…"
            className={`${inputClass} ${fieldErrors?.organisation ? invalidClass : ""}`}
            value={organisationValue}
            onChange={(e) => setOrganisationValue(e.target.value)}
            aria-invalid={fieldErrors?.organisation ? true : undefined}
          />
          <FieldError message={fieldErrors?.organisation} />
        </div>
        <div>
          <label htmlFor="part-contact-name" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">
            Nom du contact *
          </label>
          <input
            id="part-contact-name"
            name="contact_name"
            placeholder="Votre nom complet"
            className={`${inputClass} ${fieldErrors?.contact_name ? invalidClass : ""}`}
            value={contactNameValue}
            onChange={(e) => setContactNameValue(e.target.value)}
            aria-invalid={fieldErrors?.contact_name ? true : undefined}
          />
          <FieldError message={fieldErrors?.contact_name} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="part-fonction" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">
            Fonction
          </label>
          <input
            id="part-fonction"
            name="fonction"
            placeholder="Ex. Directeur de la communication"
            className={`${inputClass} ${fieldErrors?.fonction ? invalidClass : ""}`}
            value={fonctionValue}
            onChange={(e) => setFonctionValue(e.target.value)}
            aria-invalid={fieldErrors?.fonction ? true : undefined}
          />
          <FieldError message={fieldErrors?.fonction} />
        </div>
        <div>
          <label htmlFor="part-email" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">
            Email professionnel *
          </label>
          <input
            id="part-email"
            name="email"
            type="email"
            placeholder="vous@organisation.gn"
            className={`${inputClass} ${fieldErrors?.email ? invalidClass : ""}`}
            value={emailValue}
            onChange={(e) => setEmailValue(e.target.value)}
            aria-invalid={fieldErrors?.email ? true : undefined}
          />
          <FieldError message={fieldErrors?.email} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="part-phone" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">
            Téléphone / WhatsApp
          </label>
          <input
            id="part-phone"
            name="phone"
            type="tel"
            placeholder="+224 … (facultatif)"
            className={`${inputClass} ${fieldErrors?.phone ? invalidClass : ""}`}
            value={phoneValue}
            onChange={(e) => setPhoneValue(e.target.value)}
            aria-invalid={fieldErrors?.phone ? true : undefined}
          />
          <FieldError message={fieldErrors?.phone} />
        </div>
        <div>
          <label htmlFor="part-service" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">
            Prestation souhaitée *
          </label>
          <select
            id="part-service"
            name="service"
            className={`${inputClass} ${fieldErrors?.service ? invalidClass : ""}`}
            value={serviceValue}
            onChange={(e) => setServiceValue(e.target.value)}
            aria-invalid={fieldErrors?.service ? true : undefined}
          >
            <option value="" disabled>
              Sélectionnez…
            </option>
            {SERVICE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <FieldError message={fieldErrors?.service} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="part-budget" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">
            Budget estimé (GNF)
          </label>
          <select
            id="part-budget"
            name="budget"
            className={`${inputClass} ${fieldErrors?.budget ? invalidClass : ""}`}
            value={budgetValue}
            onChange={(e) => setBudgetValue(e.target.value)}
            aria-invalid={fieldErrors?.budget ? true : undefined}
          >
            <option value="">Non précisé</option>
            {BUDGET_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <FieldError message={fieldErrors?.budget} />
        </div>
        <div>
          <label htmlFor="part-timeline" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">
            Calendrier envisagé
          </label>
          <input
            id="part-timeline"
            name="timeline"
            placeholder="Ex. T3 2026, dès que possible…"
            className={`${inputClass} ${fieldErrors?.timeline ? invalidClass : ""}`}
            value={timelineValue}
            onChange={(e) => setTimelineValue(e.target.value)}
            aria-invalid={fieldErrors?.timeline ? true : undefined}
          />
          <FieldError message={fieldErrors?.timeline} />
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
          className={`${inputClass} ${fieldErrors?.message ? invalidClass : ""}`}
          value={messageValue}
          onChange={(e) => setMessageValue(e.target.value)}
          aria-invalid={fieldErrors?.message ? true : undefined}
        />
        <FieldError message={fieldErrors?.message} />
      </div>

      <div>
        <label className="flex items-start gap-3 text-sm text-neutral-600 dark:text-neutral-300">
          <input
            id="part-consent"
            type="checkbox"
            name="consent"
            className="mt-0.5 h-4 w-4 accent-guinea-red"
            checked={consentChecked}
            onChange={(e) => setConsentChecked(e.target.checked)}
            aria-invalid={fieldErrors?.consent ? true : undefined}
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
        <FieldError message={fieldErrors?.consent} />
      </div>

      <TurnstileClient actionState={state} />

      {/* Annonce d'erreur accessible : lue immédiatement par les lecteurs
          d'écran ; les détails vivent déjà SOUS chaque champ fautif. */}
      {state.status === "error" && (
        <p role="alert" className="rounded-xl bg-guinea-red/10 px-4 py-3 text-sm font-medium text-guinea-red">
          {state.message}
        </p>
      )}

      {/* disabled={pending} : aucune double soumission accidentelle. */}
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