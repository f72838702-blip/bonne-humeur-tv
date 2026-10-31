import type { LucideIcon } from "lucide-react";

/**
 * État vide honnête : utilisé partout où le contenu réel est absent
 * (backend non configuré, aucune publication, aucun résultat).
 * Aucun contenu de remplacement fictif n'est jamais affiché.
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-14 text-center dark:border-white/10 dark:bg-night-900/50">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-guinea-red/10 text-guinea-red">
        <Icon className="h-6 w-6" />
      </span>
      <h3 className="mt-4 font-display text-lg font-bold">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-neutral-500 dark:text-neutral-400">
        {description}
      </p>
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}