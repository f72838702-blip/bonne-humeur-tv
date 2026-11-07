import { mediaPublicUrl } from "@/lib/content/image-marker";

/**
 * Image intégrée au corps d'un article (marqueur [[image:path|alt|légende]]).
 *
 * Rendu REACT (alt + légende échappés automatiquement — aucun HTML du
 * marqueur n'enfreint l'échappement). Le chemin est déjà revalidé par
 * parseImageMarker ; l'URL est construite côté serveur à partir de la
 * configuration Storage. Ratio préservé (h-auto), responsive.
 */
export default function ImageSegment({
  path,
  alt,
  caption,
}: {
  path: string;
  alt: string;
  caption: string;
}) {
  return (
    <figure className="my-8">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={mediaPublicUrl(path)}
        alt={alt || "Illustration de l'article"}
        loading="lazy"
        className="w-full h-auto rounded-xl border border-neutral-200 dark:border-white/10"
      />
      {caption && (
        <figcaption className="mt-2 text-center text-xs text-neutral-500 dark:text-neutral-400">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
