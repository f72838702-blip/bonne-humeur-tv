import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { sniffImage, MAX_IMAGE_DIMENSION } from "@/lib/media/sniff";
import {
  MEDIA_PURPOSES,
  MEDIA_VARIANTS,
  MediaPurpose,
  MediaVariant,
  PURPOSE_VARIANTS,
  SERVER_MAX_BYTES,
  SERVER_MAX_DIM,
  variantSuffix,
  MAIN_VARIANT,
} from "@/lib/media/variants";

/**
 * Médiathèque — Supabase Storage (bucket « media », public en lecture).
 * Toutes les écritures passent par le client service_role CÔTÉ SERVEUR :
 * aucun upload anonyme possible (aucune policy d'écriture).
 *
 * Directive §2 : dossiers logiques (articles/, categories/, thumbnails/,
 * reporters/, branding/), variantes pré-comprimées (le navigateur
 * compresse, le serveur REVALIDE), signature binaire obligatoire.
 * Aucune image n'est hébergée sur le serveur applicatif.
 */

export const MEDIA_BUCKET = "media";

/** Poids absolu du fichier source (garde finale, alignée sur le plafond
 *  du bucket Storage — migration 0008). */
const ABSOLUTE_MAX_BYTES = 2 * 1024 * 1024; // 2 Mo

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export interface MediaObject {
  name: string;
  path: string;
  size: number;
  type: string;
  url: string;
  purpose: MediaPurpose;
}

export interface MediaListResult {
  objects: MediaObject[];
  unavailable: boolean;
}

function publicUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;
}

function isPurpose(value: string): value is MediaPurpose {
  return (MEDIA_PURPOSES as readonly string[]).includes(value);
}

function isVariant(value: string): value is MediaVariant {
  return (MEDIA_VARIANTS as readonly string[]).includes(value);
}

/** Liste les dossiers logiques autorisés (jamais le bucket entier). */
export async function listMedia(): Promise<MediaListResult> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { objects: [], unavailable: true };

  const objects: MediaObject[] = [];
  let unavailable = false;

  for (const purpose of MEDIA_PURPOSES) {
    const { data, error } = await admin.storage.from(MEDIA_BUCKET).list(purpose, {
      limit: 100,
      sortBy: { column: "created_at", order: "desc" },
    });
    if (error) {
      console.error("[data/media] listMedia", purpose, ":", error.message);
      unavailable = true;
      continue;
    }
    for (const o of data ?? []) {
      // Dossiers imbriqués éventuels et fichiers cachés ignorés.
      if (o.id === null || o.name.startsWith(".") || o.name.includes("/")) continue;
      objects.push({
        name: o.name,
        path: `${purpose}/${o.name}`,
        size: o.metadata?.size ?? 0,
        type: o.metadata?.mimetype ?? "",
        url: publicUrl(`${purpose}/${o.name}`),
        purpose,
      });
    }
  }

  // Les plus récents d'abord, quelle que soit la limite par dossier.
  objects.reverse();
  return { objects, unavailable };
}

/** Un seul lot = une base de nom commune à toutes les variantes. */
export interface UploadVariantInput {
  variant: MediaVariant;
  file: File;
}

export interface UploadResult {
  ok: boolean;
  url?: string;
  variants?: string[];
  error?: string;
}

/**
 * Validation SERVEUR d'une variante (directive §2 — la compression
 * navigateur n'est pas un contrôle de sécurité) :
 *   1. variante autorisée pour ce dossier ;
 *   2. plafonds de poids (absolu + par variante) ;
 *   3. signature binaire réelle (magic bytes) — SVG et exécutables
 *      refusés, MIME déclaré doit correspondre au MIME sniffé ;
 *   4. dimensions réelles dans les plafonds de la variante.
 */
async function validateVariant(
  purpose: MediaPurpose,
  { variant, file }: UploadVariantInput
): Promise<
  | { ok: true; ext: string; mime: string; bytes: ArrayBuffer }
  | { ok: false; error: string }
