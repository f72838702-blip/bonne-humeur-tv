"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Category, VideoWithRelations } from "@/lib/types";
import { saveVideo } from "@/lib/actions/content";
import { FieldError, FormMessage, SubmitButton, idleActionState, inputClass, labelClass } from "./form-ui";

/**
 * Fiche vidéo — l'ID YouTube doit être celui d'une VRAIE vidéo de la
 * chaîne (11 caractères). Le badge « direct » n'est coché que si un
 * direct réel est en cours : aucun faux direct ne peut exister.
 */

const STATUS_OPTIONS = [
  { value: "draft", label: "Brouillon" },
  { value: "published", label: "Publier" },
  { value: "archived", label: "Archiver" },
];

function toLocalInput(iso: string | null): string {
  return iso ? iso.slice(0, 16) : "";
}

export default function VideoForm({
  categories,
  video,
}: {
  categories: Pick<Category, "id" | "name" | "slug">[];
  video?: VideoWithRelations;
}) {
  const [state, formAction] = useActionState(saveVideo, idleActionState);
  const router = useRouter();

  useEffect(() => {
    if (state.status === "success" && state.redirectTo) {
      router.push(state.redirectTo);
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {video && <input type="hidden" name="id" value={video.id} />}

      <FormMessage state={state} />

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          <div>
            <label htmlFor="title" className={labelClass}>
              Titre *
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              minLength={3}
              maxLength={200}
              defaultValue={video?.title ?? ""}
              placeholder="Titre de l'émission / du reportage"
              className={inputClass}
            />
            <FieldError errors={state.fieldErrors} name="title" />
          </div>

          <div>
            <label htmlFor="youtube_id" className={labelClass}>
              ID YouTube *
            </label>
            <input
              id="youtube_id"
              name="youtube_id"
              type="text"
              required
              pattern="[A-Za-z0-9_-]{11}"
              maxLength={11}
              defaultValue={video?.youtube_id ?? ""}
              placeholder="dQw4w9WgXcQ"
              className={inputClass}
            />
            <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">
              Les 11 caractères de la fin de l’URL de la vidéo
              (https://www.youtube.com/watch?v=<strong>XXXXXXXXXXX</strong>).
              Collez UNIQUEMENT l’ID d’une vraie vidéo de la chaîne Bonne Humeur TV.
            </p>
            <FieldError errors={state.fieldErrors} name="youtube_id" />
          </div>

          <div>
            <label htmlFor="description" className={labelClass}>
              Description (2000 max)
            </label>
            <textarea
              id="description"
              name="description"
              rows={4}
              maxLength={2000}
              defaultValue={video?.description ?? ""}
              placeholder="Résumé de l'émission, invités, sujets traités…"
              className={inputClass}
            />
            <FieldError errors={state.fieldErrors} name="description" />
          </div>

          <div>
            <label htmlFor="slug" className={labelClass}>
              Slug (facultatif — généré depuis le titre)
            </label>
            <input
              id="slug"
              name="slug"
              type="text"
              maxLength={96}
              defaultValue={video?.slug ?? ""}
              className={inputClass}
            />
            <FieldError errors={state.fieldErrors} name="slug" />
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <label htmlFor="status" className={labelClass}>
              Statut *
            </label>
            <select
              id="status"
              name="status"
              defaultValue={video?.status ?? "draft"}
              className={inputClass}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <FieldError errors={state.fieldErrors} name="status" />
          </div>

          <div>
            <label htmlFor="published_at" className={labelClass}>
              Date de publication
            </label>
            <input
              id="published_at"
              name="published_at"
              type="datetime-local"
              defaultValue={toLocalInput(video?.published_at ?? null)}
              className={inputClass}
            />
            <p className="mt-1 text-[11px] text-neutral-400">
              Vide pour une publication immédiate (si le statut est « Publier »).
            </p>
            <FieldError errors={state.fieldErrors} name="published_at" />
          </div>

          <div>
            <label htmlFor="category_id" className={labelClass}>
              Rubrique
            </label>
            <select id="category_id" name="category_id" defaultValue={video?.category_id ?? ""} className={inputClass}>
              <option value="">— Sans rubrique —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <FieldError errors={state.fieldErrors} name="category_id" />
          </div>

          <div>
            <label htmlFor="duration" className={labelClass}>
              Durée (ex : 12:45)
            </label>
            <input
              id="duration"
              name="duration"
              type="text"
              maxLength={10}
              defaultValue={video?.duration ?? ""}
              placeholder="12:45"
              className={inputClass}
            />
            <FieldError errors={state.fieldErrors} name="duration" />
          </div>

          <div>
            <label htmlFor="thumbnail_url" className={labelClass}>
              Miniature personnalisée (URL — facultatif)
            </label>
            <input
              id="thumbnail_url"
              name="thumbnail_url"
              type="url"
              maxLength={500}
              defaultValue={video?.thumbnail_url ?? ""}
              placeholder="https://…"
              className={inputClass}
            />
            <p className="mt-1 text-[11px] text-neutral-400">
              Vide = miniature YouTube générée automatiquement depuis l’ID.
            </p>
            <FieldError errors={state.fieldErrors} name="thumbnail_url" />
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-neutral-200 px-4 py-3 text-sm font-semibold dark:border-white/10">
            <input
              type="checkbox"
              name="is_featured"
              defaultChecked={video?.is_featured ?? false}
              className="h-4 w-4 accent-guinea-red"
            />
            Vidéo à la une sur l’accueil
          </label>

          <div className="rounded-xl border border-guinea-red/40 bg-guinea-red/5 px-4 py-3">
            <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold">
              <input
                type="checkbox"
                name="is_live"
                defaultChecked={video?.is_live ?? false}
                className="h-4 w-4 accent-guinea-red"
              />
              Diffusion en direct
            </label>
            <p className="mt-1.5 text-[11px] font-medium leading-relaxed text-guinea-red">
              ⚠ À cocher UNIQUEMENT si un direct YouTube réel est en cours à
              l’instant. Un faux badge « En direct » est une désinformation :
              décochez dès la fin de la diffusion.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end border-t border-neutral-200 pt-5 dark:border-white/10">
        <SubmitButton label="Enregistrer la vidéo" pendingLabel="Enregistrement…" />
      </div>
    </form>
  );
}