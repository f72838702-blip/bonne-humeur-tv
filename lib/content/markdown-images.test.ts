import { describe, expect, it } from "vitest";
import { markdownToPlainText, renderArticleSegments } from "./markdown";

const PATH = "articles/1712345678-ab12cd34.webp";
const PATH_B = "articles/1719999999-ff00aa11.jpg";

describe("renderArticleSegments — images intégrées", () => {
  it("l'ordre des segments suit EXACTEMENT l'ordre du contenu (texte, image, vidéo, image)", () => {
    const segments = renderArticleSegments(
      `## Introduction\n\nPara un.\n\n[[image:${PATH}]]\n\n[[youtube:dQw4w9WgXcQ]]\n\nPara deux.\n\n[[image:${PATH_B}|Le%20marché|Une%20légende]]\n\nConclusion.`
    );
    expect(segments.map((s) => s.type)).toEqual([
      "html", "image", "youtube", "html", "image", "html",
    ]);
  });

  it("le segment image porte un chemin revalidé et les textes décodés", () => {
    const [segment] = renderArticleSegments(`[[image:${PATH_B}|Le%20march%C3%A9]]`).filter(
      (s) => s.type === "image"
    );
    expect(segment).toEqual({ type: "image", path: PATH_B, alt: "Le marché", caption: "" });
  });

  it("légende seule reconnue", () => {
    const [segment] = renderArticleSegments(`[[image:${PATH}||Une%20l%C3%A9gende]]`);
    expect(segment).toMatchObject({ type: "image", alt: "", caption: "Une légende" });
  });

  it("marqueur INLINE au milieu d'un paragraphe — NON reconnu (reste texte échappé, comme les vidéos)", () => {
    const segments = renderArticleSegments(`Texte ${`[[image:${PATH}]]`} suite.`);
    expect(segments).toHaveLength(1);
    expect(segments[0].type).toBe("html");
    expect((segments[0] as { html: string }).html).toContain("[[image:");
  });

  it("chemin hors liste / URL arbitraire — NON reconnu (texte inoffensif échappé)", () => {
    const forMarkdown = "Texte.\n\n[[image:https://evil.example.com/pic.png|alt|legende]]";
    const segments = renderArticleSegments(forMarkdown);
    // La ligne NE devient JAMAIS un segment image : une seule portion html.
    expect(segments).toHaveLength(1);
    expect(segments[0].type).toBe("html");
    expect((segments[0] as { html: string }).html).not.toContain("<img");
  });

  it("aucun HTML d'un texte paramètre n'est exécuté (alt échappé par React côté page)", () => {
    const segments = renderArticleSegments(
      `[[image:${PATH}|${encodeURIComponent("<img src=x onerror=alert(1)>")}]]`
    );
    const segment = segments.find((s) => s.type === "image") as { alt: string };
    // La donnée est du TEXTE brut — la page React l'échappe au rendu.
    expect(segment.alt).toBe("<img src=x onerror=alert(1)>");
  });
});

describe("markdownToPlainText — marqueurs images retirés des aperçus", () => {
  it("les marqueurs image et vidéo ne polluent ni chapô ni SEO", () => {
    const plain = markdownToPlainText(
      `Intro du texte.\n\n[[image:${PATH}]]\n\n[[youtube:dQw4w9WgXcQ]]\n\nSuite du texte.`
    );
    expect(plain).not.toContain("[[image:");
    expect(plain).not.toContain("[[youtube:");
    expect(plain).toContain("Intro du texte.");
    expect(plain).toContain("Suite du texte.");
  });
});
