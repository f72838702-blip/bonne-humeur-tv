import { cn } from "@/lib/utils";

/**
 * Titre unifié de page — la même architecture éditoriale partout
 * (audit F3 : 10 pages répétaient des gabarits dissemblables) :
 *  • kicker facultatif (sur-titre en majuscules avec trait rouge —
 *    signature télévisuelle) ;
 *  • titre en H1 avec le mot fort coloré ;
 *  • sous-titre gris discret.
 * La typographie (taille, graisse, interlignage, espacement, police)
 * suit les tokens du Studio de design via la classe .bhtv-title.
 * Toutes les chaînes sont du texte JSX pur — React les échappe, jamais
 * de dangerouslySetInnerHTML ici (aucune injection possible).
 */
export function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="bhtv-kicker text-xs font-bold uppercase tracking-widest text-guinea-red">
      {children}
    </p>
  );
}

export default function PageTitle({
  kicker,
  title,
  highlight,
  subtitle,
  className,
}: {
  kicker?: React.ReactNode;
  title: React.ReactNode;
  /** Mot fort coloré (ex. « actualités ») — même typographie que le titre. */
  highlight?: React.ReactNode;
  subtitle?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(className)}>
      {kicker && <Kicker>{kicker}</Kicker>}
      <h1 className={cn("bhtv-title text-balance text-neutral-900 dark:text-neutral-50", kicker && "mt-2")}>
        {title} {highlight && <span className="text-guinea-red">{highlight}</span>}
      </h1>
      {subtitle && (
        <p className="mt-2 max-w-xl text-pretty text-sm leading-relaxed text-neutral-500 dark:text-neutral-400 sm:text-base">
          {subtitle}
        </p>
      )}
    </div>
  );
}

/**
 * Titre de SECTION — même grammaire visuelle de taille plus modeste
 * (pages d'accueil, listes) : kicker + titre H2 + description facultative.
 */
export function SectionTitle({
  kicker,
  title,
  highlight,
  subtitle,
  className,
}: {
  kicker?: React.ReactNode;
  title: React.ReactNode;
  highlight?: React.ReactNode;
  subtitle?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(className)}>
      {kicker && <Kicker>{kicker}</Kicker>}
      <h2 className={cn("bhtv-title-compact text-balance text-neutral-900 dark:text-neutral-50", kicker && "mt-2")}>
        {title} {highlight && <span className="text-guinea-red">{highlight}</span>}
      </h2>
      {subtitle && (
        <p className="mt-2 max-w-xl text-pretty text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
          {subtitle}
        </p>
      )}
    </div>
  );
}
