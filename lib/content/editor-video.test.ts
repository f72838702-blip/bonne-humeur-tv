import { describe, expect, it } from "vitest";
import {
  deleteYouTubeOccurrence,
  findYouTubeOccurrences,
  insertYouTubeBlock,
  moveYouTubeOccurrence,
} from "./editor-video";

const ID_A = "46eoreAaqVM";
const ID_B = "dQw4w9WgXcQ";
const BLOCK_A = `[[youtube:${ID_A}]]`;
const BLOCK_B = `[[youtube:${ID_B}]]`;

describe("insertYouTubeBlock — curseur (remplace la sélection)", () => {
  it("texte vide → le bloc devient tout le contenu, curseur après le bloc", () => {
    const op = insertYouTubeBlock("", 0, 0, ID_A, "cursor");
    expect(op.value).toBe(BLOCK_A);
    expect(op.caret).toBe(BLOCK_A.length);
  });

  it("insertion au milieu, le bloc est sur SA propre ligne, rien d'autre ne change", () => {
    const value = "Paragraphe un.\n\nParagraphe deux.";
    const caret = value.indexOf("Paragraphe deux");
    const op = insertYouTubeBlock(value, caret, caret, ID_A, "cursor");
    expect(op.value).toBe(
      "Paragraphe un.\n\n[[youtube:46eoreAaqVM]]\n\nParagraphe deux."
    );
    // Le curseur est restauré juste après le bloc.
    expect(op.caret).toBe(op.value.indexOf(BLOCK_A) + BLOCK_A.length);
  });

  it("une sélection est REMPLACÉE par le bloc (exigence éditeur)", () => {
    const value = "Avant TEXTE-SÉLECTIONNÉ Après";
    const start = value.indexOf("TEXTE-SÉLECTIONNÉ");
    const end = start + "TEXTE-SÉLECTIONNÉ".length;
    const op = insertYouTubeBlock(value, start, end, ID_A, "cursor");
    expect(op.value).toBe("Avant\n\n[[youtube:46eoreAaqVM]]\n\nAprès");
    expect(op.value).not.toContain("TEXTE-SÉLECTIONNÉ");
  });

  it("insertion au début — pas de ligne vide résiduelle au-dessus", () => {
    const op = insertYouTubeBlock("Premier paragraphe.", 0, 0, ID_A, "cursor");
    expect(op.value).toBe("[[youtube:46eoreAaqVM]]\n\nPremier paragraphe.");
  });

  it("insertion à la fin du texte (curseur en bout) — pas de double ligne vide", () => {
    const value = "Texte final.";
    const op = insertYouTubeBlock(value, value.length, value.length, ID_A, "cursor");
    expect(op.value).toBe("Texte final.\n\n[[youtube:46eoreAaqVM]]");
  });

  it("le reste du contenu est préservé à l'octet près", () => {
    const before = "Début du texte, **gras**, [lien](https://exemple.org) etc.";
    const after = "Fin du texte, toujours là.";
    const mid = `${before}\n\nmilieu\n\n${after}`;
    const caret = mid.indexOf("milieu");
    const op = insertYouTubeBlock(mid, caret, caret + 6, ID_A, "cursor");
    expect(op.value).toBe(`${before}\n\n${BLOCK_A}\n\n${after}`);
  });

  it("curseur hors bornes est borné (aucune exception, aucun texte perdu)", () => {
    const op = insertYouTubeBlock("abc", 9999, -5, ID_A, "cursor");
    expect(op.value).toBe("abc\n\n[[youtube:46eoreAaqVM]]");
  });

  it("identifiant injetable refusé (revalidation stricte)", () => {
    expect(() => insertYouTubeBlock("abc", 0, 0, "12-charach!", "cursor")).toThrow();
    expect(() => insertYouTubeBlock("abc", 0, 0, "<script></s>", "cursor")).toThrow();
  });
});

describe("insertYouTubeBlock — après le paragraphe courant", () => {
  const value = "Para un.\n\nPara deux.\n\nPara trois.";

  it("curseur dans le 2e paragraphe → bloc juste après ce paragraphe", () => {
    const caret = value.indexOf("deux");
    const op = insertYouTubeBlock(value, caret, caret, ID_A, "after-paragraph");
    expect(op.value).toBe(
      "Para un.\n\nPara deux.\n\n[[youtube:46eoreAaqVM]]\n\nPara trois."
    );
  });

  it("dernier paragraphe (pas de séparateur après) → bloc à la fin", () => {
    const caret = value.indexOf("trois");
    const op = insertYouTubeBlock(value, caret, caret, ID_A, "after-paragraph");
    expect(op.value).toBe(
      "Para un.\n\nPara deux.\n\nPara trois.\n\n[[youtube:46eoreAaqVM]]"
    );
  });

  it("ancre lisible = extrait du paragraphe précédent", () => {
    const op = insertYouTubeBlock(
      value, value.indexOf("deux"), value.indexOf("deux"), ID_A, "after-paragraph"
    );
    expect(op.anchorExcerpt).toBe("Para deux.");
  });
});

describe("insertYouTubeBlock — fin de l'article", () => {
  it("append avec séparation", () => {
    const op = insertYouTubeBlock("Contenu.", 0, 0, ID_A, "end");
    expect(op.value).toBe("Contenu.\n\n[[youtube:46eoreAaqVM]]");
  });

  it("sur un article vide", () => {
    const op = insertYouTubeBlock("", 0, 0, ID_A, "end");
    expect(op.value).toBe(BLOCK_A);
  });
});

