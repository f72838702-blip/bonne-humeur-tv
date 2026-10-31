"use client";

import { useActionState } from "react";
import type { RequestStatus } from "@/lib/types";
import { setRequestStatus } from "@/lib/actions/admin";
import { FormMessage, SubmitButton, idleActionState, inputClass, labelClass } from "./form-ui";

/**
 * Traitement d'une demande (partenariat B2B ou message de contact) :
 * statut new → processing → treated + note interne facultative.
 */
export default function RequestStatusForm({
  type,
  id,
  status,
  adminNote,
}: {
  type: "partnership" | "contact";
  id: string;
  status: RequestStatus;
  adminNote: string | null;
}) {
  const [state, formAction] = useActionState(setRequestStatus, idleActionState);

  return (
    <form action={formAction} className="flex flex-col gap-3 border-t border-neutral-200 pt-3 dark:border-white/10">
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="id" value={id} />

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-40">
          <label htmlFor={`status-${id}`} className={labelClass}>
            Statut de traitement
          </label>
          <select id={`status-${id}`} name="status" defaultValue={status} className={inputClass}>
            <option value="new">Nouveau</option>
            <option value="processing">En cours</option>
            <option value="treated">Traité</option>
          </select>
        </div>
        <SubmitButton label="Enregistrer" pendingLabel="…" className="mb-0.5" />
      </div>

      <div>
        <label htmlFor={`note-${id}`} className={labelClass}>
          Note interne (1000 max — jamais affichée publiquement)
        </label>
        <textarea
          id={`note-${id}`}
          name="admin_note"
          rows={2}
          maxLength={1000}
          defaultValue={adminNote ?? ""}
          placeholder="Suivi, rappels, décision…"
          className={inputClass}
        />
      </div>

      <FormMessage state={state} />
    </form>
  );
}