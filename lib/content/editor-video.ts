/**
 * Manipulation du corps Markdown pour l'éditeur d'articles — blocs vidéo
 * YouTube. Module PUR (aucun DOM, aucune dépendance) : le composant
 * ArticleForm n'applique que le résultat renvoyé, ce qui rend la chaîne
 * insertion/déplacement/suppression unitairement testable.
 *
 * Invariants (exigences éditeur) :
 *  - le bloc est TOUJOURS sur sa propre ligne, entourée de lignes vides ;
 *  - AUCUNE réécriture globale : seuls les caractères autour du point
 *    d'insertion / de l'occurrence manipulée sont touchés ;
 *  - une insertion au curseur REMPLACE la sélection courante (sélection
 *    vide = insertion simple) ;
 *  - un marqueur apparaissant plusieurs fois est listé à chaque
 *    occurrence (permet de supprimer un doublon) — la page publique
 *    rend chaque occurrence un lecteur, jamais plus ;
 *  - la position de curseur renvoyée est EXACTE (cartographie par
 *    préfixe commun après toute suppression).
 */

export type VideoInsertMode = "cursor" | "after-paragraph" | "end";

export interface VideoTextOperation {
  value: string;
  /** Position du curseur à RESTAURER après application (focus + caret). */
  caret: number;
  /**
   * Ancre lisible pour l'indicateur d'emplacement : extrait du texte
   * précédant immédiatement le bloc inséré (null au début d'un texte vide).
   */
  anchorExcerpt: string | null;
}

export interface VideoOccurrence {
  id: string;
  /** Bornes exactes du marqueur [[youtube:ID]] dans la valeur (index 0). */
  start: number;
  end: number;
}

const GAP = "\n\n";

const OCCURRENCE_RE = /\[\[youtube:([A-Za-z0-9_-]{11})\]\]/g;

/** Le bloc est revalidé ici aussi : 11 caractères stricts. */
function blockFor(id: string): string {
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) {
    throw new Error(`Identifiant vidéo invalide : ${JSON.stringify(id)}`);
  }
  return `[[youtube:${id}]]`;
}

/** Extrait lisible (fin du paragraphe précédent) pour l'indicateur UI. */
function tailExcerpt(text: string, max = 48): string | null {
  const paragraph = text.replace(/\s+$/, "").split(/\n\n+/).pop() ?? "";
  const clean = paragraph.replace(/\s+/g, " ").trim();
  if (!clean) return null;
  return clean.length <= max ? clean : `…${clean.slice(-max)}`;
}

/** Position du curseur bornée et remise en ordre (jamais hors du texte). */
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

/**
 * Cartographie EXACTE d'une position de curseur à travers une édition :
 * préfixe commun (avant le point d'édition rien ne bouge), décalage par
 * le delta de longueur au-delà (suppression contiguë). Aucune perte :
 * le résultat est toujours borné au nouveau contenu.
 */
function mapCaretAcrossEdit(
  oldValue: string,
  newValue: string,
  pos: number
): number {
  if (!Number.isFinite(pos)) return newValue.length;
  if (pos <= 0) return 0;
  if (pos >= oldValue.length) return newValue.length;
  const max = Math.min(oldValue.length, newValue.length, pos);
  let p = 0;
  while (p < max && oldValue[p] === newValue[p]) p += 1;
  if (p >= pos) return pos;
  const delta = oldValue.length - newValue.length;
  return pos - Math.min(pos - p, delta);
}

/**
 * Insère un bloc vidéo selon le mode choisi.
 *  - "cursor" : à la position demandée, en REMPLAÇANT la sélection
 *    [start, end) (sélection vide = insertion simple au curseur) ;
 *  - "after-paragraph" : à la fin du PARAGRAPHE contenant `start` ;
 *  - "end" : à la fin de l'article.
 * Le reste du contenu est intégralement conservé.
 */
