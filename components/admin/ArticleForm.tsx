"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { ImagePlus, Youtube } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ArticleWithRelations, Category, UserRole } from "@/lib/types";
import { saveArticle } from "@/lib/actions/content";
import { uploadArticleCoverAction } from "@/lib/actions/admin";
import { compressForPurpose } from "@/lib/media/compress";
import { SERVER_MAX_BYTES, mediaVariantUrl } from "@/lib/media/variants";
import {
  deleteImageOccurrence,
  findImageOccurrences,
  insertImageBlock,
  updateImageOccurrence,
  type ImageOccurrence,
} from "@/lib/content/editor-image";
import { IMAGE_ALT_MAX, IMAGE_CAPTION_MAX, mediaPublicUrl, storagePathFromUrl } from "@/lib/content/image-marker";
import {
  deleteYouTubeOccurrence,
  findYouTubeOccurrences,
  insertYouTubeBlock,
  moveYouTubeOccurrence,
  type VideoInsertMode,
} from "@/lib/content/editor-video";
import { extractYouTubeId, youtubeThumbnailUrl, youtubeWatchUrl } from "@/lib/youtube/url";
import CoverImageUploader from "./CoverImageUploader";
import { FieldError, FormMessage, SubmitButton, idleActionState, inputClass, labelClass } from "./form-ui";

/**
 * Rédaction / édition d'article (markdown, workflow draft→review→…).
 * Les options visibles dépendent du rôle ; le SERVEUR revérifie tout
 * (lib/actions/content.ts + RLS) — ce formulaire ne fait que proposer.
 */

const STATUS_OPTIONS_STAFF = [
  { value: "draft", label: "Brouillon" },
  { value: "review", label: "Soumettre à validation" },
  { value: "scheduled", label: "Publication programmée" },
  { value: "published", label: "Publier" },
  { value: "archived", label: "Archiver" },
];

const STATUS_OPTIONS_REPORTER = [
  { value: "draft", label: "Brouillon" },
  { value: "review", label: "Soumettre à validation" },
];

/** ISO → valeur locale pour <input type="datetime-local">. */
function toLocalInput(iso: string | null): string {
  return iso ? iso.slice(0, 16) : "";
}

/** Indicateur d'emplacement après une édition vidéo (lisible, 1-indexé). */
function caretLine(value: string, caret: number): number {
  return value.slice(0, Math.max(0, caret)).split("\n").length;
}

