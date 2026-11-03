import { youtubeEmbedUrl, youtubeWatchUrl } from "@/lib/youtube/url";

/**
 * Intégration YouTube publique — l'UNE des deux seules sources d'iframe du
 * site, avec Turnstile. L'iframe est construite UNIQUEMENT à partir d'un
 * identifiant à 11 caractères validé en amont (extrat et revalidé dans
 * lib/content/markdown.ts via extractYouTubeId) — jamais d'URL arbitraire
 * fournie par un rédacteur.
 *
 * • youtube-nocookie.com : aucune cookie de traçage avant lecture.
 * • loading="lazy" : chargement différé (LCP préservé).
 * • Côte CSP : frame-src autorise uniquement www.youtube-nocookie.com
 *   (next.config.ts) — une autre source est bloquée par construction.
 * • Ratio 16:9 responsive (mobile/ordinateur) ; les Shorts s'affichent
 *   dans le même cadre (bandes letterbox raisonnables).
 */
export default function YouTubeEmbed({ id }: { id: string }) {
  return (
    <figure className="my-6 overflow-hidden rounded-2xl border border-neutral-200 bg-black dark:border-white/10">
      <div className="relative aspect-video w-full">
        <iframe
          src={youtubeEmbedUrl(id)}
          title="Vidéo YouTube intégrée à cet article"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 h-full w-full"
        />
      </div>
      <figcaption className="bg-white px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-neutral-400 dark:bg-night-800 dark:text-neutral-500">
        <a
          href={youtubeWatchUrl(id)}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="hover:text-guinea-red"
        >
          Source : YouTube — lire la vidéo sur youtube.com
        </a>
      </figcaption>
    </figure>
  );
}