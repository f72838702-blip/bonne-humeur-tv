import { describe, expect, it } from "vitest";
import {
  markdownToPlainText,
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
});