describe("findYouTubeOccurrences — une entrée par apparition (doublons visibles)", () => {
  it("liste chaque occurrence, positions exactes, sans dédupliquer", () => {
    const value = `${BLOCK_A}\n\nPara.\n\n${BLOCK_A}\n\n${BLOCK_B}`;
    const occ = findYouTubeOccurrences(value);
    expect(occ).toHaveLength(3);
    expect(occ[0]).toEqual({ id: ID_A, start: 0, end: BLOCK_A.length });
    expect(occ[1].id).toBe(ID_A);
    expect(occ[2].id).toBe(ID_B);
    // Les bornes découpent exactement le marqueur.
    expect(value.slice(occ[1].start, occ[1].end)).toBe(BLOCK_A);
    expect(value.slice(occ[2].start, occ[2].end)).toBe(BLOCK_B);
  });

  it("un marqueur malformé n'est pas listé", () => {
    expect(findYouTubeOccurrences("[[youtube:12charach]]")).toHaveLength(0);
  });
});

describe("deleteYouTubeOccurrence", () => {
  it("retire la ligne du marqueur + la ligne vide résiduelle (texte intact)", () => {
    const value = "Un.\n\n[[youtube:46eoreAaqVM]]\n\nDeux.";
    const op = deleteYouTubeOccurrence(value, findYouTubeOccurrences(value)[0]);
    expect(op.value).toBe("Un.\n\nDeux.");
  });

  it("marqueur en tête : pas de ligne vide résiduelle au début", () => {
    const op = deleteYouTubeOccurrence(`${BLOCK_A}\n\nUn.`, findYouTubeOccurrences(`${BLOCK_A}\n\nUn.`)[0]);
    expect(op.value).toBe("Un.");
  });

  it("marqueur en fin : pas de double ligne vide à la fin", () => {
    const value = `Un.\n\n${BLOCK_A}`;
    const op = deleteYouTubeOccurrence(value, findYouTubeOccurrences(value)[0]);
    expect(op.value).toBe("Un.");
  });

  it("supprime UNIQUEMENT l'occurrence ciblée — le doublon et l'autre vidéo restent", () => {
    const value = `${BLOCK_A}\n\nPara.\n\n${BLOCK_A}\n\n${BLOCK_B}`;
    const occurrences = findYouTubeOccurrences(value);
    const op = deleteYouTubeOccurrence(value, occurrences[1]); // 2e copie de A
    expect(findYouTubeOccurrences(op.value)).toEqual([
      expect.objectContaining({ id: ID_A }),
      expect.objectContaining({ id: ID_B }),
    ]);
    expect(op.value.startsWith(BLOCK_A)).toBe(true);
    expect(op.value.endsWith(BLOCK_B)).toBe(true);
  });

  it("curseur restauré à un point valide", () => {
    const value = `Un.\n\n${BLOCK_A}\n\nDeux.`;
    const op = deleteYouTubeOccurrence(value, findYouTubeOccurrences(value)[0]);
    expect(op.caret).toBeGreaterThanOrEqual(0);
    expect(op.caret).toBeLessThanOrEqual(op.value.length);
  });

  it("marqueur collé à du texte : seuls les caractères du marqueur partent", () => {
    const value = `Début${BLOCK_A}suite.`;
    const op = deleteYouTubeOccurrence(value, findYouTubeOccurrences(value)[0]);
    expect(op.value).toBe("Débutsuite.");
  });
});

describe("moveYouTubeOccurrence", () => {
  it("bloc du début → curseur au début du 2e paragraphe (position exacte)", () => {
    const value = `${BLOCK_A}\n\nPara un.\n\nPara deux.`;
    const occ = findYouTubeOccurrences(value)[0];
    const caret = value.indexOf("Para deux");
    const op = moveYouTubeOccurrence(value, occ, caret, caret);
    expect(op.value).toBe("Para un.\n\n[[youtube:46eoreAaqVM]]\n\nPara deux.");
  });

  it("bloc de fin → curseur au début du 2e paragraphe", () => {
    const value = `Para un.\n\nPara deux.\n\n${BLOCK_A}`;
    const occ = findYouTubeOccurrences(value)[0];
    const caret = value.indexOf("Para deux");
    const op = moveYouTubeOccurrence(value, occ, caret, caret);
    expect(op.value).toBe("Para un.\n\n[[youtube:46eoreAaqVM]]\n\nPara deux.");
  });

  it("déplacement avec SÉLECTION remplacée", () => {
    const value = `${BLOCK_A}\n\nREMPLACEMOI\n\nFin.`;
    const occ = findYouTubeOccurrences(value)[0];
    const start = value.indexOf("REMPLACEMOI");
    const op = moveYouTubeOccurrence(value, occ, start, start + "REMPLACEMOI".length);
    expect(op.value).toBe(`${BLOCK_A}\n\nFin.`);
  });

  it("le texte hors des deux points est préservé à l'octet près", () => {
    const value = `${BLOCK_A}\n\nUn texte précis à préserver 12345.\n\nDeux.`;
    const occ = findYouTubeOccurrences(value)[0];
    const op = moveYouTubeOccurrence(value, occ, value.length, value.length);
    expect(op.value).toBe(`Un texte précis à préserver 12345.\n\nDeux.\n\n${BLOCK_A}`);
    expect(findYouTubeOccurrences(op.value)).toHaveLength(1);
  });

  it("curseur restauré toujours dans les bornes (valeurs absurdes bornées)", () => {
    const value = `${BLOCK_A}\n\nPara un.\n\nPara deux.`;
    const occ = findYouTubeOccurrences(value)[0];
    const op = moveYouTubeOccurrence(value, occ, 99999, 99999);
    expect(op.value).toBe(`Para un.\n\nPara deux.\n\n${BLOCK_A}`);
    expect(op.caret).toBeGreaterThanOrEqual(0);
    expect(op.caret).toBeLessThanOrEqual(op.value.length);
  });
});