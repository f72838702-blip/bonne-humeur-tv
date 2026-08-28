import type { CategoryKey } from "@/store/filters";

export interface Video {
  slug: string;
  title: string;
  excerpt: string;
  category: Exclude<CategoryKey, "all">;
  /** ID YouTube (remplacer par les vrais IDs de la chaîne) */
  youtubeId: string;
  duration: string;
  views: number;
  publishedAt: string; // ISO
  featured?: boolean;
  live?: boolean;
}

export const CATEGORY_LABELS: Record<Exclude<CategoryKey, "all">, string> = {
  societe: "Société",
  culture: "Culture",
  economie: "Économie",
  education: "Éducation",
  institutionnel: "Institutionnel",
};

export const breakingNews: string[] = [
  "🔴 Suivez Bonne Humeur TV, la Télé de la nouvelle génération — en direct de Conakry",
  "Nouveau dossier : la jeunesse guinéenne et l'entrepreneuriat numérique",
  "Bonne Humeur TV couvre le prochain forum économique de Kaloum",
  "Partenariats ouverts : entreprises & institutions, demandez votre devis en ligne",
];

// ─────────────────────────────────────────────────────────────
// DONNÉES DE DÉMONSTRATION — à remplacer par Supabase (table `videos`)
// Les IDs YouTube ci-dessous sont des placeholders.
// ─────────────────────────────────────────────────────────────
export const videos: Video[] = [
  {
    slug: "grand-journal-conakry-actu",
    title: "Le Grand Journal — L'actualité de la semaine à Conakry",
    excerpt:
      "Retour sur les temps forts de la semaine : société, politique et initiatives citoyennes dans le Grand Conakry.",
    category: "societe",
    youtubeId: "aqz-KE-bpKQ",
    duration: "24:10",
    views: 12800,
    publishedAt: "2026-08-24",
    featured: true,
    live: true,
  },
  {
    slug: "jeunesse-entrepreneuriat-numerique",
    title: "Jeunesse & numérique : ces Guinéens qui innovent",
    excerpt:
      "Portrait de jeunes entrepreneurs qui transforment l'économie numérique du pays, de la gare routière aux coworking spaces.",
    category: "economie",
    youtubeId: "aqz-KE-bpKQ",
    duration: "18:35",
    views: 8400,
    publishedAt: "2026-08-20",
  },
  {
    slug: "culture-racines-festival",
    title: "Culture Racines : le festival qui fait vibrer la capitale",
    excerpt:
      "Musique, danse et traditions : immersion dans un festival qui célèbre la richesse culturelle de la Guinée.",
    category: "culture",
    youtubeId: "aqz-KE-bpKQ",
    duration: "12:47",
    views: 15200,
    publishedAt: "2026-08-16",
  },
  {
    slug: "education-reussite-baccalaureat",
    title: "Spécial Éducation — Réussir son baccalauréat en 2026",
    excerpt:
      "Conseils de professeurs, témoignages d'étudiants et méthodes de révision pour aborder sereinement les examens.",
    category: "education",
    youtubeId: "aqz-KE-bpKQ",
    duration: "21:08",
    views: 9100,
    publishedAt: "2026-08-11",
  },
  {
    slug: "interview-ministere-communication",
    title: "Interview exclusive : la communication institutionnelle en débat",
    excerpt:
      "Un échange franc sur la place des médias nouvelle génération dans le paysage institutionnel guinéen.",
    category: "institutionnel",
    youtubeId: "aqz-KE-bpKQ",
    duration: "32:15",
    views: 6700,
    publishedAt: "2026-08-07",
  },
  {
    slug: "marche-madina-pouvoir-achat",
    title: "Grand format : au cœur du marché Madina",
    excerpt:
      "Prix, pouvoir d'achat, quotidien des commerçants : reportage au plus grand marché de Conakry.",
    category: "societe",
    youtubeId: "aqz-KE-bpKQ",
    duration: "16:52",
    views: 11300,
    publishedAt: "2026-08-02",
  },
  {
    slug: "economie-pme-guinee",
    title: "PME guinéennes : financer la croissance locale",
    excerpt:
      "Banques, microfinance et investisseurs : panorama des solutions pour financer les PME en Guinée.",
    category: "economie",
    youtubeId: "aqz-KE-bpKQ",
    duration: "14:29",
    views: 5400,
    publishedAt: "2026-07-27",
  },
  {
    slug: "artistes-scene-conakry",
    title: "La nouvelle scène musicale de Conakry",
    excerpt:
      "Afro-fusion, rap et sons traditionnels : rencontre avec les artistes qui font la Guinée d'aujourd'hui.",
    category: "culture",
    youtubeId: "aqz-KE-bpKQ",
    duration: "19:41",
    views: 19800,
    publishedAt: "2026-07-21",
  },
];

export function getVideoBySlug(slug: string): Video | undefined {
  return videos.find((v) => v.slug === slug);
}

export function getRelatedVideos(video: Video, limit = 3): Video[] {
  return videos
    .filter((v) => v.slug !== video.slug && v.category === video.category)
    .concat(videos.filter((v) => v.slug !== video.slug && v.category !== video.category))
    .slice(0, limit);
}
