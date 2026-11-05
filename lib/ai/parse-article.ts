/**
 * Parse la sortie structurée de l'assistant admin (format exigé par
 * lib/ai/prompts.ts) : TITRE:/RÉSUMÉ:/CONTENU:/MOTS-CLÉS: — tolérant au
 * markdown (« **TITRE:** ») et à l'absence de champs optionnels.
 * Module pur : testable et importable côté client sans dépendance.
 */
export interface ParsedArticle {
  title?: string;
  excerpt?: string;
  content?: string;
  tags?: string;
}

const LABEL_RE = /^(TITRE|RÉSUMÉ|CONTENU|MOTS-CLÉS)\s*:\s*(.*)$/i;
const LABELS = new Set(["titre", "résumé", "contenu", "mots-clés"]);

/** Sépare le texte en segments {label, texte de corps}. */
function segment(text: string): { label: string; body: string }[] {
  const normalized = text.replace(/\*\*/g, "");
  const segments: { label: string; first: string; body: string[] }[] = [];
  for (const rawLine of normalized.split("\n")) {
    const line = rawLine.trim();
    const m = line.match(LABEL_RE);
    const label = m ? m[1].toLowerCase() : null;
    if (label && LABELS.has(label)) {
      segments.push({ label, first: (m?.[2] ?? "").trim(), body: [] });
      continue;
    }
    if (segments.length > 0) segments[segments.length - 1].body.push(rawLine);
  }
  return segments.map((s) => ({
    label: s.label,
    body: [s.first, ...s.body].join("\n").trim(),
  }));
}

export function parseStructuredArticle(text: string): ParsedArticle {
  const out: ParsedArticle = {};
  for (const s of segment(text)) {
    if (s.body.length === 0 && s.label !== "contenu") continue;
    if (s.label === "titre") out.title = s.body;
    else if (s.label === "résumé") out.excerpt = s.body;
    else if (s.label === "contenu") out.content = s.body.length > 0 ? s.body : undefined;
    else if (s.label === "mots-clés") out.tags = s.body;
  }
  return out;
}
