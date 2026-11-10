import { searchPublishedContent } from "@/lib/data/search";
import { getLiveConfig } from "@/lib/direct/config";
import { CHANNEL_URL } from "@/lib/direct/core";

/**
 * Couche de CONNAISSANCES des assistants (demande direction §5 — RAG textuel).
 *
 * • N'indexe QUE les contenus publics : articles publiés et vidéos publiées
 *   (RPC `search_published` — security definer, ne renvoie jamais un
 *   brouillon, un programme ni une donnée admin) + une base statique
 *   vérifiée sur la chaîne (YouTube, contacts, pages du site, direct).
 * • Les contenus récupérés sont injectés comme DONNÉES (jamais des
 *   instructions) — le prompt système le rappelle (lib/ai/prompts.ts).
 * • Pas de vectoriel : recherche lexicale PostgreSQL existante, comme
 *   demandé tant que la preuve de nécessité n'est pas faite.
 * • Relance par MOTS-CLÉS (Phase H, anomalie A2) : la recherche lexicale
 *   préexistante (migration 0002, partagée avec la recherche du site) matche
 *   la question ENTIÈRE comme sous-chaîne du titre/extrait — une question en
 *   phrase complète ne peut donc jamais matcher. Quand la recherche directe
 *   ne renvoie RIEN, la question est retokenisée en mots-clés porteurs
 *   (côté application, AUCUNE migration SQL) et relancée mot par mot, avec
 *   déduplication, plafond de mots et d'appels. La RPC public reste la SEULE
 *   source : aucun brouillon, aucune donnée privée, jamais.
 */

const SITE_ORIGIN =
  (process.env.NEXT_PUBLIC_SITE_URL ??
    // Phase J : défaut = production Workers (l'ancien domaine Vercel est
    // mort — jamais citer une URL 404 au visiteur).
    "https://bonnehumeur.info")
    .trim()
    .replace(/\/+$/, "");

/** Base statique publique de la chaîne (vérifiée — aucune donnée personnelle).
 *  AUCUNE page citée ici sans route réelle existante : /contact, /partenariats
 *  et la page d'accueil existent (C1-C2, audit Phase D). Le direct vit dans
 *  la section EN DIRECT de la page d'accueil (LiveSection) — AUCUNE page
 *  /direct n'existe, ne jamais en citer. */
function staticKnowledge(): string {
  return [
    `- Chaîne YouTube : Bonne Humeur Média — ${CHANNEL_URL}`,
    `- Le direct de la chaîne, lorsqu'il est activé, s'affiche dans la section « EN DIRECT » de la page d'accueil du site.`,
    `- Pour contacter la rédaction : page ${SITE_ORIGIN}/contact.`,
    `- Pour un partenariat ou une proposition commerciale : page ${SITE_ORIGIN}/partenariats.`,
    `- Contact WhatsApp officiel de la chaîne : +224 662 860 976.`,
  ].join("\n");
}

export interface KnowledgeContext {
  /** Bloc texte injecté au modèle (DONNÉES, jamais instructions). */
  context: string;
  /** true si la recherche en base n'a pas pu s'exécuter (dégradé honnête). */
  degraded: boolean;
}

/** Budget Phase H : nombre maximal de mots-clés relancés par question. */
export const KNOWLEDGE_MAX_KEYWORDS = 5;
/** Budget Phase H : arrêt des relances dès ce nombre de résultats cumulés. */
const KNOWLEDGE_HITS_TARGET = 5;

/**
 * Mots de conversation courants, jamais discriminants pour une recherche
 * lexicale (A2). Liste volontairement conservatrice : tout mot porteur
 * (lieu, sujet, organisation, marque) reste utilisable.
 */
const STOPWORDS = new Set([
  "le","la","les","un","une","des","du","de","et","ou","que","qui","quoi",
  "quel","quelle","quelles","quels","est","sont","etre","être","avoir",
  "pour","par","sur","dans","avec","sans","comme","tout","tous","toute",
  "toutes","vous","vos","votre","nous","notre","mon","mes","ma","ton",
  "son","sa","ses","leur","leurs","elle","elles","lui","pas","moi","toi",
  "peux","peut","pouvez","pouvoir","veux","vouloir","comment","pourquoi",
  "combien","quand","mais","aussi","tres","très","plus","moins","alors",
  "donc","chez","entre","parler","parle","dire","dit","bonjour","bonsoir",
  "salut","merci","svp","article","articles","hui","aujourd",
  // Accents conservés côté tokens : les deux graphies sont listées
  // (avec/sans accents) selon la saisie du visiteur.
  "dernier","derniere","derniers","dernieres","dernière","dernières",
  "apres","après","deja","déjà","donc","pendant","apercu","aperçu",
]);

