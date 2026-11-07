import { describe, expect, it } from "vitest";
import {
  buildImageMarker,
  extractArticleImagePaths,
  mediaPublicUrl,
  parseImageMarker,
  storagePathFromUrl,
  validateImageMarkers,
} from "./image-marker";

const PATH = "articles/1712345678-ab12cd34.webp";
const PATH2 = "articles/1719999999-ff00aa11.jpg";

describe("buildImageMarker / parseImageMarker — aller-retour", () => {
  it("marqueur nu", () => {
    expect(parseImageMarker(buildImageMarker(PATH))).toEqual({
      path: PATH,
      alt: "",
      caption: "",
    });
  });

  it("avec texte alternatif", () => {
    const marker = buildImageMarker(PATH, "Des élèves en classe");
    expect(marker).toBe(`[[image:${PATH}|Des%20%C3%A9l%C3%A8ves%20en%20classe]]`);
    expect(parseImageMarker(marker)).toEqual({
      path: PATH,
      alt: "Des élèves en classe",
      caption: "",
    });
  });

  it("avec légende seule (|| légende)", () => {
    const marker = buildImageMarker(PATH, "", "La rentrée 2026");
    expect(marker).toBe(`[[image:${PATH}||La%20rentr%C3%A9e%202026]]`);
    expect(parseImageMarker(marker)).toEqual({
      path: PATH,
      alt: "",
      caption: "La rentrée 2026",
    });
  });

  it("les caractères | et ]] ne peuvent pas fermer le marqueur prématurément", () => {
    const marker = buildImageMarker(PATH, "a|b", "voiture ]] mystère");
    const parsed = parseImageMarker(marker);
    expect(parsed?.alt).toBe("a|b");
    expect(parsed?.caption).toBe("voiture ]] mystère");
  });
});

describe("chemins refusés (liste stricte)", () => {
  it("buildingImageMarker refuse tout chemin hors liste", () => {
    expect(() => buildImageMarker("https://evil.example.com/1.webp")).toThrow();
    expect(() => buildImageMarker("articles/../secret.webp")).toThrow();
    expect(() => buildImageMarker("inconnu/x.webp")).toThrow();
    expect(() => buildImageMarker("articles/x.exe")).toThrow();
    expect(() => buildImageMarker("articles/")).toThrow();
  });

  it("parseImageMarker renvoie null sur marqueur invalide (jamais une image)", () => {
    expect(parseImageMarker(`[[image:https://evil.example.com/1.webp]]`)).toBeNull();
    expect(parseImageMarker("[[image:categories/../x.webp]]")).toBeNull();
    expect(parseImageMarker("[[image:articles/bad%zz.webp|x]]")).toBeNull();
    expect(parseImageMarker("[[image:]]")).toBeNull();
  });
});

describe("mediaPublicUrl / storagePathFromUrl — aller-retour", () => {
  it("médiaPublicUrl construit l'URL Storage publique", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    expect(mediaPublicUrl(PATH)).toBe(
      `https://example.supabase.co/storage/v1/object/public/media/${PATH}`
    );
  });

  it("storagePathFromUrl n'accepte QUE les URLs du bucket", () => {
    expect(storagePathFromUrl(mediaPublicUrl(PATH))).toBe(PATH);
    expect(storagePathFromUrl("https://i.ytimg.com/vi/abc/hq.jpg")).toBeNull();
    expect(storagePathFromUrl("")).toBeNull();
    expect(storagePathFromUrl(mediaPublicUrl("https://x/y.webp"))).toBeNull();
  });
});

describe("extractArticleImagePaths — ordre conservé, dédoublonné", () => {
  it("extrait uniquement les marqueurs valides", () => {
    const md = `Intro\n\n[[image:${PATH}]]\n\n[[youtube:dQw4w9WgXcQ]]\n\n[[image:${PATH}]]\n\n[[image:${PATH2}|alt]]\n\nFin`;
    expect(extractArticleImagePaths(md)).toEqual([PATH, PATH2]);
  });
});

describe("validateImageMarkers — validation utilisée par saveArticle", () => {
  it("contenu sans marqueur → aucune objection", () => {
    expect(validateImageMarkers("Paragraphe.\n\n[[youtube:dQw4w9WgXcQ]]")).toEqual([]);
  });

  it("marqueurs valides → aucune objection", () => {
    expect(
      validateImageMarkers(`Para 1\n\n[[image:${PATH}]]\n\n[[image:${PATH2}|alts|legende]]`)
    ).toEqual([]);
  });

  it("chemin hors liste → ligne fautive signalée (numéro exact)", () => {
    const problems = validateImageMarkers("L1\n\n[[image:articles/x.png]]\n\n[[image:pirate/y.webp]]");
    expect(problems).toHaveLength(1);
    expect(problems[0].line).toBe(5);
  });

  it("URL fournie par le navigateur refusée (jamais un href arbitraire)", () => {
    const problems = validateImageMarkers(
      "[[image:https://cdn.example.com/pic.png|alt|legende]]"
    );
    expect(problems).toHaveLength(1);
  });
});
