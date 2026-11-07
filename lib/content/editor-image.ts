/**
 * Manipulation du corps Markdown pour l'éditeur d'articles — blocs images
 * intégrées. Module PUR (aucun DOM, aucune dépendance) — même architecture
 * que lib/content/editor-video.ts (le module vidéo n'est PAS touché) :
 * le composant ArticleForm n'applique que le résultat renvoyé.
 *
 * Invariants (identiques aux blocs vidéo) :
 *  - le bloc est TOUJOURS sur sa propre ligne, entourée de lignes vides ;
 *  - AUCUNE réécriture globale : seuls les caractères autour du point
 *    d'insertion / de l'occurrence manipulée sont touchés ;
 *  - une insertion au curseur REMPLACE la sélection courante ;
 *  - la position de curseur renvoyée est EXACTE.
 */

import { buildImageMarker, parseImageMarker } from "./image-marker";

export interface ImageTextOperation {
  value: string;
  caret: number;
  anchorExcerpt: string | null;
}

export interface ImageOccurrence {
  path: string;
  alt: string;
  caption: string;
  start: number;
  end: number;
}

const GAP = "\n\n";

const OCCURRENCE_RE = /\[\[image:[^|\]\n]*(?:\|[^|\]\n]*){0,2}\]\]/g;

function clampCaret(
  value: string,
  start: number,
  end: number
): { start: number; end: number } {
  const max = value.length;
  let s = Number.isFinite(start) ? Math.max(0, Math.min(start, max)) : max;
  let e = Number.isFinite(end) ? Math.max(s, Math.min(end, max)) : s;
  return { start: s, end: e };
}

/** Extrait lisible (fin du paragraphe précédent) pour l'indicateur UI. */
function tailExcerpt(text: string, max = 48): string | null {
  const paragraph = text.replace(/\s+$/, "").split(/\n\n+/).pop() ?? "";
  const clean = paragraph.replace(/\s+/g, " ").trim();
  if (!clean) return null;
  return clean.length <= max ? clean : `…${clean.slice(-max)}`;
}

/**
 * Insère un bloc image à la position demandée, en REMPLAÇANT la
 * sélection [start, end) (sélection vide = insertion simple). Le reste
 * du contenu est intégralement conservé.
 */
export function insertImageBlock(
  value: string,
  start: number,
  end: number,
  path: string,
  alt = "",
  caption = ""
): ImageTextOperation {
  const b = buildImageMarker(path, alt, caption);
  const { start: s, end: e } = clampCaret(value, start, end);
  const before = value.slice(0, s).replace(/\s+$/, "");
  const after = value.slice(e).replace(/^\s+/, "");
  const gapBefore = before ? GAP : "";
  const gapAfter = after ? GAP : "";
  const next = `${before}${gapBefore}${b}${gapAfter}${after}`;
  return {
    value: next,
    caret: before.length + gapBefore.length + b.length,
    anchorExcerpt: tailExcerpt(before),
  };
}

/**
 * Occurrences réelles des marqueurs images VALIDES dans la valeur —
 * une par apparition (SANS dédoublonnage). Les marqueurs malformés ne
 * sont pas listés (ils restent du texte visible dans le textarea).
 */
export function findImageOccurrences(value: string): ImageOccurrence[] {
  const out: ImageOccurrence[] = [];
  // parseImageMarker est revalué ici (2e barrière, comme pour les vidéos) :
  // seul un marqueur complet valide est géré par l'éditeur.
  for (const m of value.matchAll(OCCURRENCE_RE)) {
    if (m.index === undefined) continue;
    const parsed = parseImageMarker(m[0]);
    if (!parsed) continue;
    out.push({
      ...parsed,
      start: m.index,
      end: m.index + m[0].length,
    });
  }
  return out;
}

/**
 * Réécrit l'alt / la légende d'UNE occurrence (le marqueur est
 * reconstruit en place, le reste du contenu inchangé à l'octet près).
 * Le curseur renvoyé se place après le marqueur réécrit.
 */
export function updateImageOccurrence(
  value: string,
  occurrence: ImageOccurrence,
  alt: string,
  caption: string
): ImageTextOperation {
  const occ = clampCaret(value, occurrence.start, occurrence.end);
  const marker = buildImageMarker(occurrence.path, alt, caption);
  const next = value.slice(0, occ.start) + marker + value.slice(occ.end);
  return {
    value: next,
    caret: occ.start + marker.length,
    anchorExcerpt: null,
  };
}

/**
 * Supprime UNE occurrence : si le marqueur est seul sur sa ligne (cas
 * normal), la ligne entière disparaît (+ la ligne vide résiduelle, sans
 * jamais toucher le texte voisin) ; sinon seuls les caractères du
 * marqueur sont retirés. Le curseur renvoyé est la jonction.
 */
export function deleteImageOccurrence(
  value: string,
  occurrence: ImageOccurrence
): ImageTextOperation {
  const occ = clampCaret(value, occurrence.start, occurrence.end);
  const target = value.slice(occ.start, occ.end);

  const lineStart =
    occ.start > 0 ? value.lastIndexOf("\n", occ.start - 1) + 1 : 0;
  const nl = value.indexOf("\n", occ.end);
  const lineEnd = nl === -1 ? value.length : nl;
  const line = value.slice(lineStart, lineEnd);
  const trimmed = line.trim();

  if (trimmed !== target.trim()) {
    // Marqueur collé à du texte (éditon manuelle) : retrait exact.
    const next = value.slice(0, occ.start) + value.slice(occ.end);
    return { value: next, caret: occ.start, anchorExcerpt: null };
  }

  const remEnd = nl === -1 ? value.length : nl + 1;
  let next: string;
  if (lineStart === 0) {
    next = value.slice(remEnd).replace(/^\n+/, "");
  } else if (remEnd === value.length) {
    next = value.slice(0, lineStart).replace(/\n+$/, "");
  } else {
    const left = value.slice(0, lineStart).replace(/\n+$/, "");
    const right = value.slice(remEnd).replace(/^\n+/, "");
    if (!left) next = right;
    else if (!right) next = left;
    else next = `${left}${GAP}${right}`;
  }
  const caret = Math.min(lineStart, next.length);
  return { value: next, caret, anchorExcerpt: null };
}