export function insertYouTubeBlock(
  value: string,
  start: number,
  end: number,
  id: string,
  mode: VideoInsertMode = "cursor"
): VideoTextOperation {
  const b = blockFor(id);

  if (mode === "after-paragraph" || mode === "end") {
    const { start: s } = clampCaret(value, start, end);
    const point =
      mode === "end"
        ? value.length
        : (() => {
            const idx = value.indexOf(GAP, s);
            return idx === -1 ? value.length : idx;
          })();
    const left = value.slice(0, point).replace(/\s+$/, "");
    // "after-paragraph" : le texte après le point commence par le
    // séparateur de paragraphes déjà présent — il sert de ligne vide
    // APRÈS le bloc ("end" n'a jamais de texte après).
    const right = point < value.length ? value.slice(point) : "";
    const gapBefore = left ? GAP : "";
    const next = `${left}${gapBefore}${b}${right}`;
    return {
      value: next,
      caret: left.length + gapBefore.length + b.length,
      anchorExcerpt: tailExcerpt(left),
    };
  }

  const { start: s, end: e } = clampCaret(value, start, end);
  // Normalisation locale : le bloc est sur SA propre ligne, aucun autre
  // caractère du reste du texte n'est modifié.
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
 * Occurrences réelles des marqueurs valides dans la valeur — une par
 * apparition (SANS dédoublonnage) : l'éditeur peut repérer et corriger
 * un doublon. Les marqueurs isolés comme collés à du texte sont listés.
 */
export function findYouTubeOccurrences(value: string): VideoOccurrence[] {
  const out: VideoOccurrence[] = [];
  for (const m of value.matchAll(OCCURRENCE_RE)) {
    if (m.index === undefined) continue;
    out.push({ id: m[1], start: m.index, end: m.index + m[0].length });
  }
  return out;
}

/**
 * Supprime UNE occurrence. Si le marqueur est seul sur sa ligne (cas
 * normal), la ligne entière disparaît (+ la ligne vide résiduelle autour
 * de la jonction, sans jamais toucher le texte voisin) ; sinon seuls les
 * caractères du marqueur sont retirés, le reste de la ligne est gardé.
 * Le curseur renvoyé est la jonction (position exacte dans le nouveau
 * texte).
 */
export function deleteYouTubeOccurrence(
  value: string,
  occurrence: VideoOccurrence
): VideoTextOperation {
  const b = blockFor(occurrence.id);
  const at = clampCaret(value, occurrence.start, occurrence.end);
  const occ: VideoOccurrence = { id: occurrence.id, start: at.start, end: at.end };

  const lineStart =
    occ.start > 0 ? value.lastIndexOf("\n", occ.start - 1) + 1 : 0;
  const nl = value.indexOf("\n", occ.end);
  const lineEnd = nl === -1 ? value.length : nl;
  const line = value.slice(lineStart, lineEnd);

  if (line.trim() !== b) {
    // Marqueur collé à du texte (jamais produit par l'éditeur, possible
    // en édition manuelle) : retrait exact des caractères du marqueur.
    const next = value.slice(0, occ.start) + value.slice(occ.end);
    return { value: next, caret: occ.start, anchorExcerpt: null };
  }

  // Suppression de la ligne AVEC son retour à la ligne final.
  const remEnd = nl === -1 ? value.length : nl + 1;
  let next: string;

  // Cosmétique contigu, aucun autre caractère touché :
  //  - marqueur en TÊTE → la ligne vide résiduelle du début part ;
  //  - marqueur en FIN → la ligne vide résiduelle de fin part ;
  //  - jonction centrale → exactement une ligne vide ("\n\n").
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

/**
 * Déplace une occurrence vers la position de curseur demandée (la
 * sélection sous ce curseur est remplacée). Implémentation : suppression
 * exacte de l'occurrence, cartographie du curseur par préfixe commun,
 * puis insertion au curseur. Le contenu hors des deux points est
 * préservé à l'octet près.
 */
export function moveYouTubeOccurrence(
  value: string,
  occurrence: VideoOccurrence,
  start: number,
  end: number
): VideoTextOperation {
  const del = deleteYouTubeOccurrence(value, occurrence);
  const mapStart = mapCaretAcrossEdit(value, del.value, start);
  const mapEnd = mapCaretAcrossEdit(value, del.value, end);
  const ins = insertYouTubeBlock(del.value, mapStart, mapEnd, occurrence.id, "cursor");
  return {
    value: ins.value,
    caret: ins.caret,
    anchorExcerpt: ins.anchorExcerpt,
  };
}