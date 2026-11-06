"use client";

/** Historique immuable des publications — restaurer charge l'ancien
 *  design dans le BROUILLON (prévisualisation puis publication) :
 *  jamais de retour arrière à l'aveugle sur le site public. */

export interface HistoryEntry {
  id: string;
  note: string;
  createdAt: string;
}

export function HistoriquePanel({
  history,
  onRestore,
  disabled,
}: {
  history: HistoryEntry[];
  onRestore: (id: string) => void;
  disabled?: boolean;
}) {
  if (history.length === 0) {
    return (
      <p className="rounded-2xl bg-neutral-100 px-4 py-6 text-center text-sm text-neutral-500 dark:bg-white/5 dark:text-neutral-400">
        Aucune version archivée — restaurer devient possible dès la première
        publication d’un design personnalisé.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {history.map((h) => (
        <li
          key={h.id}
          className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-surface px-3 py-2.5 dark:border-white/10 dark:bg-night-900"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-neutral-800 dark:text-neutral-100">
              {h.note}
            </p>
            <p className="text-[11px] text-neutral-400">
              {new Date(h.createdAt).toLocaleString("fr-FR")}
            </p>
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onRestore(h.id)}
            className="shrink-0 rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-600 transition-colors hover:border-guinea-red hover:text-guinea-red disabled:opacity-40 dark:border-white/20 dark:text-neutral-300"
          >
            Charger en brouillon
          </button>
        </li>
      ))}
    </ul>
  );
}
