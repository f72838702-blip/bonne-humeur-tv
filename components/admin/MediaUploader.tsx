"use client";

import { useActionState } from "react";
import { uploadMediaAction } from "@/lib/actions/admin";
import { FormMessage, SubmitButton, idleActionState } from "./form-ui";

/**
 * Téléversement d'image (médiathèque Supabase Storage).
 * Validation MIME/taille réelle côté serveur ; le succès n'est affiché
 * qu'après confirmation du stockage.
 */
export default function MediaUploader() {
  const [state, formAction] = useActionState(uploadMediaAction, idleActionState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input
        type="file"
        name="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        required
        className="block w-full cursor-pointer rounded-xl border border-neutral-300 bg-white p-2.5 text-sm text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-guinea-red/10 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-guinea-red dark:border-white/15 dark:bg-night-800 dark:text-neutral-300"
      />
      <p className="text-[11px] text-neutral-400">
        JPEG, PNG, WebP ou GIF — 5 Mo maximum. Le fichier est vérifié et renommé
        côté serveur avant stockage.
      </p>
      <SubmitButton label="Téléverser" pendingLabel="Téléversement…" />
      <FormMessage state={state} />
    </form>
  );
}