/**
 * Extrait les mots-clés porteurs d'une question visiteur (A2 — Phase H).
 * Lettres/numéros uniquement (ponctuation et emoji exclus), minuscules,
 * 3 caractères minimum, nombres seuls exclus (jamais discriminants),
 * dédupliqués en conservant l'ordre d'apparition, plafonnés à
 * KNOWLEDGE_MAX_KEYWORDS. Accents CONSERVÉS : l'ilike SQL ignore la casse
 * mais pas les accents — tokeniser sans accents ferait rater les contenus
 * (« actualités » doit matcher le titre « Actualités » mais pas « actuales »).
 *
 * Tests : lib/ai/ai.test.ts — bloc « tokenisation A2 (Phase H) ».
 */
export function tokenizeQuestion(question: string): string[] {
  const words = question
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w) && !/^\p{N}+$/u.test(w));
  return [...new Set(words)].slice(0, KNOWLEDGE_MAX_KEYWORDS);
}

/** Construit le contexte public à partir d'une question visiteur. */
export async function buildKnowledgeContext(question: string): Promise<KnowledgeContext> {
  const query = question.trim().slice(0, 300);
  let context = `[BONNE HUMEUR MÉDIA — INFORMATIONS GÉNÉRALES]\n${staticKnowledge()}`;
  let degraded = false;

  if (query.length >= 2) {
    const primary = await searchPublishedContent(query);
    if (primary.unavailable) {
      degraded = true;
    } else {
      const articles = primary.articles;
      const videos = primary.videos;
      if (articles.length === 0 && videos.length === 0) {
        // A2 (Phase H) : la question ENTIÈRE n'a rien matché (le SQL 0002
        // fait ilike '%<question>%', impossible pour une phrase complète).
        // Relance par mots-clés, côté application, même RPC publique,
        // budget borné, déduplication — aucun brouillon possible (la RPC
        // search_published ne renvoie que du publié).
        const seenArticle = new Set<string>();
        const seenVideo = new Set<string>();
        for (const keyword of tokenizeQuestion(query)) {
          const relaunch = await searchPublishedContent(keyword);
          if (relaunch.unavailable) {
            continue;
          }
          for (const a of relaunch.articles) {
            const key = a.id ?? a.slug;
            if (!seenArticle.has(key)) {
              seenArticle.add(key);
              articles.push(a);
            }
          }
          for (const v of relaunch.videos) {
            const key = v.id ?? v.slug;
            if (!seenVideo.has(key)) {
              seenVideo.add(key);
              videos.push(v);
            }
          }
          if (articles.length + videos.length >= KNOWLEDGE_HITS_TARGET) {
            break;
          }
        }
      }
      const topArticles = articles.slice(0, 5);
      const topVideos = videos.slice(0, 5);
      if (topArticles.length > 0) {
        const lines = topArticles
          .map((a) => {
            const excerpt = (a.excerpt ?? "").slice(0, 300);
            // Route publique RÉELLE (C1 — audit Phase D) : /actualites/<slug>
            const url = `${SITE_ORIGIN}/actualites/${a.slug}`;
            return `- Article : « ${a.title} »${a.category_name ? ` (rubrique ${a.category_name})` : ""}${excerpt ? ` — ${excerpt}` : ""} — à lire ici : ${url}`;
          })
          .join("\n");
        context += `\n\n[ARTICLES PUBLIÉS PERTINENTS]\n${lines}`;
      }
      if (topVideos.length > 0) {
        const lines = topVideos
          .map((v) => {
            const url = `${SITE_ORIGIN}/videos/${v.slug}`;
            return `- Vidéo : « ${v.title} »${v.category_name ? ` (rubrique ${v.category_name})` : ""} — à regarder ici : ${url}`;
          })
          .join("\n");
        context += `\n\n[VIDÉOS PUBLIÉES PERTINENTES]\n${lines}`;
      }
    }
  }

  // État du direct (lecture publique existante, défaut désactivé).
  // C2 : on ne décrit que le RÉGLAGE (activé par la rédaction) — jamais
  // « la chaîne est en direct maintenant », qui exige une preuve de
  // détection temps réel (module lib/direct, absent ici).
  try {
    const config = await getLiveConfig();
    context += config.enabled
      ? `\n\n[DIRECT] La lecture du direct en continu est ACTIVÉE sur le site : la section « EN DIRECT » de la page d'accueil affiche l'état en temps réel (direct, rediffusion ou présentation).`
      : `\n\n[DIRECT] La lecture du direct en continu n'est pas activée en ce moment sur le site.`;
  } catch {
    // Jamais d'erreur bloquante pour un état accessoire.
  }

  return { context, degraded };
}
