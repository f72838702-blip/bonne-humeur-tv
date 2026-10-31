"use client";

import { useActionState } from "react";
import type { BreakingNewsItem } from "@/lib/types";
import { saveBreakingNews } from "@/lib/actions/content";
import { FieldError, FormMessage, SubmitButton, idleActionState, inputClass, labelClass } from "./form-ui";

/**
 * Flash-info (bandeau défilant) — création ou édition.
 * La période de diffusion est contrôlée par start_at/end_at côté serveur.
 */

function toLocalInput(iso: string | null): string {
  return iso ? iso.slice(0, 16) : "";
}

export default function FlashNewsForm({ item }: { item?: BreakingNewsItem }) {
  const [state, formAction] = useActionState(saveBreakingNews, idleActionState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {item && <input type="hidden" name="id" value={item.id} />}

      <FormMessage state={state} />

      <div>
        <label htmlFor={`content-${item?.id ?? "new"}`} className={labelClass}>
          Texte du flash-info * (200 max)
        </label>
        <input
          id={`content-${item?.id ?? "new"}`}
          name="content"
          type="text"
          required
          minLength={5}
          maxLength={200}
          defaultValue={item?.content ?? ""}
          placeholder="⚠ L'information à diffuser en urgence…"
          className={inputClass}
        />
        <FieldError errors={state.fieldErrors} name="content" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`link-${item?.id ?? "new"}`} className={labelClass}>
            Lien interne (facultatif)
          </label>
          <input
            id={`link-${item?.id ?? "new"}`}
            name="link"
            type="url"
            maxLength={300}
            defaultValue={item?.link ?? ""}
            placeholder="https://bonne-humeur-tv.vercel.app/actualites/…"
            className={inputClass}
          />
          <FieldError errors={state.fieldErrors} name="link" />
        </div>
        <div>
          <label htmlFor={`position-${item?.id ?? "new"}`} className={labelClass}>
            Ordre d’affichage (0–999)
          </label>
          <input
            id={`position-${item?.id ?? "new"}`}
            name="position"
            type="number"
            min={0}
            max={999}
            defaultValue={item?.position ?? 0}
            className={inputClass}
          />
          <FieldError errors={state.fieldErrors} name="position" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`start-${item?.id ?? "new"}`} className={labelClass}>
            Début de diffusion
          </label>
          <input
            id={`start-${item?.id ?? "new"}`}
            name="start_at"
            type="datetime-local"
            defaultValue={toLocalInput(item?.start_at ?? null)}
            className={inputClass}
          />
          <FieldError errors={state.fieldErrors} name="start_at" />
        </div>
        <div>
          <label htmlFor={`end-${item?.id ?? "new"}`} className={labelClass}>
            Fin de diffusion
          </label>
          <input
            id={`end-${item?.id ?? "new"}`}
            name="end_at"
            type="datetime-local"
            defaultValue={toLocalInput(item?.end_at ?? null)}
            className={inputClass}
          />
          <FieldError errors={state.fieldErrors} name="end_at" />
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={item?.is_active ?? true}
          className="h-4 w-4 accent-guinea-red"
        />
        Flash-info actif (visible sur le site pendant sa période)
      </label>

      <SubmitButton
        label={item ? "Enregistrer les modifications" : "Publier le flash-info"}
        pendingLabel="Enregistrement…"
      />
    </form>
  );
}