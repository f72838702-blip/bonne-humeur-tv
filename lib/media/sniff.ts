/**
 * Analyse binaire des images téléversées — SERVEUR UNIQUEMENT.
 *
 * Directive §2 : la compression côté navigateur ne constitue PAS une
 * protection de sécurité. Le serveur doit vérifier la signature réelle
 * (magic bytes), le MIME véritable, les dimensions et le poids — les
 * SVG, exécutables et fichiers déguisés sont refusés (fail-closed).
 *
 * Module pur (aucune dépendance) → testable hors navigateur.
 */

export type SniffedMime = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

export interface SniffedImage {
  mime: SniffedMime;
  width: number;
  height: number;
}

/** Dimension absolue maximale acceptée, quelle que soit la variante. */
export const MAX_IMAGE_DIMENSION = 4000;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function be16(b: Uint8Array, i: number): number {
  return (b[i] << 8) | b[i + 1];
}

function be32(b: Uint8Array, i: number): number {
  return ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
}

function le16(b: Uint8Array, i: number): number {
  return b[i] | (b[i + 1] << 8);
}

function startsWith(b: Uint8Array, prefix: number[]): boolean {
  return prefix.every((v, i) => b[i] === v);
}

/** JPEG : balayage des marqueurs SOFn (dimensions dans SOF0/SOF2…). */
function sniffJpeg(b: Uint8Array): SniffedImage | null {
  if (b[0] !== 0xff || b[1] !== 0xd8 || b[2] !== 0xff) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) {
      i += 2; // marqueur autonome
      continue;
    }
    const length = be16(b, i + 2);
    // SOF0…SOF15, hors DHT (C4), JPEG-extended (C8) et DAC (CC).
    const isSof =
      marker >= 0xc0 && marker <= 0xcf &&
      marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      return {
        mime: "image/jpeg",
        height: be16(b, i + 5),
        width: be16(b, i + 7),
      };
    }
    i += 2 + length;
  }
  return null;
}

function sniffPng(b: Uint8Array): SniffedImage | null {
  if (!startsWith(b, PNG_SIGNATURE)) return null;
  return {
    mime: "image/png",
    width: be32(b, 16),
    height: be32(b, 20),
  };
}

function sniffGif(b: Uint8Array): SniffedImage | null {
  const header = String.fromCharCode(...b.slice(0, 6));
  if (header !== "GIF87a" && header !== "GIF89a") return null;
  return {
    mime: "image/gif",
    width: le16(b, 6),
    height: le16(b, 8),
  };
}

/** WebP : VP8X (étendu), VP8 (lossy) ou VP8L (lossless). */
function sniffWebp(b: Uint8Array): SniffedImage | null {
  const riff = String.fromCharCode(...b.slice(0, 4));
  const webp = String.fromCharCode(...b.slice(8, 12));
  if (riff !== "RIFF" || webp !== "WEBP") return null;
  const fourcc = String.fromCharCode(...b.slice(12, 16));

  if (fourcc === "VP8X") {
    // Canvas : width-1 et height-1 en 24 bits little-endian (offsets 24-29).
    const width = (b[24] | (b[25] << 8) | (b[26] << 16)) + 1;
    const height = (b[27] | (b[28] << 8) | (b[29] << 16)) + 1;
    return { mime: "image/webp", width, height };
  }
  if (fourcc === "VP8L") {
    // Signature 0x2F puis width-1 (14 bits) et height-1 (14 bits).
    if (b[20] !== 0x2f) return null;
    const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >>> 14) & 0x3fff) + 1;
    return { mime: "image/webp", width, height };
  }
  if (fourcc === "VP8 ") {
    // Code de synchronisation 0x9D 0x01 0x2A puis 14+14 bits.
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    const width = (b[26] | (b[27] << 8)) & 0x3fff;
    const height = (b[28] | (b[29] << 8)) & 0x3fff;
    return { mime: "image/webp", width, height };
  }
  return null;
}

/**
 * Signature + dimensions réelles d'une image. Retourne null pour tout
 * fichier non image connu : SVG, exécutables, fichiers renommés, etc.
 * (fail-closed : pas de liste de « suspects », seulement des formats
 * explicitement supportés).
 */
export function sniffImage(bytes: Uint8Array): SniffedImage | null {
  if (bytes.length < 16) return null;
  return sniffJpeg(bytes) ?? sniffPng(bytes) ?? sniffGif(bytes) ?? sniffWebp(bytes);
}