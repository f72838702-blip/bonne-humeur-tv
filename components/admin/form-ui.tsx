"use client";

import type { ActionState } from "@/lib/actions/helpers";
import { useFormStatus } from "react-dom";

/**
 * Primitives partagées des formulaires admin.
 * NB : ActionState est importé en `import type` uniquement — le module
 * helpers.ts (next/headers, crypto) ne doit jamais entrer dans le bundle client.
 */

/** État initial pour useActionState (valeur locale, bundle client uniquement). */
export const idleActionState: ActionState = { status: "idle", message: "" };

/** Erreur de champ sous l'input (texte exact renvoyé par le serveur). */
export function FieldError({
  errors,
  name,
}: {
  errors?: Record<string, string>;
  name: string;
}) {
  const message = errors?.[name];
  if (!message) return null;
  return <p className="mt-1 text-xs font-medium text-guinea-red">{message}</p>;
}

/** Message global du serveur — affiché tel quel, honnête dans tous les cas. */
export function FormMessage({ state }: { state: ActionState }) {
  if (state.status === "idle" || !state.message) return null;
  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      className={
        state.status === "error"
          ? "rounded-xl border border-guinea-red/40 bg-guinea-red/10 px-4 py-3 text-sm font-medium text-guinea-red"
          : "rounded-xl border border-guinea-green/40 bg-guinea-green/10 px-4 py-3 text-sm font-medium text-guinea-green"
      }
    >
      {state.message}
    </p>
  );
}

/** Bouton d'envoi — désactivé pendant la soumission (useFormStatus). */
export function SubmitButton({
  label,
  pendingLabel = "Enregistrement…",
  variant = "primary",
  className = "",
}: {
  label: string;
  pendingLabel?: string;
  variant?: "primary" | "danger" | "neutral";
  className?: string;
}) {
  const { pending } = useFormStatus();
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60";
  const variants = {
    primary: "bg-guinea-red text-white hover:bg-guinea-red/90",
    danger: "bg-guinea-red/10 text-guinea-red hover:bg-guinea-red/20 border border-guinea-red/40",
    neutral:
      "border border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-white/15 dark:text-neutral-200 dark:hover:bg-white/10",
  } as const;

  return (
    <button type="submit" disabled={pending} className={`${base} ${variants[variant]} ${className}`}>
      {pending ? pendingLabel : label}
    </button>
  );
}

/** Label + champs : styles communs des inputs admin. */
export const inputClass =
  "w-full rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-guinea-red dark:border-white/15 dark:bg-night-800 dark:text-neutral-100";

export const labelClass =
  "mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400";