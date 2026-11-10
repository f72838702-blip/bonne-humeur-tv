import Image from "next/image";

/**
 * Logo OFFICIEL de Bonne Humeur Média (PNG transparent 2406×388, 36 Ko,
 * copie unique dans public/) — NE JAMAIS redessiner, retoucher ou
 * recadrer : l'image originale est utilisée TELLE QUELLE.
 *
 * • équivalent object-fit: contain : hauteur imposée + w-auto (aucune
 *   déformation possible) ;
 * • priorisé : au-dessus de la ligne de flottaison sur toutes les pages
 *   (en-tête commun) ;
 * • qualité écrans haute résolution : intrinsèque 2406 px ≈ 2× l'affichage.
 * • hauteur par surcharge : `<Logo className="h-10" />` (h-9 par défaut).
 */
export default function Logo({
  className = "h-9 w-auto select-none object-contain",
}: {
  className?: string;
}) {
  return (
    <Image
      src="/logo-bonne-humeur-tv.png"
      alt="Bonne Humeur Média"
      width={2406}
      height={388}
      priority
      draggable={false}
      className={className}
    />
  );
}
