import { describe, expect, it } from "vitest";
import {
  extractArticleYouTubeIds,
  markdownToPlainText,
  renderArticleSegments,
  renderMarkdownToHtml,
} from "@/lib/content/markdown";

describe("renderMarkdownToHtml — sécurité", () => {
  it("n'exécute jamais un <script> injecté dans le contenu", () => {
    const html = renderMarkdownToHtml("<script>alert('xss')</script>");
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("neutralise les gestionnaires d'événements inline (onerror)", () => {
    const html = renderMarkdownToHtml('<img src="x" onerror="alert(1)">');
    expect(html).not.toMatch(/<img[^>]*onerror/);
    expect(html).toContain("onerror=");
  });

  it("ne produit pas de lien javascript:", () => {
    const html = renderMarkdownToHtml("[Cliquez](javascript:alert(1))");
    expect(html).not.toContain('href="javascript:');
    expect(html).not.toContain("javascript:");
  });

  it("ne produit pas de lien data:text/html", () => {
    const html = renderMarkdownToHtml(
      "[x](data:text/html;base64,PHNjcmlwdD4)"
    );
    expect(html).not.toContain("data:text/html");
  });
});

describe("renderMarkdownToHtml — rendu éditorial", () => {
  it("rend les titres, le gras et les listes", () => {
    const html = renderMarkdownToHtml("## Titre\n\n**gras**\n\n- item");
    expect(html).toContain("<h2>Titre</h2>");
    expect(html).toContain("<strong>gras</strong>");
    expect(html).toContain("<li>item</li>");
  });

  it("conserve les liens http légitimes", () => {
    const html = renderMarkdownToHtml("[site](https://exemple.gn)");
    expect(html).toContain('href="https://exemple.gn"');
  });
});

describe("markdownToPlainText", () => {
  it("supprime la mise en forme markdown", () => {
    const out = markdownToPlainText("## Titre\n\n**gras** et [lien](https://x)");
    expect(out).not.toContain("##");
    expect(out).not.toContain("**");
    expect(out).not.toContain("[");
    expect(out).toContain("Titre");
    expect(out).toContain("lien");
  });

  it("retire les marqueurs YouTube (pas d'ID dans les extraits SEO)", () => {
    const out = markdownToPlainText("Avant\n\n[[youtube:dQw4w9WgXcQ]]\n\nAprès");
    expect(out).not.toContain("youtube");
    expect(out).toContain("Avant");
    expect(out).toContain("Après");
  });
});

describe("renderArticleSegments — corps d'article segmenté", () => {
  const ID = "dQw4w9WgXcQ";

  it("sépare les blocs vidéo et le Markdown, à la position exacte", () => {
    const segments = renderArticleSegments(
      `Intro du texte.\n\n[[youtube:${ID}]]\n\n## Conclusion`
    );
    expect(segments).toHaveLength(3);
    expect(segments[0]).toEqual({
      type: "html",
      html: expect.stringContaining("<p>Intro du texte.</p>"),
    });
    expect(segments[1]).toEqual({ type: "youtube", id: ID });
    expect(segments[2]).toEqual({
      type: "html",
      html: expect.stringContaining("<h2>Conclusion</h2>"),
    });
  });

  it("conserve PLUSIEURS vidéos et leur ordre (position du curseur)", () => {
    const segments = renderArticleSegments(
      `Par. 1\n\n[[youtube:${ID}]]\n\nPar. 2\n\n[[youtube:aaaaaaaaaaa]]\n\nPar. 3`
    );
    const ids = segments.filter((s) => s.type === "youtube");
    expect(ids).toEqual([
      { type: "youtube", id: ID },
      { type: "youtube", id: "aaaaaaaaaaa" },
    ]);
    expect(segments.filter((s) => s.type === "html")).toHaveLength(3);
  });

  it("NE reconnaît PAS un marqueur au milieu d'un paragraphe (texte échappé)", () => {
    const segments = renderArticleSegments(`Texte [[youtube:${ID}]] suite.`);
    expect(segments).toHaveLength(1);
    expect(segments[0].type).toBe("html");
    expect((segments[0] as { html: string }).html).toContain("[[youtube:");
  });

  it("REFUSE un marqueur malformé : ID trop long → reste un texte inoffensif", () => {
    const segments = renderArticleSegments("[[youtube:dQw4w9WgXcQQ]]");
    expect(segments).toHaveLength(1);
    expect(segments[0].type).toBe("html");
    expect((segments[0] as { html: string }).html).not.toContain("<iframe");
  });

  it("BLOQUE le XSS : un marqueur contenant du HTML n'est jamais rendu en iframe", () => {
    const segments = renderArticleSegments(
      '[[youtube:<script>alert(1)</scr' + "ipt>]]"
    );
    expect(segments.every((s) => s.type === "html")).toBe(true);
    expect(segments.some((s) => s.type === "youtube" && s.id.includes("<"))).toBe(false);
    const all = segments.map((s) => (s.type === "html" ? s.html : "")).join("");
    expect(all).not.toContain("<iframe");
    expect(all).not.toContain("<script>alert");
    expect(all).toContain("&lt;");
  });

  it("revalide l'identifiant : pas d'iframe pour un ID de charset invalide", () => {
    const segments = renderArticleSegments("[[youtube:###invalid##]]");
    expect(segments.every((s) => s.type === "html")).toBe(true);
    expect(segments.some((s) => s.type === "youtube")).toBe(false);
  });

  it("extract — liste dédoublonnée des IDs valides seulement", () => {
    const ids = extractArticleYouTubeIds(
      `[[youtube:${ID}]]\n[[youtube:${ID}]]\n[[youtube:bad]]`
    );
    expect(ids).toEqual([ID]);
  });

  it("un corps sans marqueur se comporte comme l'ancien rendu", () => {
    const md = "## Titre\n\n**gras**";
    const segments = renderArticleSegments(md);
    expect(segments).toHaveLength(1);
    expect(renderMarkdownToHtml(md)).toBe(
      (segments[0] as { html: string }).html
    );
  });
});