export default function ArticleForm({
  categories,
  role,
  article,
}: {
  categories: Pick<Category, "id" | "name" | "slug">[];
  role: UserRole;
  article?: ArticleWithRelations;
}) {
  const [state, formAction] = useActionState(saveArticle, idleActionState);
  const [status, setStatus] = useState(article?.status ?? "draft");
  const [scheduleHint, setScheduleHint] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState(article?.featured_image ?? "");
  const [ytOpen, setYtOpen] = useState(false);
  const [ytUrl, setYtUrl] = useState("");
  const [ytError, setYtError] = useState<string | null>(null);
  const [ytNote, setYtNote] = useState<string | null>(null);
  /** Miroir du contenu du textarea (source de la liste des blocs vidéo). */
  const [contentValue, setContentValue] = useState(article?.content ?? "");
  const contentRef = useRef<HTMLTextAreaElement | null>(null);
  /**
   * Curseur MÉMORISÉ (mobile inclus) : le clavier virtuel ou le panneau
   * fait perdre le focus au textarea AVANT tout clic d'insertion — la
   * dernière position connue (sélection comprise) est conservée ici et
   * sert quand le champ n'a plus le focus.
   */
  const caretRef = useRef<{ start: number; end: number }>({
    start: 0,
    end: 0,
  });
  /** Garde anti-doublon : un double-tap ne peut pas insérer deux blocs. */
  const lastInsertRef = useRef(0);
  /** Images intégrées : pipelineCompression/téléversement + panneau. */
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [imgBusy, setImgBusy] = useState<null | "compression" | "upload">(null);
  const [imgError, setImgError] = useState<string | null>(null);
  const [imgNote, setImgNote] = useState<string | null>(null);
  const pendingImageRef = useRef<File | null>(null);
  const router = useRouter();
  const isStaff = role === "admin" || role === "editor";
  const options = isStaff ? STATUS_OPTIONS_STAFF : STATUS_OPTIONS_REPORTER;

  useEffect(() => {
    if (state.status === "success" && state.redirectTo) {
      router.push(state.redirectTo);
      router.refresh();
    }
  }, [state, router]);

  /** Confirmation avant publication (dialogue navigateur, annulable). */
  const confirmPublish = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (!window.confirm("Publier cet article sur le site public ? Il sera visible immédiatement.")) {
      event.preventDefault();
    }
  };

  /** La date est obligatoire : contrôle immédiat + serveur en dernier ressort. */
  const guardSchedule = (event: ReactMouseEvent<HTMLButtonElement>) => {
    const input = document.getElementById("scheduled_at") as HTMLInputElement | null;
    if (!input?.value) {
      event.preventDefault();
      setScheduleHint("Indiquez d'abord la date et l'heure de publication programmée.");
      input?.focus();
      return;
    }
    setScheduleHint(null);
  };

  // ─────────────────────────────────────────────────────────────
  // Curseur et édition vidéo
  // ─────────────────────────────────────────────────────────────

  /** Mémorise la position courante du curseur (appelé sur tout événement
   *  de sélection, de tap, de frappe ET avant une perte de focus). */
  const captureCaret = () => {
    const ta = contentRef.current;
    if (!ta) return;
    caretRef.current = {
      start: ta.selectionStart ?? ta.value.length,
      end: ta.selectionEnd ?? ta.selectionStart ?? ta.value.length,
    };
  };

  /** Curseur à utiliser : LIVE si le textarea a le focus, sinon la
   *  dernière position mémorisée (panneau/clavier = focus perdu). */
  const currentCaret = (): { start: number; end: number } => {
    const ta = contentRef.current;
    if (ta && document.activeElement === ta) captureCaret();
    return { ...caretRef.current };
  };

  /** Applique le nouveau contenu : focus + curseur restaurés (exigences
   *  2/4), miroir d'état à jour, snapshot de curseur resynchronisé. */
  const applyContent = (value: string, caret: number) => {
    const ta = contentRef.current;
    setContentValue(value);
    if (!ta) return;
    ta.value = value;
    ta.focus();
    const pos = Math.max(0, Math.min(caret, value.length));
    try {
      ta.setSelectionRange(pos, pos);
    } catch {
      // Anciens navigateurs tactiles : le focus suffit, le contenu est bon.
    }
    caretRef.current = { start: pos, end: pos };
  };

  /**
   * Insère un bloc vidéo YouTube selon le mode choisi. La chaîne réelle
   * (calcul du texte, remplacement de la sélection, position du curseur)
   * vit dans le module PUR lib/content/editor-video.ts — testé
   * unitairement. Aucun clic ne peut insérer deux blocs (garde temporelle
   * + URL vidée immédiatement après succès).
   */
  /** Applique le nouveau contenu SANS voler le focus (édition des alt /
   *  légendes depuis le panneau images — le curseur du textarea reste
   *  simplement où il est, caretRef est recapturé à la prochaine action). */
  const applyContentSilent = (value: string) => {
    setContentValue(value);
    const ta = contentRef.current;
    if (ta) ta.value = value;
  };

  // ─────────────────────────────────────────────────────────────
  // Images intégrées au corps
  // ─────────────────────────────────────────────────────────────

  /** Chaîne : sélection → compression navigateur → téléversement →
   *  insertion du marqueur EXACTEMENT au curseur mémorisé (même
   *  mécanisme que les vidéos : le panneau/fichier peut voler le
   *  focus, caretRef garde la position). Répétable autant de fois
   *  que nécessaire. */
  const uploadAndInsertImage = async (picked: File) => {
    setImgError(null);
    setImgNote(null);
    setImgBusy("compression");
    try {
      const compressed = await compressForPurpose(picked, "articles");
      if (!compressed) {
        setImgError(
          "Image illisible par le navigateur (par exemple un HEIC d'iPhone pas converti). Utilisez un JPEG, PNG ou WebP."
        );
        setImgBusy(null);
        return;
      }
      const total = compressed.reduce((n, c) => n + c.toBytes, 0);
      if (total > 2 * 1024 * 1024) {
        setImgError("Image toujours trop lourde (2 Mo maximum). Choisissez une image plus petite.");
        setImgBusy(null);
        return;
      }
      // Plafond de la variante pleine (600 Ko) : le même garde que la
      // couverture — on refuse ici plutôt qu'au serveur, message clair.
      const main = compressed.find((c) => c.variant === "full") ?? compressed[0];
      if (main.toBytes > SERVER_MAX_BYTES.full) {
        setImgError(
          `Image encore trop lourde après compression (${Math.max(1, Math.round(main.toBytes / 1024))} Ko pour un plafond de 600 Ko). Réduisez-la et réessayez.`
        );
        setImgBusy(null);
        return;
      }

      setImgBusy("upload");
      const fd = new FormData();
      for (const c of compressed) fd.append(`file_${c.variant}`, c.file, c.file.name);
      const result = await uploadArticleCoverAction(fd);

      if (result.status !== "success" || !result.data?.url) {
        setImgError(result.message || "Téléversement impossible. Vérifiez votre connexion puis réessayez.");
        setImgBusy(null);
        return;
      }
      // URL → chemin revalidé (dossier whitelisté, sans « .. ») : le
      // marqueur ne conserve JAMAIS une URL arbitraire.
      const path = storagePathFromUrl(result.data.url);
      if (!path) {
        setImgError("Réponse du stockage inattendue. Réessayez.");
        setImgBusy(null);
        return;
      }

      const textarea = contentRef.current;
      if (!textarea) return;
      const { start, end } = currentCaret();
      const op = insertImageBlock(textarea.value, start, end, path);
      applyContent(op.value, op.caret);
      const anchor = op.anchorExcerpt ? ` après « ${op.anchorExcerpt} »` : "";
      setImgNote(
        `Image insérée à l'emplacement du curseur${anchor} — ligne ${caretLine(op.value, op.caret)}. Ajoutez son texte alternatif dans la liste ci-dessous.`
      );
      setImgError(null);
    } catch (e) {
      console.error("[ArticleForm] image", e);
      setImgError(
        e instanceof Error && /memory|allocat/i.test(e.message)
          ? "Image aux dimensions trop grandes pour cet appareil. Réduisez-la et réessayez."
          : "Compression ou envoi impossible. Vérifiez votre connexion puis réessayez."
      );
    } finally {
      setImgBusy(null);
    }
  };

  const onPickImage = (files: FileList | null) => {
    const picked = files?.[0];
    if (!picked) return;
    if (!/^image\/(jpeg|png|webp)$/.test(picked.type)) {
      setImgError(
        "Format non pris en charge (par exemple un HEIC d'iPhone). Formats acceptés : JPEG, PNG, WebP."
      );
      return;
    }
    setImgError(null);
    pendingImageRef.current = picked;
    void uploadAndInsertImage(picked);
  };

  /** Occurrences d'images valides du corps (une par marqueur, SANS dédoublon). */
  const imageOccurrences = findImageOccurrences(contentValue);

  const updateImageMeta = (occ: ImageOccurrence, alt: string, caption: string) => {
    const op = updateImageOccurrence(contentValue, occ, alt, caption);
    // Application SILENCIEUSE : le focus reste sur le champ alt/légende.
    applyContentSilent(op.value);
  };

  const removeImage = (occ: ImageOccurrence) => {
    // Re-lecture du contenu courant : l'index du panneau peut être périmé
    // (la liste est recalculée à chaque frappe) — on cible par position.
    const mapped = findImageOccurrences(contentValue).find(
      (o) => o.path === occ.path && o.start === occ.start
    );
    if (!mapped) return;
    const op = deleteImageOccurrence(contentValue, mapped);
    applyContent(op.value, op.caret);
    setImgNote("Image retirée du corps (le fichier reste dans la médiathèque).");
  };

  const insertYouTube = (mode: VideoInsertMode) => {
    const now = Date.now();
    if (now - lastInsertRef.current < 350) return; // double-tap → ignoré
    const id = extractYouTubeId(ytUrl);
    if (!id) {
      setYtError(
        "URL YouTube invalide. Formats acceptés : youtube.com/watch?v=…, youtu.be/…, youtube.com/shorts/…, youtube.com/embed/…, youtube.com/live/…"
      );
      return;
    }
    const textarea = contentRef.current;
    if (!textarea) return;
    const { start, end } = currentCaret();
    const replaced = mode === "cursor" && end > start;
    const op = insertYouTubeBlock(textarea.value, start, end, id, mode);
    lastInsertRef.current = now;
    applyContent(op.value, op.caret);

    const anchor = op.anchorExcerpt ? ` après « ${op.anchorExcerpt} »` : "";
    const where =
      mode === "end"
        ? "à la fin de l'article"
        : mode === "after-paragraph"
          ? `après un paragraphe${anchor}`
          : replaced
            ? "à l'emplacement de la sélection remplacée"
            : `à l'emplacement du curseur${anchor}`;
    setYtNote(
      `Bloc vidéo inséré ${where} — ligne ${caretLine(op.value, op.caret)}.`
    );
    setYtUrl("");
    setYtError(null);
  };

  /** Occurrences réelles des blocs vidéo du corps (doublons visibles). */
  const occurrences = ytOpen ? findYouTubeOccurrences(contentValue) : [];
  const idCounts = new Map<string, number>();
  for (const o of occurrences) idCounts.set(o.id, (idCounts.get(o.id) ?? 0) + 1);

  const moveOccurrence = (index: number) => {
    const occurrence = occurrences[index];
    if (!occurrence) return;
    const { start, end } = currentCaret();
    const op = moveYouTubeOccurrence(contentValue, occurrence, start, end);
    applyContent(op.value, op.caret);
    setYtNote(
      `Bloc déplacé à l'emplacement du curseur — ligne ${caretLine(op.value, op.caret)}.`
    );
  };

  const removeOccurrence = (index: number) => {
    const occurrence = occurrences[index];
    if (!occurrence) return;
    const op = deleteYouTubeOccurrence(contentValue, occurrence);
    applyContent(op.value, op.caret);
    setYtNote("Bloc vidéo supprimé.");
  };

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {article && <input type="hidden" name="id" value={article.id} />}

      <FormMessage state={state} />

      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        {/* ─── Colonne principale ─── */}
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
              minLength={5}
              maxLength={200}
              defaultValue={article?.title ?? ""}
              placeholder="Un titre clair et factuel"
              className={inputClass}
            />
            <FieldError errors={state.fieldErrors} name="title" />
          </div>

          <div>
            <label htmlFor="excerpt" className={labelClass}>
              Chapeau / résumé (400 caractères max)
            </label>
            <textarea
              id="excerpt"
              name="excerpt"
              rows={3}
              maxLength={400}
              defaultValue={article?.excerpt ?? ""}
              placeholder="Le résumé affiché dans les listes et les réseaux sociaux"
              className={inputClass}
            />
            <FieldError errors={state.fieldErrors} name="excerpt" />
          </div>

          <div>
            <label htmlFor="content" className={labelClass}>
              Contenu (markdown) *
            </label>
            <textarea
              id="content"
              ref={contentRef}
              name="content"
              rows={18}
              required
              defaultValue={article?.content ?? ""}
              placeholder={"## Titre de section\n\nParagraphe de l'article…\n\n- **gras**\n- *italique*\n- listes à puces"}
              className={`${inputClass} font-mono text-[13px] leading-relaxed`}
              /* Curseur capturé à CHAQUE événement susceptible de le
                 déplacer (souris, clavier, tactile, changement de valeur)
                 ET à la perte de focus — l'insertion retrouve toujours
                 l'endroit voulu, même depuis un téléphone. */
              onSelect={captureCaret}
              onClick={captureCaret}
              onKeyUp={captureCaret}
              onPointerUp={captureCaret}
              onTouchEnd={captureCaret}
              onBlur={captureCaret}
              onChange={(e) => {
                setContentValue(e.target.value);
                captureCaret();
              }}
            />
            <p className="mt-1 text-[11px] text-neutral-400">
              Mise en forme markdown : <code className="rounded bg-neutral-100 px-1 dark:bg-white/10">**gras**</code>,{" "}
              <code className="rounded bg-neutral-100 px-1 dark:bg-white/10">*italique*</code>,{" "}
              <code className="rounded bg-neutral-100 px-1 dark:bg-white/10">## titres</code>,{" "}
              <code className="rounded bg-neutral-100 px-1 dark:bg-white/10">- listes</code>. Les liens et
              contenus dangereux sont neutralisés côté serveur.
            </p>
            <FieldError errors={state.fieldErrors} name="content" />

            <div className="mt-3 rounded-xl border border-neutral-200 p-3 dark:border-white/10">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    // Mémorise le curseur AVANT tout changement de focus.
                    captureCaret();
                    setYtOpen((v) => !v);
                    setYtError(null);
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-guinea-red/40 bg-guinea-red/10 px-4 py-2.5 text-sm font-bold text-guinea-red transition-colors hover:bg-guinea-red/20 sm:w-auto"
                >
                  <Youtube className="h-4 w-4" />
                  Insérer ou gérer une vidéo YouTube
                </button>
                {/* Images intégrées : le SÉLECTEUR de fichiers s'ouvre
                    directement — curseur mémorisé au préalable. */}
                <button
                  type="button"
                  onClick={() => {
                    captureCaret();
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                      fileInputRef.current.click();
                    }
                  }}
                  disabled={imgBusy !== null}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-guinea-green/40 bg-guinea-green/10 px-4 py-2.5 text-sm font-bold text-guinea-green transition-colors hover:bg-guinea-green/20 disabled:opacity-60 sm:w-auto"
                >
                  <ImagePlus className="h-4 w-4" />
                  {imgBusy === "compression"
                    ? "Compression en cours…"
                    : imgBusy === "upload"
                      ? "Téléversement en cours…"
                      : "+ Insérer une image"}
                </button>
              </div>
              {/* Sélecteur de fichiers (JPEG/PNG/WebP — compression
                  navigateur automatique puis upload contrôlé). */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => onPickImage(e.target.files)}
                disabled={imgBusy !== null}
              />
              {imgNote && !imgError && (
                <p className="mt-3 rounded-lg border border-guinea-green/40 bg-guinea-green/10 px-3 py-2 text-xs font-medium text-guinea-green">
                  ✔ {imgNote}
                </p>
              )}
              {imgError && (
                <p role="alert" className="mt-3 rounded-lg border border-guinea-red/40 bg-guinea-red/10 px-3 py-2 text-xs font-medium text-guinea-red">
                  {imgError}
                </p>
              )}

              {/* ── Images du corps : aperçu, alt, légende, retrait. ── */}
              {imageOccurrences.length > 0 && (
                <div className="mt-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">
                    Image{imageOccurrences.length > 1 ? "s" : ""} dans le corps — texte alternatif, légende, retrait
                  </p>
                  <p className="mt-1 text-[11px] text-neutral-400">
                    L&apos;ordre affiché est l&apos;ordre du site public (#1, #2…). Une image retirée
                    disparaît de l&apos;article ; son fichier reste dans la médiathèque (jamais
                    supprimé automatiquement).
                  </p>
                  <ul className="mt-2 grid gap-3 sm:grid-cols-2">
                    {imageOccurrences.map((occurrence, index) => {
                      const fileName = occurrence.path.split("/").pop() ?? occurrence.path;
                      return (
                        <li
                          key={`${occurrence.start}-${occurrence.path}-${index}`}
                          className="rounded-xl border border-neutral-300 bg-surface p-3 text-sm dark:border-white/10 dark:bg-night-800"
                        >
                          <div className="flex items-start gap-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={mediaVariantUrl(mediaPublicUrl(occurrence.path), "thumb")}
                              alt={`Aperçu de l'image insérée #${index + 1}`}
                              loading="lazy"
                              className="h-20 w-28 shrink-0 rounded-lg border border-neutral-200 object-cover dark:border-white/10"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-neutral-600 dark:text-neutral-300">
                                #{index + 1} · ligne {caretLine(contentValue, occurrence.start)}
                              </p>
                              <p className="mt-0.5 truncate text-[11px] text-neutral-400">{fileName}</p>
                            </div>
                          </div>
                          <div className="mt-2 flex flex-col gap-2">
                            <label className="sr-only" htmlFor={`img_alt_${index}`}>
                              Texte alternatif de l&apos;image {index + 1}
                            </label>
                            <input
                              id={`img_alt_${index}`}
                              type="text"
                              maxLength={IMAGE_ALT_MAX}
                              value={occurrence.alt}
                              placeholder="Texte alternatif (décrit l'image pour les malvoyants)"
                              onChange={(e) => updateImageMeta(occurrence, e.target.value, occurrence.caption)}
                              className={`${inputClass} py-2 text-xs`}
                            />
                            <label className="sr-only" htmlFor={`img_caption_${index}`}>
                              Légende de l&apos;image {index + 1}
                            </label>
                            <input
                              id={`img_caption_${index}`}
                              type="text"
                              maxLength={IMAGE_CAPTION_MAX}
                              value={occurrence.caption}
                              placeholder="Légende affichée sous l'image (facultatif)"
                              onChange={(e) => updateImageMeta(occurrence, occurrence.alt, e.target.value)}
                              className={`${inputClass} py-2 text-xs`}
                            />
                            <button
                              type="button"
                              onClick={() => removeImage(occurrence)}
                              className="rounded-lg border border-guinea-red/40 bg-guinea-red/10 px-2 py-2 text-xs font-bold text-guinea-red transition-colors hover:bg-guinea-red/20"
                            >
                              Retirer cette image
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {ytOpen && (
                <div className="mt-3 flex flex-col gap-2">
                  <p className="text-[11px] leading-relaxed text-neutral-400">
                    Tapez dans le texte à l&apos;endroit voulu, collez le lien
                    de la vidéo, puis choisissez une des trois insertions. La
                    position du curseur est mémorisée même si le clavier du
                    téléphone ou ce panneau cache le champ — sur un
                    smartphone, vous pouvez sélectionner du texte puis
                    passer au panneau sans la perdre.
                  </p>
                  <input
                    id="youtube_url"
                    type="url"
                    value={ytUrl}
                    onChange={(e) => {
                      setYtUrl(e.target.value);
                      setYtError(null);
                    }}
                    placeholder="https://www.youtube.com/watch?v=… ou https://youtu.be/…"
                    className={inputClass}
                  />
                  {ytError && (
                    <p role="alert" className="text-xs font-medium text-guinea-red">
                      {ytError}
                    </p>
                  )}
                  <div className="grid gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => insertYouTube("cursor")}
                      className="rounded-lg bg-guinea-red px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-guinea-red/90"
                    >
                      Au curseur
                      <span className="block text-[10px] font-medium opacity-80">
                        remplace la sélection
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => insertYouTube("after-paragraph")}
                      className="rounded-lg border border-guinea-red/40 bg-guinea-red/10 px-4 py-3 text-sm font-bold text-guinea-red transition-colors hover:bg-guinea-red/20"
                    >
                      Après le paragraphe courant
                    </button>
                    <button
                      type="button"
                      onClick={() => insertYouTube("end")}
                      className="rounded-lg border border-guinea-red/40 bg-guinea-red/10 px-4 py-3 text-sm font-bold text-guinea-red transition-colors hover:bg-guinea-red/20"
                    >
                      À la fin de l&apos;article
                    </button>
                  </div>

                  {ytNote && (
                    <p className="rounded-lg border border-guinea-green/40 bg-guinea-green/10 px-3 py-2 text-xs font-medium text-guinea-green">
                      ✔ {ytNote}
                    </p>
                  )}

                  {occurrences.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">
                        Bloc{occurrences.length > 1 ? "s" : ""} vidéo
                        {occurrences.length > 1 ? "s" : ""} dans le corps — déplacer ou supprimer
                      </p>
                      <ul className="mt-2 grid gap-3 sm:grid-cols-2">
                        {occurrences.map((occurrence, index) => {
                          const count = idCounts.get(occurrence.id) ?? 1;
                          return (
                            <li
                              key={`${occurrence.start}-${occurrence.id}`}
                              className="rounded-xl border border-neutral-300 bg-surface p-2 text-sm dark:border-white/10 dark:bg-night-800"
                            >
                              <span className="block text-xs font-bold text-neutral-600 dark:text-neutral-300">
                                #{index + 1} · <code>[[youtube:{occurrence.id}]]</code>
                                {count > 1 && (
                                  <span className="ml-2 rounded-full bg-guinea-yellow/20 px-2 py-0.5 text-[10px] font-bold text-guinea-yellow">
                                    {count}× ce bloc — la page publique affichera {count} lecteurs
                                  </span>
                                )}
                              </span>
                              <span className="mt-1.5 block text-xs text-neutral-400">
                                {youtubeWatchUrl(occurrence.id)}
                              </span>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={youtubeThumbnailUrl(occurrence.id, "mq")}
                                alt={`Aperçu de la vidéo YouTube ${occurrence.id}`}
                                loading="lazy"
                                className="mt-2 w-full rounded-lg"
                              />
                              <div className="mt-2 grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => moveOccurrence(index)}
                                  className="rounded-lg border border-neutral-300 px-2 py-2 text-xs font-bold text-neutral-600 transition-colors hover:bg-neutral-100 dark:border-white/15 dark:text-neutral-300 dark:hover:bg-white/10"
                                >
                                  Déplacer au curseur
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeOccurrence(index)}
                                  className="rounded-lg border border-guinea-red/40 bg-guinea-red/10 px-2 py-2 text-xs font-bold text-guinea-red transition-colors hover:bg-guinea-red/20"
                                >
                                  Supprimer
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                      <p className="mt-2 text-[11px] text-neutral-400">
                        « Déplacer au curseur » retire le bloc de sa position
                        actuelle et le place à la dernière position connue du
                        curseur. « Supprimer » retire uniquement ce bloc.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── Colonne latérale ─── */}
        <div className="flex flex-col gap-5">
          <div>
            <label htmlFor="status" className={labelClass}>
              Statut *
            </label>
            <select
              id="status"
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as ArticleWithRelations["status"])}
              className={inputClass}
            >
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">
              Les boutons ci-dessous appliquent le statut en un clic
              (brouillon, publier, programmer). Ce menu reste utile pour les
              autres transitions (soumettre à validation, archiver) via
              « Transition avancée ».
            </p>
            {!isStaff && (
              <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">
                En tant que reporter, vos articles sont relus par un éditeur
                avant publication.
              </p>
            )}
            <FieldError errors={state.fieldErrors} name="status" />
          </div>

          {status === "scheduled" && (
            <div>
              <label htmlFor="scheduled_at" className={labelClass}>
                Date et heure de publication *
              </label>
              <input
                id="scheduled_at"
                name="scheduled_at"
                type="datetime-local"
                defaultValue={toLocalInput(article?.scheduled_at ?? null)}
                className={inputClass}
              />
              <p className="mt-1 text-[11px] text-neutral-400">
                L’article passera automatiquement en ligne à cette échéance.
              </p>
              <FieldError errors={state.fieldErrors} name="scheduled_at" />
            </div>
          )}

          <div>
            <label htmlFor="category_id" className={labelClass}>
              Rubrique
            </label>
            <select id="category_id" name="category_id" defaultValue={article?.category_id ?? ""} className={inputClass}>
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
            <p className={labelClass}>Image de couverture</p>
            {/* Sélection depuis l'appareil + compression + téléversement ;
                met à jour coverUrl qui est transmis dans featured_image. */}
            <CoverImageUploader value={coverUrl} onChange={setCoverUrl} />
            <input
              id="featured_image"
              name="featured_image"
              type="url"
              maxLength={500}
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              placeholder="URL de la couverture (remplie automatiquement après téléversement)"
              className={`${inputClass} mt-3`}
            />
            <p className="mt-1 text-[11px] text-neutral-400">
              Ou collez une URL de la{" "}
              <Link href="/admin/medias" className="font-semibold text-guinea-red hover:underline">
                médiathèque
              </Link>
              . Aucun ancien média n&apos;est supprimé automatiquement.
            </p>
            <FieldError errors={state.fieldErrors} name="featured_image" />

            <div className="mt-3">
              <label htmlFor="featured_image_alt" className={labelClass}>
                Texte alternatif (ALT)
              </label>
              <input
                id="featured_image_alt"
                name="featured_image_alt"
                type="text"
                maxLength={300}
                defaultValue={article?.featured_image_alt ?? ""}
                placeholder="Décrit l'image pour les malvoyants et les moteurs de recherche"
                className={inputClass}
              />
              <FieldError errors={state.fieldErrors} name="featured_image_alt" />
            </div>
          </div>

          {isStaff && (
            <>
              <div>
                <label htmlFor="tags" className={labelClass}>
                  Tags (séparés par des virgules)
                </label>
                <input
                  id="tags"
                  name="tags"
                  type="text"
                  defaultValue={(article?.tags ?? []).map((t) => t.name).join(", ")}
                  placeholder="Conakry, économie, éducation"
                  className={inputClass}
                />
                <p className="mt-1 text-[11px] text-neutral-400">10 tags maximum, 40 caractères chacun.</p>
                <FieldError errors={state.fieldErrors} name="tags" />
              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-neutral-200 px-4 py-3 text-sm font-semibold dark:border-white/10">
                <input
                  type="checkbox"
                  name="is_featured"
                  defaultChecked={article?.is_featured ?? false}
                  className="h-4 w-4 accent-guinea-red"
                />
                Mettre à la une sur l’accueil
              </label>
            </>
          )}

          <details className="rounded-xl border border-neutral-200 dark:border-white/10">
            <summary className="cursor-pointer list-none px-4 py-3 text-xs font-bold uppercase tracking-wide text-neutral-500">
              Référencement (SEO)
            </summary>
            <div className="flex flex-col gap-4 px-4 pb-4">
              <div>
                <label htmlFor="meta_title" className={labelClass}>
                  Titre SEO (200 max)
                </label>
                <input
                  id="meta_title"
                  name="meta_title"
                  type="text"
                  maxLength={200}
                  defaultValue={article?.meta_title ?? ""}
                  className={inputClass}
                />
                <FieldError errors={state.fieldErrors} name="meta_title" />
              </div>
              <div>
                <label htmlFor="meta_description" className={labelClass}>
                  Description SEO (300 max)
                </label>
                <textarea
                  id="meta_description"
                  name="meta_description"
                  rows={3}
                  maxLength={300}
                  defaultValue={article?.meta_description ?? ""}
                  className={inputClass}
                />
                <FieldError errors={state.fieldErrors} name="meta_description" />
              </div>
            </div>
          </details>

          <div>
            <label htmlFor="slug" className={labelClass}>
              Slug (facultatif — généré depuis le titre)
            </label>
            <input
              id="slug"
              name="slug"
              type="text"
              maxLength={96}
              defaultValue={article?.slug ?? ""}
              placeholder="genere-automatiquement"
              className={inputClass}
            />
            <FieldError errors={state.fieldErrors} name="slug" />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-neutral-200 pt-5 dark:border-white/10">
        {/* Avertissement local pour la publication programmée (date manquante). */}
        {scheduleHint && (
          <p role="alert" className="rounded-xl border border-guinea-red/40 bg-guinea-red/10 px-4 py-3 text-sm font-medium text-guinea-red">
            {scheduleHint}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-end gap-3">
          {/* Enregistrement sans intention : applique le statut du menu (transitions avancées). */}
          <SubmitButton
            label="Transition avancée — statut du menu"
            pendingLabel="Enregistrement…"
            variant="neutral"
          />
          {isStaff && (
            <SubmitButton
              label="Programmer la publication"
              pendingLabel="Programmation…"
              variant="neutral"
              name="intent"
              value="schedule"
              onClick={guardSchedule}
            />
          )}
          {isStaff && (
            <SubmitButton
              label="Publier maintenant"
              pendingLabel="Publication…"
              variant="success"
              name="intent"
              value="publish"
              onClick={confirmPublish}
            />
          )}
          {isStaff ? (
            <SubmitButton
              label="Enregistrer comme brouillon"
              pendingLabel="Enregistrement…"
              name="intent"
              value="draft"
            />
          ) : (
            <>
              <SubmitButton
                label="Soumettre à validation"
                pendingLabel="Envoi…"
                name="intent"
                value="review"
              />
              <SubmitButton
                label="Enregistrer comme brouillon"
                pendingLabel="Enregistrement…"
                name="intent"
                value="draft"
              />
            </>
          )}
        </div>
      </div>
    </form>
  );
}