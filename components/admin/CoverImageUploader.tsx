"use client";

import { useRef, useState } from "react";
import { uploadArticleCoverAction } from "@/lib/actions/admin";
import { compressForPurpose } from "@/lib/media/compress";
import { SERVER_MAX_BYTES } from "@/lib/media/variants";

/**
 * Couverture d'article — sélection directe depuis l'appareil
 * (ordinateur OU téléphone), compression navigateur automatique
 * (lib/media/compress.ts, réencodage canvas : ratio préservé, WebP si
 * possible, EXIF supprimés), téléversement via la Server Action
 * uploadArticleCoverAction (revalidation serveur + service_role côté
 * serveur uniquement) et préremplissage du champ featured_image.
 *
 * Pas de recadrage automatique : le ratio est conservé ; le rédacteur
 * garde la main (Remplacer / Supprimer). Aucun ancien média n'est jamais
 * supprimé automatiquement (il peut servir à un autre article) — le
 * nettoyage reste manuel dans la médiathèque.
 */

const ACCEPTED = "image/jpeg,image/png,image/webp";
const SERVER_MAX_MAIN = SERVER_MAX_BYTES.full; // 600 Ko (plafond serveur variante pleine)

function kb(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
}

export default function CoverImageUploader({
  value,
  onChange,
}: {
  /** URL de couverture actuelle de l'article ("" = aucune). */
  value: string;
  /** Appelé à chaque changement : URL publique après upload, ou "". */
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const lastObjectUrl = useRef<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sizes, setSizes] = useState<{ from: number; to: number } | null>(null);
  const [phase, setPhase] = useState<null | "compression" | "upload">(null);
  const [error, setError] = useState("");

  function openPicker() {
    inputRef.current?.click();
  }

  function trackObjectUrl(setter: (url: string) => void, blob: Blob) {
    if (lastObjectUrl.current) URL.revokeObjectURL(lastObjectUrl.current);
    const url = URL.createObjectURL(blob);
    lastObjectUrl.current = url;
    setter(url);
  }

  /** Compression + envoi. Peut être rappelé par « Réessayer ». */
  async function compressAndUpload(target: File) {
    setError("");
    setPhase("compression");
    try {
      const compressed = await compressForPurpose(target, "articles");
      if (!compressed) {
        setError(
          "Image illisible par le navigateur (format non pris en charge, par exemple HEIC d'iPhone non converti). Utilisez un JPEG, PNG ou WebP."
        );
        setPhase(null);
        return;
      }
      const main = compressed.find((c) => c.variant === "full") ?? compressed[0];
      // Plafond du bucket : 2 Mo absolus ; plafond serveur variante pleine
      // : 600 Ko. Si la seconde passe qualité laisse l'image au-dessus,
      // on refuse proprement (jamais d'envoi qui échouera côté serveur).
      if (main.toBytes > 2 * 1024 * 1024) {
        setError("Image toujours trop lourde (2 Mo maximum). Choisissez une image plus petite.");
        setPhase(null);
        return;
      }
      if (main.toBytes > SERVER_MAX_MAIN) {
        setError(
          `Image encore trop lourde après compression (${kb(main.toBytes)}, plafond ${kb(SERVER_MAX_MAIN)}). Choisissez une image plus simple ou plus petite.`
        );
        setPhase(null);
        return;
      }

      trackObjectUrl(setPreviewUrl, main.file);
      setSizes({ from: main.fromBytes, to: main.toBytes });
      setPhase("upload");

      const fd = new FormData();
      for (const c of compressed) fd.append(`file_${c.variant}`, c.file, c.file.name);
      const state = await uploadArticleCoverAction(fd);

      if (state.status === "success" && state.data?.url) {
        onChange(state.data.url);
        setError("");
      } else {
        setError(
          state.message ||
            "Téléversement impossible. Vérifiez votre connexion puis réessayez."
        );
      }
    } catch (e) {
      console.error("[CoverImageUploader]", e);
      setError(
        e instanceof Error && /memory|allocat/i.test(e.message)
          ? "Image aux dimensions trop grandes pour cet appareil. Réduisez-la (par exemple 4000 px) et réessayez."
          : "Compression ou envoi impossible. Réessayez."
      );
    } finally {
      setPhase(null);
    }
  }

  function onPick(picked: FileList | null) {
    const picked_file = picked?.[0];
    if (!picked_file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(picked_file.type)) {
      setError(
        "Format non pris en charge. Formats acceptés : JPEG, PNG, WebP (un HEIC d'iPhone doit d'abord être converti).");
      return;
    }
    setError("");
    setFile(picked_file);
    trackObjectUrl(setOriginalUrl, picked_file);
    void compressAndUpload(picked_file);
  }

  function clearCover() {
    setFile(null);
    if (lastObjectUrl.current) {
      URL.revokeObjectURL(lastObjectUrl.current);
      lastObjectUrl.current = null;
    }
    setOriginalUrl(null);
    setPreviewUrl(null);
    setSizes(null);
    setError("");
    onChange("");
  }

  const busy = phase !== null;
  const label =
    value || previewUrl ? "Remplacer l'image" : "Choisir depuis mon appareil";

  return (
    <div className="rounded-xl border border-neutral-200 p-4 dark:border-white/10">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={(e) => onPick(e.target.files)}
        disabled={busy}
      />

      {(previewUrl || value) && (
        <div className="mb-3">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-neutral-400">
            Prévisualisation {previewUrl ? "(après compression)" : "(actuelle)"}
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl ?? value}
            alt="Aperçu de l'image de couverture"
            className="max-h-64 w-full rounded-xl border border-neutral-200 object-contain dark:border-white/10"
          />
          {sizes && (
            <p className="mt-2 text-[11px] text-neutral-400">
              {file?.name ?? "image"} · {kb(sizes.from)} → <strong>{kb(sizes.to)}</strong>{" "}
              après compression (WebP, EXIF supprimés, ratio préservé)
            </p>
          )}
          {!previewUrl && value && (
            <p className="mt-2 break-all text-[11px] text-neutral-400">{value}</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={openPicker}
          disabled={busy}
          className="rounded-xl border border-guinea-red/40 bg-guinea-red/10 px-4 py-2.5 text-sm font-bold text-guinea-red transition-colors hover:bg-guinea-red/20 disabled:opacity-60"
        >
          {label}
        </button>
        {(value || previewUrl) && (
          <button
            type="button"
            onClick={clearCover}
            disabled={busy}
            className="rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-bold text-neutral-600 transition-colors hover:bg-neutral-100 disabled:opacity-60 dark:border-white/15 dark:text-neutral-300 dark:hover:bg-white/10"
          >
            Supprimer la couverture
          </button>
        )}
        {error && (
          <button
            type="button"
            onClick={() => file && void compressAndUpload(file)}
            disabled={busy || !file}
            className="rounded-xl border border-guinea-green/40 bg-guinea-green/10 px-4 py-2.5 text-sm font-bold text-guinea-green transition-colors hover:bg-guinea-green/20 disabled:opacity-60"
          >
            Réessayer
          </button>
        )}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-neutral-400">
        {phase === "compression"
          ? "Compression en cours dans votre navigateur…"
          : phase === "upload"
            ? "Téléversement vers le stockage sécurisé…"
            : "JPEG, PNG ou WebP — compressée automatiquement (2 Mo maximum, ratio préservé). Le téléphone ouvre le sélecteur de photos."}
      </p>

      {/* Confirmation LISIBLE que l'image est liée à l'article : un
          téléversement réussi ne suffit PAS — tant que l'article n'est
          pas enregistré, l'URL n'existe que dans ce formulaire. Toute
          navigation avant enregistrement perd le lien (cause réelle des
          couvertures « absentes » du site public). */}
      {value && !error && phase === null && (
        <p className="mt-3 rounded-xl border border-guinea-green/40 bg-guinea-green/10 px-3 py-2 text-xs font-bold text-guinea-green" role="status">
          ✔ Couverture liée à cet article — enregistrez l&apos;article
          maintenant (brouillon, publier…). Elle apparaîtra sur le site
          public dès la publication.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-xl border border-guinea-red/40 bg-guinea-red/10 px-4 py-3 text-sm font-medium text-guinea-red">
          {error}
        </p>
      )}
    </div>
  );
}