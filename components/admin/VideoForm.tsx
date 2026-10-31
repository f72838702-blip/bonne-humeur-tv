"use client";

import Image from "next/image";
import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Category, VideoWithRelations } from "@/lib/types";
import { saveVideo } from "@/lib/actions/content";
import { importYouTubeMeta } from "@/lib/actions/youtube";
import {
  extractYouTubeId,
  youtubeThumbnailUrl,
  youtubeWatchUrl,
} from "@/lib/youtube/url";
import { FieldError, FormMessage, SubmitButton, idleActionState, inputClass, labelClass } from "./form-ui";

/**
 * Fiche vidéo — YouTube UNIQUEMENT (directive §1).
 * L'éditeur colle une URL YouTube (watch / youtu.be / embed / live) ou
 * l'ID brut : l'identifiant est extrait et STRICTEMENT validé côté
 * client pour l'aperçu, puis revalidé côté serveur (saveVideo refuse
 * toute source externe). Aucune vidéo n'est jamais hébergée chez nous.
 *
 * Import des métadonnées via la Data API v3 — appel SERVEUR uniquement,
 * clé jamais exposée. API absente → message honnête, saisie manuelle.
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
  const [importState, importAction] = useActionState(importYouTubeMeta, idleActionState);
  const router = useRouter();

  // Source vidéo : URL YouTube collée (ou URL reconstruite en édition).
  const [sourceUrl, setSourceUrl] = useState(
    video?.youtube_id ? youtubeWatchUrl(video.youtube_id) : ""
  );
  const [title, setTitle] = useState(video?.title ?? "");
  const [description, setDescription] = useState(video?.description ?? "");
  const [duration, setDuration] = useState(video?.duration ?? "");
  const [thumbnailUrl, setThumbnailUrl] = useState(video?.thumbnail_url ?? "");
  const [publishedAt, setPublishedAt] = useState(toLocalInput(video?.published_at ?? null));

  // Extraction client : aperçu immédiat uniquement — le serveur revalide.
  const detectedId = useMemo(() => extractYouTubeId(sourceUrl), [sourceUrl]);

  // Métadonnées importées → appliquées aux champs (une seule fois par réponse).
  useEffect(() => {
    if (importState.status !== "success" || !importState.data) return;
    const d = importState.data;
    if (d.title) setTitle(d.title);
    if (d.description) setDescription(d.description);
    if (d.duration) setDuration(d.duration);
    if (d.thumbnail_url) setThumbnailUrl(d.thumbnail_url);
    if (d.published_at) setPublishedAt(d.published_at.slice(0, 16));
  }, [importState]);

  useEffect(() => {
    if (state.status === "success" && state.redirectTo) {
      router.push(state.redirectTo);
      router.refresh();
    }
  }, [state, router]);

  return (
    <div className="flex flex-col gap-5">
      {/* ── Panneau source YouTube (formulaire d'import séparé) ── */}
      <form action={importAction} className="flex flex-col gap-3 rounded-2xl border border-neutral-200 p-5 dark:border-white/10">
        <div>
          <label htmlFor="youtube_url" className={labelClass}>
            Source vidéo (URL YouTube ou ID) *
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="youtube_url"
              name="youtube_url"
              type="text"
              required
              maxLength={300}
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=… ou https://youtu.be/…"
              className={inputClass}
            />
            <SubmitButton
              label="Importer les métadonnées YouTube"
              pendingLabel="Importation…"
              variant="neutral"
              className="shrink-0 whitespace-nowrap"
            />
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">
            Formats acceptés : youtube.com/watch?v=…, youtu.be/…, youtube.com/embed/…,
            youtube.com/live/… ou l’identifiant à 11 caractères. Toute autre URL est
            refusée. L’import utilise l’API YouTube côté serveur ; sans clé configurée,
            renseignez les champs manuellement.
          </p>
          <FieldError errors={importState.fieldErrors} name="youtube_url" />
          {/* Refus serveur de la source (saveVideo) affiché ici aussi. */}
          <FieldError errors={state.fieldErrors} name="youtube_url" />
        </div>

        <FormMessage state={importState} />

        {detectedId ? (
          <div className="flex items-center gap-4 rounded-xl bg-neutral-50 p-3 dark:bg-white/5">
            <Image
              src={youtubeThumbnailUrl(detectedId, "hq")}
              alt="Miniature YouTube de la vidéo détectée"
              width={160}
              height={90}
              className="h-[90px] w-[160px] rounded-lg object-cover"
            />
            <div className="text-xs leading-relaxed">
              <p className="font-bold text-neutral-800 dark:text-neutral-100">
                Identifiant détecté : <span className="font-mono">{detectedId}</span>
              </p>
              <a
                href={youtubeWatchUrl(detectedId)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-guinea-green underline"
              >
                Vérifier la vidéo sur YouTube ↗
              </a>
            </div>
          </div>
        ) : sourceUrl.trim().length > 0 ? (
          <p className="rounded-xl border border-guinea-red/40 bg-guinea-red/5 px-4 py-2 text-xs font-medium text-guinea-red">
            URL non reconnue : collez une URL YouTube valide (ou l’ID à 11 caractères).
          </p>
        ) : null}

        {importState.status === "success" && importState.data?.live_broadcast_content && (
          <p className="rounded-xl border border-guinea-green/40 bg-guinea-green/5 px-4 py-2 text-xs font-semibold text-guinea-green">
            {importState.data.live_broadcast_content === "live" &&
              "YouTube indique : cette vidéo est EN DIRECT en ce moment."}
            {importState.data.live_broadcast_content === "upcoming" &&
              "YouTube indique : direct programmé (pas encore commencé). Ne cochez pas « En direct » avant le début réel."}
            {importState.data.live_broadcast_content === "none" &&
              "YouTube indique : ce n’est pas un direct."}
          </p>
        )}
      </form>

      {/* ── Fiche vidéo ── */}
      <form action={formAction} className="flex flex-col gap-5">
        {video && <input type="hidden" name="id" value={video.id} />}
        <input type="hidden" name="youtube_url" value={sourceUrl} />

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
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Titre de l'émission / du reportage"
                className={inputClass}
              />
              <FieldError errors={state.fieldErrors} name="title" />
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
                value={description}
                onChange={(e) => setDescription(e.target.value)}
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
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
                className={inputClass}
              />
              <p className="mt-1 text-[11px] text-neutral-400">
                Vide pour une publication immédiate (si le statut est « Publier »).
              </p>
              <FieldError errors={state.fieldErrors} name="published_at" />
            </div>
          </div>

          <div className="flex flex-col gap-5">
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
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
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
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
                placeholder="https://…"
                className={inputClass}
              />
              <p className="mt-1 text-[11px] text-neutral-400">
                Vide = miniature YouTube (i.ytimg) générée automatiquement depuis l’ID,
                jamais retéléchargée chez nous.
              </p>
              <FieldError errors={state.fieldErrors} name="thumbnail_url" />
            </div>

            <div>
              <label htmlFor="position" className={labelClass}>
                Position sur l’accueil
              </label>
              <input
                id="position"
                name="position"
                type="number"
                min={0}
                max={999}
                defaultValue={video?.position ?? 0}
                className={inputClass}
              />
              <p className="mt-1 text-[11px] text-neutral-400">
                0 = ordre chronologique automatique. 1, 2, 3… = épinglée en tête de
                l’accueil dans cet ordre.
              </p>
              <FieldError errors={state.fieldErrors} name="position" />
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
                décochez dès la fin de la diffusion. Si l’API YouTube est
                configurée, « Importer les métadonnées » affiche l’état réel.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end border-t border-neutral-200 pt-5 dark:border-white/10">
          <SubmitButton label="Enregistrer la vidéo" pendingLabel="Enregistrement…" />
        </div>
      </form>
    </div>
  );
}