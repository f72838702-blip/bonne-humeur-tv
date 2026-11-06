"use client";

import { useActionState, useEffect, useState } from "react";
import type { ActionState } from "@/lib/actions/helpers";
import { submitContact } from "@/lib/actions/public-forms";
import TurnstileClient from "@/components/shared/TurnstileClient";
import { firstErrorFieldId } from "@/lib/form-errors";

/**
 * Formulaire de contact — validation UNIQUEMENT côté serveur (Server
 * Action + Zod). Le message de succès n'est JAMAIS affiché localement :
 * il ne provient que de la confirmation du serveur.
 * Anti-spam : honeypot « website » + rate limiting en base + Turnstile
 * (si configuré — le widget s'affiche alors automatiquement).
 *
 * CONSERVATION DES DONNÉES (même cause corrigée que le formulaire de
 * partenariat) : tous les champs sont contrôlés — un refus serveur
 * (champ manquant, invalide, captcha, quota, erreur réseau) ne vide
 * AUCUNE valeur saisie ; le formulaire est effacé uniquement après une
 * confirmation d'envoi. Le visiteur est positionné sur le premier champ
 * fautif, sans rien devoir retaper.
 */

// État initial : import de type uniquement, la valeur est locale
// (le module helpers embarque du code serveur non bundlable client).
const initialState: ActionState = { status: "idle", message: "" };

const inputClass =
  "w-full rounded-xl border border-neutral-300 bg-surface px-4 py-3 text-sm outline-none transition-colors placeholder:text-neutral-400 focus:border-guinea-red focus:ring-2 focus:ring-guinea-red/20 dark:border-white/15 dark:bg-night-900";

/** Bordure rouge permanente tant que le champ est fautif (aria-invalid lié). */
const invalidClass = "border-guinea-red";

/** Champ Zod → id d'élément : défilement automatique au 1er champ fautif. */
const ID_BY_FIELD: Record<string, string> = {
  name: "contact-name",
  email: "contact-email",
  phone: "contact-phone",
  subject: "contact-subject",
  message: "contact-message",
  consent: "contact-consent",
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-guinea-red">{message}</p>;
}

export default function ContactForm() {
  const [state, formAction, pending] = useActionState(submitContact, initialState);
  const [dismissed, setDismissed] = useState(false);

  // Valeurs contrôlées — un refus serveur ne les efface jamais.
  const [nameValue, setNameValue] = useState("");
  const [emailValue, setEmailValue] = useState("");
  const [phoneValue, setPhoneValue] = useState("");
  const [subjectValue, setSubjectValue] = useState("");
  const [messageValue, setMessageValue] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);

  // Remise à zéro UNIQUEMENT après confirmation serveur.
  useEffect(() => {
    if (state.status !== "success") return;
    setNameValue("");
    setEmailValue("");
    setPhoneValue("");
    setSubjectValue("");
    setMessageValue("");
    setConsentChecked(false);
  }, [state]);

  // Positionner le visiteur sur le PREMIER champ fautif au refus.
  useEffect(() => {
    if (state.status !== "error" || !state.fieldErrors) return;
    const id = firstErrorFieldId(state.fieldErrors, ID_BY_FIELD);
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    if (el instanceof HTMLElement) {
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
        <span className="text-4xl">✅</span>
        <h3 className="font-display text-xl font-bold">Message bien reçu !</h3>
        <p className="max-w-md text-sm text-neutral-500 dark:text-neutral-400">
          {state.message}
        </p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="mt-2 rounded-full border border-neutral-300 px-6 py-2.5 text-sm font-semibold transition-colors hover:border-guinea-red hover:text-guinea-red dark:border-white/20"
        >
          Envoyer un autre message
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
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
          <label htmlFor="contact-name" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">
            Nom complet *
          </label>
          <input
            id="contact-name"
            name="name"
            placeholder="Votre nom"
            className={`${inputClass} ${fieldErrors?.name ? invalidClass : ""}`}
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            aria-invalid={fieldErrors?.name ? true : undefined}
          />
          <FieldError message={fieldErrors?.name} />
        </div>
        <div>
          <label htmlFor="contact-email" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">
            Email *
          </label>
          <input
            id="contact-email"
            name="email"
            type="email"
            placeholder="vous@exemple.com"
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
          <label htmlFor="contact-phone" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">
            Téléphone / WhatsApp
          </label>
          <input
            id="contact-phone"
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
          <label htmlFor="contact-subject" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">
            Sujet *
          </label>
          <input
            id="contact-subject"
            name="subject"
            placeholder="Objet de votre message"
            className={`${inputClass} ${fieldErrors?.subject ? invalidClass : ""}`}
            value={subjectValue}
            onChange={(e) => setSubjectValue(e.target.value)}
            aria-invalid={fieldErrors?.subject ? true : undefined}
          />
          <FieldError message={fieldErrors?.subject} />
        </div>
      </div>

      <div>
        <label htmlFor="contact-message" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">
          Votre message *
        </label>
        <textarea
          id="contact-message"
          name="message"
          rows={5}
          placeholder="Écrivez votre message (10 caractères minimum)…"
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
            id="contact-consent"
            type="checkbox"
            name="consent"
            className="mt-0.5 h-4 w-4 accent-guinea-red"
            checked={consentChecked}
            onChange={(e) => setConsentChecked(e.target.checked)}
            aria-invalid={fieldErrors?.consent ? true : undefined}
          />
          <span>
            J&apos;accepte que mes données soient utilisées pour traiter ma
            demande, conformément à la{" "}
            <a href="/confidentialite" className="underline underline-offset-2 hover:text-guinea-red">
              politique de confidentialité
            </a>
            . *
          </span>
        </label>
        <FieldError message={fieldErrors?.consent} />
      </div>

      <TurnstileClient actionState={state} />

      {/* Annonce d'erreur accessible (role=alert) — détails sous chaque champ. */}
      {state.status === "error" && (
        <p role="alert" className="rounded-xl bg-guinea-red/10 px-4 py-3 text-sm font-medium text-guinea-red">
          {state.message}
        </p>
      )}

      {/* disabled={pending} : aucune double soumission accidentelle. */}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-guinea-red px-7 py-3.5 text-sm font-bold text-white shadow-glow transition-all hover:scale-[1.02] disabled:opacity-60"
      >
        {pending ? "Envoi en cours…" : "Envoyer"}
      </button>
    </form>
  );
}