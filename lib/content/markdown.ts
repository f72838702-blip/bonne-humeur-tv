import { marked } from "marked";
import { escapeHtml } from "@/lib/utils";
import { extractYouTubeId } from "@/lib/youtube/url";
import { addExternalLinkTargets } from "@/lib/links";
import { parseImageMarker } from "@/lib/content/image-marker";

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
 * 4. Règle de navigation uniforme : les liens HTTP/HTTPS EXTERNES du corps
 *    reçoivent target="_blank" + rel="noopener noreferrer" (post-traitement
 *    SÛR de la sortie marked — source échappée, seuls les <a> de marked) ;
 *    liens internes, mailto:, tel: et ancres inchangés (lib/links).
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

  return addExternalLinkTargets(html);
}

/** Extrait le texte brut d'un Markdown (aperçus, méta-description de secours). */
export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(YOUTUBE_MARKER_GLOBAL_RE, " ")
    .replace(IMAGE_MARKER_PLAIN_RE, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─────────────────────────────────────────────────────────────
// Marqueur vidéo YouTube — SEULE porte d'intégration dans le corps.
//
// Format de bloc stable (une seule ligne, exactement) :
//   [[youtube:VIDEO_ID]]
//
// L'identifiant provient EXCLUSIVEMENT de extractYouTubeId (URL YouTube
// validée côté rédaction) ; ici il est REVALIDÉ : 11 caractères
// alphanumériques/_/-. Aucun HTML, aucune URL arbitraire : l'iframe
// publique est construite uniquement à partir de l'ID validé
// (youtube-nocookie). Tout texte autour du marqueur reste du Markdown
// échappé — [[youtube:12caractères]] ou [[youtube:<script>]] ne sont PAS
// reconnus et restent du simple texte inoffensif.
// ─────────────────────────────────────────────────────────────

const YOUTUBE_MARKER_GLOBAL_RE = /\[\[youtube:[A-Za-z0-9_-]{11}\]\]/g;

// ─────────────────────────────────────────────────────────────
// Marqueur image intégrée — extension du système de marqueurs.
// Le chemin est un CHEMIN Storage revalidé (jamais une URL) ; l'URL
// publique est construite à partir de la configuration serveur.
// Format : [[image:path]] / [[image:path|alt]] / [[image:path|alt|légende]]
// (alt et légende encodés — voir lib/content/image-marker.ts).
// ─────────────────────────────────────────────────────────────

const IMAGE_MARKER_PLAIN_RE = /\[\[image:[^|\]\n]*(?:\|[^|\]\n]*){0,2}\]\]/g;

/** Segment du corps d'article rendu par la page publique. */
export type ArticleSegment =
  | { type: "html"; html: string }
  | { type: "youtube"; id: string }
  | { type: "image"; path: string; alt: string; caption: string };

/**
 * Découpe le corps Markdown en segments : blocs Markdown rendus SÛR
 * (échappement avant parsing, comme toujours) et blocs vidéo YouTube
 * validés. Le marqueur n'est reconnu que sur une LIGNE SEULE — insertion
 * au milieu d'un paragraphe ajoute donc bien un bloc après ce paragraphe.
 */
export function renderArticleSegments(markdown: string): ArticleSegment[] {
  const segments: ArticleSegment[] = [];
  let buffer: string[] = [];
  let flushBuffer = () => {
    if (buffer.length > 0) {
      const text = buffer.join("\n");
      if (text.trim()) segments.push({ type: "html", html: renderMarkdownToHtml(text) });
      buffer = [];
    }
  };

  for (const line of markdown.split(/\r?\n/)) {
    // Les marqueurs sont revalidés ici une 2e fois (barrière de rendu) :
    // un bloc non reconnu reste du Markdown ordinaire échappé.
    const ytMatch = /^\[\[youtube:([A-Za-z0-9_-]{11})\]\]$/.exec(line.trim());
    const id = ytMatch ? extractYouTubeId(ytMatch[1]) : null;
    const imageMatch = id ? null : parseImageMarker(line.trim());
    if (imageMatch) {
      flushBuffer();
      segments.push({ type: "image", ...imageMatch });
    } else if (id) {
      flushBuffer();
      segments.push({ type: "youtube", id });
    } else {
      buffer.push(line);
    }
  }
  flushBuffer();
  return segments;
}

/** Identifiants YouTube valides présents dans un corps Markdown (dédoublonnés). */
export function extractArticleYouTubeIds(markdown: string): string[] {
  return [...new Set(renderArticleSegments(markdown)
    .filter((s): s is { type: "youtube"; id: string } => s.type === "youtube")
    .map((s) => s.id))];
}