"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/actions/helpers";
import { FormMessage, SubmitButton, idleActionState } from "./form-ui";

/**
 * Suppression avec confirmation intégrée (<details>, pas d'alert JS) :
 * le message d'erreur réel du serveur (ex : « catégorie utilisée »)
 * est affiché tel quel sous le bouton.
 */
export default function DeleteActionForm({
  action,
  hiddenFields,
  confirmLabel,
  buttonLabel = "Supprimer",
  pendingLabel = "Suppression…",
  tone = "red",
}: {
  /** Server Action (formData) => ActionState, ex : deleteArticle. */
  action: (formData: FormData) => Promise<ActionState>;
  /** Champs cachés transmis (ex : id, path). */
  hiddenFields: Record<string, string>;
  confirmLabel: string;
  buttonLabel?: string;
  pendingLabel?: string;
  /** red = destruction (par défaut) ; green = action constructive (publier). */
  tone?: "red" | "green";
}) {
  const [state, formAction] = useActionState(
    async (_prev: ActionState, formData: FormData) => action(formData),
    idleActionState
  );

  const summaryTone =
    tone === "green"
      ? "text-guinea-green hover:bg-guinea-green/10"
      : "text-guinea-red hover:bg-guinea-red/10";

  return (
    <details className="group relative inline-block text-left">
      <summary className={`inline-flex cursor-pointer list-none items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition-colors ${summaryTone}`}>
        {buttonLabel}
      </summary>
      <div className={`absolute z-10 mt-2 w-72 rounded-xl border bg-white p-4 shadow-lg dark:bg-night-800 ${tone === "green" ? "border-guinea-green/40" : "border-guinea-red/40"}`}>
        <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">{confirmLabel}</p>
        <form action={formAction} className="mt-3">
          {Object.entries(hiddenFields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <SubmitButton
            label={tone === "green" ? "Confirmer la publication" : "Confirmer la suppression"}
            pendingLabel={pendingLabel}
            variant={tone === "green" ? "success" : "danger"}
          />
        </form>
        {state.status !== "idle" && <div className="mt-3"><FormMessage state={state} /></div>}
      </div>
    </details>
  );
}