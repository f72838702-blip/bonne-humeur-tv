import { marked } from "marked";
import { escapeHtml } from "@/lib/utils";

/**
 * Rendu Markdown SÛR pour le contenu des articles.
 *
 * Politique de sécurité :
 * 1. Le HTML brut saisi par les rédacteurs est intégralement échappé AVANT le
 *    parsing (`<script>`, `<img onerror=…>`, etc. deviennent du texte inoffensif).
 * 2. Les schémas `javascript:` / `vbscript:` sont retirés de la source.
 * 3. Seules les balises produites par marked (titres, gras, listes, citations,
 *    liens, images) atteignent le DOM — marked valide par ailleurs les URL des
 *    liens et images (sa fonction interne cleanUrl rejette les schémas dangereux).
 *
 * En conséquence : aucun HTML non fiable n'est exécuté (exigence §9.2 de la mission).
 */
export function renderMarkdownToHtml(markdown: string): string {
  const source = markdown
    .replace(/javascript\s*:/gi, "")
    .replace(/vbscript\s*:/gi, "")
    .replace(/data\s*:\s*text\/html/gi, "");

  const escaped = escapeHtml(source);

  const html = marked.parse(escaped, {
    async: false,
    gfm: true,
    breaks: true,
  }) as string;

  return html;
}

/** Extrait le texte brut d'un Markdown (aperçus, méta-description de secours). */
export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}