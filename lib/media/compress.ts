/**
 * Compression d'images CÔTÉ NAVIGATEUR — directive §2.
 *
 * L'original ne quitte jamais la machine avant compression : canvas
 * redimensionne en préservant le ratio et ré-encode (ce qui supprime
 * au passage les métadonnées EXIF, y compris GPS). Résultat : WebP
 * (JPEG en repli si le navigateur ne sait pas encoder en WebP).
 *
 * ⚠ La compression navigateur n'est PAS un contrôle de sécurité :
 * le serveur revalide signature, MIME, dimensions et poids (sniff.ts).
 */

import {
  MediaPurpose,
  MediaVariant,
  PURPOSE_VARIANTS,
  VARIANT_PRESETS,
} from "./variants";

export interface CompressedVariant {
  variant: MediaVariant;
  file: File;
  fromBytes: number;
  toBytes: number;
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file);
  }
  // Repli ancien navigateur : décodage via <img>.
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "sync";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Image illisible"));
      img.src = url;
    });
    return img;
  } finally {
    // L'objet Image garde sa source : on libère après le draw.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

function dimensions(source: ImageBitmap | HTMLImageElement): { width: number; height: number } {
  if (source instanceof HTMLImageElement) {
    return { width: source.naturalWidth, height: source.naturalHeight };
  }
  return { width: source.width, height: source.height };
}

/** Encode une variante : ratio préservé, dimension plafonnée, WebP
 *  (repli JPEG), deux passes qualité si le poids visé n'est pas tenu. */
async function encodeVariant(
  file: File,
  variant: MediaVariant
): Promise<File | null> {
  const preset = VARIANT_PRESETS[variant];
  const bitmap = await loadBitmap(file);
  const { width, height } = dimensions(bitmap);
  if (!width || !height) return null;

  const scale = Math.min(1, preset.maxDim / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, w, h);
  if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();

  const tryEncode = (mime: string, quality: number) =>
    new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), mime, quality);
    });

  const prefersWebp = (() => {
    // Capacité d'encodage WebP testée sur un canvas 1×1.
    const probe = document.createElement("canvas");
    probe.width = 1;
    probe.height = 1;
    return probe.toDataURL("image/webp").startsWith("data:image/webp");
  })();

  const mime = prefersWebp ? "image/webp" : "image/jpeg";
  const ext = prefersWebp ? "webp" : "jpg";
  const fallbackMime = prefersWebp ? "image/jpeg" : null;

  let blob = await tryEncode(mime, preset.quality);
  if (!blob && fallbackMime) blob = await tryEncode(fallbackMime, preset.quality);
  // Poids visé dépassé → seconde passe à qualité réduite (jamais sous 0.5).
  if (blob && blob.size > preset.targetBytes) {
    const retry = await tryEncode(mime, Math.max(0.5, preset.quality - 0.2));
    if (retry && retry.size < blob.size) blob = retry;
  }
  if (!blob) return null;

  return new File([blob], `${variant}.${ext}`, { type: blob.type });
}

/**
 * Produit toutes les variantes du dossier demandé à partir du fichier
 * source. Les GIF animés ne sont pas recompressés (canvas les
 * aplatirait) : l'original est conservé sous réserve des plafonds
 * serveur. Renvoie null si le fichier est illisible.
 */
export async function compressForPurpose(
  file: File,
  purpose: MediaPurpose
): Promise<CompressedVariant[] | null> {
  // GIF : pas de ré-encodage (l'animation serait perdue).
  if (file.type === "image/gif") {
    return [
      { variant: PURPOSE_VARIANTS[purpose][0], file, fromBytes: file.size, toBytes: file.size },
    ];
  }

  const out: CompressedVariant[] = [];
  for (const variant of PURPOSE_VARIANTS[purpose]) {
    const encoded = await encodeVariant(file, variant);
    if (!encoded) return null;
    out.push({ variant, file: encoded, fromBytes: file.size, toBytes: encoded.size });
  }
  return out;
}