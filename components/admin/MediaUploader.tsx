"use client";

import { useActionState, useState } from "react";
import { uploadMediaAction } from "@/lib/actions/admin";
import { compressForPurpose } from "@/lib/media/compress";
import { MEDIA_PURPOSES, MediaPurpose, PURPOSE_VARIANTS } from "@/lib/media/variants";
import { FormMessage, SubmitButton, idleActionState, inputClass, labelClass } from "./form-ui";

/**
 * Téléversement d'images — directive §2.
 * Le navigateur compresse d'abord (ratio préservé, WebP, EXIF supprimés
 * par ré-encodage) puis envoie les variantes ; le serveur revalide
 * signature/MIME/dimensions/poids avant stockage. Le succès n'est
 * affiché qu'après confirmation réelle du stockage.
 */

const PURPOSE_LABELS: Record<MediaPurpose, string> = {
  articles: "Couvertures d'articles",
  categories: "Illustrations de rubriques",
  thumbnails: "Miniatures dédiées",
  reporters: "Photos de reporter",
  branding: "Identité / bannières",
  advertising: "Publicités (régie)",
};

const VARIANT_LABELS: Record<string, string> = {
  full: "Grande couverture",
  card: "Carte",
  thumb: "Miniature",
  avatar: "Avatar",
};

function kb(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
}

export default function MediaUploader() {
  const [state, formAction] = useActionState(uploadMediaAction, idleActionState);
  const [purpose, setPurpose] = useState<MediaPurpose>("articles");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ variant: string; toBytes: number }[] | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [prepError, setPrepError] = useState("");

  const variants = PURPOSE_VARIANTS[purpose];

  async function handleUpload() {
    if (!file) {
      setPrepError("Sélectionnez d'abord une image.");
      return;
    }
    setPreparing(true);
    setPrepError("");
    setPreview(null);
    try {
      const compressed = await compressForPurpose(file, purpose);
      if (!compressed) {
        setPrepError("Image illisible par le navigateur. Utilisez un JPEG, PNG, WebP ou GIF valide.");
        return;
      }
      setPreview(compressed.map((c) => ({ variant: c.variant, toBytes: c.toBytes })));
      // Le FormData est reconstruit avec les variantes compressées :
      // un <input type="file"> ne peut pas porter les fichiers encodés.
      const fd = new FormData();
      fd.set("purpose", purpose);
      for (const c of compressed) fd.append(`file_${c.variant}`, c.file, c.file.name);
      formAction(fd);
    } catch (error) {
      console.error("[MediaUploader] compression :", error);
      setPrepError("Compression impossible dans le navigateur.");
    } finally {
      setPreparing(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void handleUpload();
      }}
      className="flex flex-col gap-3"
    >
      <div>
        <label htmlFor="purpose" className={labelClass}>
          Dossier de destination *
        </label>
        <select
          id="purpose"
          value={purpose}
          onChange={(e) => {
            setPurpose(e.target.value as MediaPurpose);
            setPreview(null);
          }}
          className={inputClass}
        >
          {MEDIA_PURPOSES.map((p) => (
            <option key={p} value={p}>
              {PURPOSE_LABELS[p]}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-neutral-400">
          Variantes générées : {variants.map((v) => VARIANT_LABELS[v] ?? v).join(", ")}.
        </p>
      </div>

      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        required
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
          setPreview(null);
          setPrepError("");
        }}
        className="block w-full cursor-pointer rounded-xl border border-neutral-300 bg-surface p-2.5 text-sm text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-guinea-red/10 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-guinea-red dark:border-white/15 dark:bg-night-800 dark:text-neutral-300"
      />
      <p className="text-[11px] leading-relaxed text-neutral-400">
        JPEG, PNG, WebP ou GIF. Compression dans votre navigateur avant l’envoi
        (ratio préservé, métadonnées EXIF supprimées, WebP si disponible) ; le
        serveur revalide le contenu réel avant stockage — un fichier déguisé
        ou une image non optimisée sont refusés.
      </p>

      {preview && (
        <ul className="rounded-xl bg-neutral-50 px-4 py-3 text-xs dark:bg-white/5">
          {preview.map((p) => (
            <li key={p.variant} className="font-medium text-neutral-600 dark:text-neutral-300">
              {VARIANT_LABELS[p.variant] ?? p.variant} : {kb(p.toBytes)}
            </li>
          ))}
        </ul>
      )}
      {prepError && (
        <p role="alert" className="rounded-xl border border-guinea-red/40 bg-guinea-red/10 px-4 py-3 text-sm font-medium text-guinea-red">
          {prepError}
        </p>
      )}

      <SubmitButton
        label="Compresser et téléverser"
        pendingLabel={preparing ? "Compression…" : "Téléversement…"}
      />
      <FormMessage state={state} />
    </form>
  );
}