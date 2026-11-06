/**
 * Règle de navigation uniforme BONNE HUMEUR TV :
 *   tout lien HTTP/HTTPS vers un domaine EXTERNE s'ouvre dans un NOUVEL
 *   onglet (target="_blank" + rel="noopener noreferrer") ; les liens
 *   internes gardent le même onglet ; les schémas particuliers (mailto:,
 *   tel:, sms:) et les téléchargements applicatifs ne sont jamais modifiés.
 *
 * Source unique de vérité — chaque composant passe par ces helpers au
 * lieu de deviner lui-même (aucun intercepteur global de clics : les
 * composants, événements et protections existants restent intacts).
 */

/** Hôtes appartenant à Bonne Humeur TV (jamais considérés comme externes). */
export const SITE_HOSTS: readonly string[] = (() => {
  const hosts = new Set<string>();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bonne-humeur-tv.bonne-humeur-tv.workers.dev";
  try {
    hosts.add(new URL(siteUrl).hostname.replace(/^www\./i, ""));
  } catch {
    /* URL d'environnement invalide : les domaines connus ci-dessous suffisent */
  }
  // Domaines de production/préparation réellement servis (Cloudflare).
  hosts.add("bonne-humeur-tv.bonne-humeur-tv.workers.dev"); // Phase J : production
  hosts.add("bonne-humeur-tv-preview.bonne-humeur-tv.workers.dev");
  // Ancien domaine Vercel : 404, conservé « interne » pour les liens
  // historiques contenus dans les articles déjà publiés.
  hosts.add("bonne-humeur-tv.vercel.app");
  return [...hosts];
})();

/**
 * Vrai pour une URL HTTP/HTTPS menant hors du site (autre domaine, même
 * sous-domaine quelconque, autre port). Les URL relatives (/, /actualites,
 * #ancre, ?query) et les schémas non-HTTP (mailto:, tel:, sms:, fichiers)
 * ne sont JAMAIS externes.
 */
export function isExternalHttpUrl(url: unknown): boolean {
  if (typeof url !== "string") return false;
  const value = url.trim();
  if (!/^https?:\/\//i.test(value)) return false;
  try {
    const host = new URL(value).hostname.replace(/^www\./i, "");
    return !SITE_HOSTS.includes(host);
  } catch {
    return false; // URL malformée : jamais d'attributs d'onglet ajoutés
  }
}

/** Attributs d'ancrage à déplier sur un <a> selon la nature de l'URL. */
export interface ExternalAnchorProps {
  target?: "_blank";
  rel?: string;
}

/**
 * Rend `{ target: "_blank", rel: "noopener noreferrer" }` UNIQUEMENT pour
 * un lien HTTP/HTTPS externe ; `{}` sinon (lien interne, ancre, mailto:,
 * tel:, etc. — comportement actuel conservé).
 */
export function externalAnchorProps(url: string | null | undefined): ExternalAnchorProps {
  return isExternalHttpUrl(url) ? { target: "_blank", rel: "noopener noreferrer" } : {};
}

/**
 * Post-traitement du HTML MARQUÉ (corps des articles) : ajoute
 * target="_blank" + rel="noopener noreferrer" sur chaque <a> dont le href
 * est externe. Un attribut target déjà présent n'est jamais doublé ;
 * les liens internes, mailto:, tel: et ancres restent inchangés.
 *
 * Sûr par construction : ce traitement ne s'applique qu'à la sortie de
 * renderMarkdownToHtml, dont la source est intégralement ÉCHAPPÉE avant
 * parsing — les seuls <a> présents sont ceux produits par marked, avec
 * href entre guillemets doubles et contenu non exécutable.
 */
export function addExternalLinkTargets(html: string): string {
  return html.replace(
    /<a\s+([^>]*?)href="([^"]*)"([^>]*)>/g,
    (match, before: string, href: string, after: string) => {
      if (!isExternalHttpUrl(href)) return match;
      if (/(^|\s)target\s*=/i.test(before + after)) return match; // déjà cible : ne jamais doubler
      return `<a ${before}href="${href}"${after} target="_blank" rel="noopener noreferrer">`;
    }
  );
}