> {
  if (!PURPOSE_VARIANTS[purpose].includes(variant)) {
    return { ok: false, error: `Variante « ${variant} » non autorisée pour « ${purpose} »` };
  }
  if (file.size === 0) return { ok: false, error: "Fichier vide" };
  if (file.size > ABSOLUTE_MAX_BYTES) {
    return { ok: false, error: "Fichier trop lourd (2 Mo maximum)" };
  }
  if (file.size > SERVER_MAX_BYTES[variant]) {
    return { ok: false, error: `Poids trop élevé pour la variante « ${variant} »` };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffImage(bytes);
  if (!sniffed) {
    return { ok: false, error: "Fichier non reconnu comme image (SVG et exécutables refusés)" };
  }
  const ext = EXT_BY_MIME[sniffed.mime];
  if (!ext) return { ok: false, error: `Format image non autorisé (${sniffed.mime})` };
  if (file.type && file.type !== sniffed.mime) {
    return { ok: false, error: `Type déclaré (${file.type}) différent du contenu réel (${sniffed.mime})` };
  }
  if (
    sniffed.width <= 0 || sniffed.height <= 0 ||
    sniffed.width > MAX_IMAGE_DIMENSION || sniffed.height > MAX_IMAGE_DIMENSION
  ) {
    return { ok: false, error: "Dimensions invalides (4000 px maximum)" };
  }
  if (sniffed.width > SERVER_MAX_DIM[variant] || sniffed.height > SERVER_MAX_DIM[variant]) {
    return { ok: false, error: `Dimensions trop grandes pour la variante « ${variant} » (max ${SERVER_MAX_DIM[variant]} px)` };
  }
  return { ok: true, ext, mime: sniffed.mime, bytes: bytes.buffer };
}

/**
 * Téléverse le lot complet des variantes d'une image dans son dossier
 * logique, sous un nom commun : base.webp (variante principale),
 * base-card.webp, base-thumb.webp… Renvoie l'URL de la variante
 * principale ; les autres se déduisent via mediaVariantUrl().
 */
export async function uploadMediaVariants(
  purpose: MediaPurpose,
  variants: UploadVariantInput[]
): Promise<UploadResult> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false, error: "storage_not_configured" };

  if (!isPurpose(purpose)) return { ok: false, error: "Dossier de destination invalide" };
  if (variants.length === 0) return { ok: false, error: "Aucune variante fournie" };
  const main = MAIN_VARIANT[purpose];
  if (!variants.some((v) => v.variant === main)) {
    return { ok: false, error: `La variante principale « ${main} » est requise` };
  }

  const validated: { variant: MediaVariant; ext: string; mime: string; bytes: ArrayBuffer }[] = [];
  for (const input of variants) {
    if (!isVariant(input.variant)) return { ok: false, error: "Variante inconnue" };
    const check = await validateVariant(purpose, input);
    if (!check.ok) return { ok: false, error: check.error };
    validated.push({ variant: input.variant, ext: check.ext, mime: check.mime, bytes: check.bytes });
  }

  const base = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  for (const v of validated) {
    const path = `${purpose}/${base}${variantSuffix(v.variant)}.${v.ext}`;
    const { error } = await admin.storage.from(MEDIA_BUCKET).upload(path, v.bytes, {
      contentType: v.mime,
      upsert: false,
    });
    if (error) {
      console.error("[data/media] uploadMediaVariants", path, ":", error.message);
      return { ok: false, error: error.message };
    }
  }

  const mainExt = validated.find((v) => v.variant === main)?.ext ?? "webp";
  const mainPath = `${purpose}/${base}${variantSuffix(main)}.${mainExt}`;
  return {
    ok: true,
    url: publicUrl(mainPath),
    variants: validated.map((v) => publicUrl(`${purpose}/${base}${variantSuffix(v.variant)}.${v.ext}`)),
  };
}

export async function deleteMedia(
  path: string
): Promise<{ ok: boolean; error?: string }> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false, error: "storage_not_configured" };

  // Sécurité : uniquement un fichier direct d'un dossier autorisé,
  // sans remontée de répertoire.
  const purpose = path.split("/")[0] ?? "";
  if (
    !isPurpose(purpose) ||
    path.includes("..") ||
    path.split("/").length !== 2 ||
    path.split("/")[1].startsWith(".")
  ) {
    return { ok: false, error: "Chemin refusé" };
  }

  const { error } = await admin.storage.from(MEDIA_BUCKET).remove([path]);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}