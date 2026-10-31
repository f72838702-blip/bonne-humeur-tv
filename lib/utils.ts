import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/**
 * Slugification (titres d'articles, vidéos, catégories).
 * Gère les accents français et les caractères courants.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    // Retire les marques diacritiques combinantes (accents décomposés)
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // Les apostrophes (droites ou typographiques) deviennent des séparateurs
    // (« l'économie » → « l-economie ») puis les tirets multiples fusionnent.
    .replace(/['']/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

/** Coupe proprement un texte sur un nombre de mots (résumés, aperçus). */
export function truncateWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text.trim();
  return words.slice(0, maxWords).join(" ") + "…";
}

/** Temps de lecture estimé d'un contenu (base 200 mots/minute). */
export function readingTimeMinutes(markdown: string): number {
  const words = markdown.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** Échappement HTML — utilisé par le rendu Markdown sécurisé (lib/content/markdown.ts). */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}