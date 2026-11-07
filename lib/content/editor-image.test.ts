import { describe, expect, it } from "vitest";
import {
  deleteImageOccurrence,
  findImageOccurrences,
  insertImageBlock,
  updateImageOccurrence,
} from "./editor-image";

const PATH = "articles/1712345678-ab12cd34.webp";
const PATH_B = "articles/1719999999-ff00aa11.webp";
const BLOCK = `[[image:${PATH}]]`;
const BLOCK_B = `[[image:${PATH_B}]]`;

describe("insertImageBlock — curseur (remplace la sélection)", () => {
  it("texte vide → le bloc devient tout le contenu", () => {
    const op = insertImageBlock("", 0, 0, PATH);
    expect(op.value).toBe(BLOCK);
    expect(op.caret).toBe(BLOCK.length);
  });

  it("insertion au milieu — le bloc est sur SA propre ligne, rien d'autre ne bouge", () => {
    const value = "Avant\n\nAprès";
    const op = insertImageBlock(value, 5, 5, PATH);
    expect(op.value).toBe(`Avant\n\n${BLOCK}\n\nAprès`);
    expect(op.caret).toBe(5 + 2 + BLOCK.length);
  });

  it("une sélection est REMPLACÉE par le bloc", () => {
    const value = "Avant\n\nSELECTION\n\nAprès";
    const op = insertImageBlock(value, 5, 16, PATH);
    expect(op.value).toBe(`Avant\n\n${BLOCK}\n\nAprès`);
  });

  it("insertion au début — pas de ligne vide résiduelle au-dessus", () => {
    const op = insertImageBlock("Premier paragraphe.", 0, 0, PATH);
    expect(op.value).toBe(`${BLOCK}\n\nPremier paragraphe.`);
  });

  it("insertion à la fin — pas de double ligne vide", () => {
    const op = insertImageBlock("Texte final.", 12, 12, PATH);
    expect(op.value).toBe(`Texte final.\n\n${BLOCK}`);
  });

  it("le reste du contenu est préservé à l'octet près (plusieurs paragraphes)", () => {
    const value = "Para un.\n\nPara deux.\n\nPara trois.";
    // Curseur à la FIN du 2e paragraphe (position 20).
    const op = insertImageBlock(value, 20, 20, PATH);
    expect(op.value).toBe(`Para un.\n\nPara deux.\n\n${BLOCK}\n\nPara trois.`);
  });

  it("chemin injetable refusé (revalidation stricte)", () => {
    expect(() => insertImageBlock("x", 0, 0, "https://evil.example.com/x.webp")).toThrow();
    expect(() => insertImageBlock("x", 0, 0, "articles/../secret.webp")).toThrow();
  });
});

describe("findImageOccurrences — une entrée par apparition", () => {
  it("liste chaque occurrence avec params décodés et positions exactes", () => {
    const value = `Un.\n\n${BLOCK}\n\nDeux.\n\n[[image:${PATH_B}|Légende alt|Une caption]]\n\nFin`;
    const occurrences = findImageOccurrences(value);
    expect(occurrences).toHaveLength(2);
    expect(occurrences[0].path).toBe(PATH);
    expect(occurrences[0].alt).toBe("");
    expect(occurrences[0].start).toBe(5);
    expect(occurrences[1].alt).toBe("Légende alt");
    expect(occurrences[1].caption).toBe("Une caption");
  });

  it("deux fois la même image = deux occurrences distinctes (doublons visibles)", () => {
    const value = `${BLOCK}\n\n${BLOCK}`;
    expect(findImageOccurrences(value)).toHaveLength(2);
  });

  it("un marqueur malformé n'est pas listé", () => {
    expect(findImageOccurrences("[[image:https://x.y/v.png|alt|legende]]")).toHaveLength(0);
    expect(findImageOccurrences("[[image:articles/invalide.png")).toHaveLength(0);
    expect(findImageOccurrences("[[youtube:dQw4w9WgXcQ]]")).toHaveLength(0);
  });
});

describe("updateImageOccurrence — réécriture en place (alt / légende)", () => {
  it("alt réécrit, le reste du contenu inchangé à l'octet près", () => {
    const value = `Para un.\n\n${BLOCK}\n\nPara deux.`;
    const op = updateImageOccurrence(value, findImageOccurrences(value)[0], "Salle de classe", "");
    expect(op.value).toBe(`Para un.\n\n[[image:${PATH}|Salle%20de%20classe]]\n\nPara deux.`);
    // Curseur juste après le marqueur réécrit.
    expect(op.caret).toBe(op.value.indexOf("\n\nPara deux."));
  });

  it("alt et légende ensemble, décodables ensuite", () => {
    const value = `${BLOCK}\n\nTexte.`;
    const op = updateImageOccurrence(value, findImageOccurrences(value)[0], "Nouveau alt", "Nouvelle légende");
    const parsed = findImageOccurrences(op.value)[0];
    expect(parsed.alt).toBe("Nouveau alt");
    expect(parsed.caption).toBe("Nouvelle légende");
    expect(op.value).toBe(`[[image:${PATH}|Nouveau%20alt|Nouvelle%20l%C3%A9gende]]\n\nTexte.`);
  });

  it("retrait des paramètres (alt vidé) est possible", () => {
    const value = `[[image:${PATH}|Ancien alt]]\n\nTexte.`;
    const op = updateImageOccurrence(value, findImageOccurrences(value)[0], "", "");
    expect(op.value).toBe(`${BLOCK}\n\nTexte.`);
  });
});

describe("deleteImageOccurrence", () => {
  it("retire la ligne du marqueur + la ligne vide résiduelle (texte intact)", () => {
    const value = `Un.\n\n${BLOCK}\n\nDeux.`;
    const op = deleteImageOccurrence(value, findImageOccurrences(value)[0]);
    expect(op.value).toBe("Un.\n\nDeux.");
  });

  it("marqueur en tête / en fin : pas de ligne vide résiduelle", () => {
    const head = deleteImageOccurrence(`${BLOCK}\n\nTexte.`, findImageOccurrences(`${BLOCK}\n\nTexte.`)[0]);
    expect(head.value).toBe("Texte.");
    const tail = deleteImageOccurrence(`Texte.\n\n${BLOCK}`, findImageOccurrences(`Texte.\n\n${BLOCK}`)[0]);
    expect(tail.value).toBe("Texte.");
  });

  it("supprime UNIQUEMENT l'occurrence ciblée — l'autre image et la vidéo restent", () => {
    const value = `Un.\n\n${BLOCK}\n\n[[youtube:46eoreAaqVM]]\n\n${BLOCK_B}\n\nDeux.`;
    const occurrences = findImageOccurrences(value);
    const op = deleteImageOccurrence(value, occurrences[1]);
    expect(op.value).toBe(`Un.\n\n${BLOCK}\n\n[[youtube:46eoreAaqVM]]\n\nDeux.`);
    expect(findImageOccurrences(op.value)).toHaveLength(1);
  });

  it("marqueur collé à du texte : seuls les caractères du marqueur partent", () => {
    const value = `Du texte ${BLOCK} collé.`;
    const op = deleteImageOccurrence(value, findImageOccurrences(value)[0]);
    expect(op.value).toBe("Du texte  collé.");
  });
});
