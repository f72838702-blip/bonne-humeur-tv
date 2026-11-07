/**
 * Marqueur image intégrée — SEULE porte d'insertion d'images dans le corps
 * d'un article (frère du marqueur vidéo [[youtube:ID]]).
 *
 * Format de BLOC stable (une seule ligne, exactement) :
 *   [[image:articles/1712345678-ab12cd34.webp]]
 *   [[image:articles/…webp|texte alternatif]]
 *   [[image:articles/…webp|texte alternatif|légende]]
 *
 * Règles de sécurité :
 *  - le champ n'est PAS une URL : c'est un CHEMIN Storage revalidé contre
 *    une liste stricte (dossier logique whitelisté, segments simples,
 *    sans « .. », extension contrôlée) — l'URL publique est construite
 *    par mediaPublicUrl à partir de la configuration serveur ;
 *  - alt et légende sont encodés (encodeURIComponent) : aucun caractère
 *    « | » ni « ]] » ne peut fermer le marqueur prématurément ;
 *  - un marqueur malformé (chemin hors liste, trop long, …) N'EST JAMAIS
 *    reconnu comme image : la ligne reste du Markdown ordinaire échappé
 *    (même politique que le marqueur vidéo).
 *
 * Module PUR : partagé rendu public / éditeur / validation serveur.
 */

import { MEDIA_PURPOSES } from "@/lib/media/variants";

/** Extensions acceptées (mêmes formats que le pipeline Storage). */
const IMAGE_EXTENSIONS = ["webp", "jpg", "jpeg", "png", "gif"] as const;

const PATH_RE = new RegExp(
  `^(${MEDIA_PURPOSES.join("|")})\\/[A-Za-z0-9][A-Za-z0-9._-]*\\.(${IMAGE_EXTENSIONS.join("|")})$`
);

/** Marqueur complet : chemin + alt + légende optionnels (encodés). */
const MARKER_RE = /^\[\[image:([^|\]\n]+)(?:\|([^|\]\n]*))?(?:\|([^|\]\n]*))?\]\]$/;

export const IMAGE_ALT_MAX = 300;
export const IMAGE_CAPTION_MAX = 500;

function encodeParam(value: string): string {
  // Aucun saut de ligne (impossible à ressaisir proprement) ; le reste
  // est encodé par encodeURIComponent — « | » et « ] » deviennent %xx.
  return encodeURIComponent(value.replace(/\s+/g, " ").trim());
}

function decodeParam(value: string | undefined): string {
  if (!value) return "";
  try {
    return decodeURIComponent(value).trim();
  } catch {
    // Séquence % invalide : la ligne est traitée comme non valide.
    return "";
  }
}

/** Marqueur image revalidé → partie exploitable, ou null (ligne texte). */
export interface ParsedImageMarker {
  path: string;
  alt: string;
  caption: string;
}

export function parseImageMarker(line: string): ParsedImageMarker | null {
  const match = MARKER_RE.exec(line.trim());
  if (!match) return null;
  const path = match[1] ?? "";
  if (!PATH_RE.test(path)) return null;
  const alt = decodeParam(match[2]);
  const caption = decodeParam(match[3]);
  // Une partie non décodable (séquence % invalide) rend la ligne texte.
  if ((match[2] && !alt) || (match[3] && !caption)) return null;
  if (alt.length > IMAGE_ALT_MAX || caption.length > IMAGE_CAPTION_MAX) return null;
  return { path, alt, caption };
}

/** Construit le bloc marqueur (chaîne complète, encodée, bornée). */
export function buildImageMarker(path: string, alt = "", caption = ""): string {
  if (!PATH_RE.test(path)) {
    throw new Error(`Chemin d'image invalide : ${JSON.stringify(path)}`);
  }
  const cleanAlt = encodeParam(alt.slice(0, IMAGE_ALT_MAX));
  const cleanCaption = encodeParam(caption.slice(0, IMAGE_CAPTION_MAX));
  if (cleanCaption) return `[[image:${path}|${cleanAlt}|${cleanCaption}]]`;
  if (cleanAlt) return `[[image:${path}|${cleanAlt}]]`;
  return `[[image:${path}]]`;
}

/** URL publique Storage d'un chemin image (config serveur, jamais d'URL arbitraire). */
export function mediaPublicUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/media/${path}`;
}

/**
 * Inverse : extrait le chemin Storage revalidé d'une URL publique du
 * bucket (uniquement nos propres URLs — toute autre URL → null). Un
 * upload réussi renvoie une URL ; le corps de l'article ne conserve que
 * le chemin, revalidé ici AVANT insertion du marqueur.
 */
export function storagePathFromUrl(url: string): string | null {
  if (!url) return null;
  const marker = "/storage/v1/object/public/media/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const path = url.slice(idx + marker.length);
  return PATH_RE.test(path) ? path : null;
}

/** Chemins image valides d'un corps Markdown (dédoublonnés, ordre conservé). */
export function extractArticleImagePaths(markdown: string): string[] {
  return [...new Set(
    markdown
      .split(/\r?\n/)
      .map((l) => parseImageMarker(l.trim())?.path)
      .filter((p): p is string => Boolean(p))
  )];
}

/**
 * Validation SÉCURISÉE de tous les marqueurs d'un contenu ( appelée par
 * saveArticle) : chaque ligne contenant « [[image: » doit être un
 * marqueur VALIDE, sinon l'enregistrement est refusé avec la ligne
 * fautive. Un marqueur inconnu s'il restait du texte ne serait pas
 * rendu comme image — on refuse plutôt que d'accepter un marqueur
 * silencieusement inerte.
 */
export function validateImageMarkers(
  markdown: string
): { line: number; reason: string }[] {
  const problems: { line: number; reason: string }[] = [];
  const lines = markdown.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].includes("[[image:")) continue;
    if (parseImageMarker(lines[i])) continue;
    problems.push({
      line: i + 1,
      reason: lines[i].trim().slice(0, 60),
    });
  }
  return problems;
}
