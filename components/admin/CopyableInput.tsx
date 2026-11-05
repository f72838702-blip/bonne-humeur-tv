"use client";

/**
 * Champ URL copiable de la médiathèque. Isolé en composant CLIENT car un
 * handler onFocus ne peut pas passer d'un composant serveur (l'onglet
 * Médiathèque tombait en erreur 500 serveur avant cette extraction).
 * Un clic dans le champ sélectionne toute l'URL — copiable immédiatement.
 */
export default function CopyableInput({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <input
      type="text"
      readOnly
      value={value}
      aria-label={label}
      onFocus={(e) => e.currentTarget.select()}
      className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1 text-[10px] text-neutral-500 dark:border-white/10 dark:bg-night-900 dark:text-neutral-400"
    />
  );
}
