import { cn } from "@/lib/utils";

/**
 * Badge de statut (articles, vidéos, demandes) — libellés français réels.
 */
const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  draft: { label: "Brouillon", className: "bg-neutral-500/15 text-neutral-600 dark:text-neutral-300" },
  review: { label: "À valider", className: "bg-guinea-yellow/20 text-amber-700 dark:text-guinea-yellow" },
  scheduled: { label: "Programmé", className: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  published: { label: "Publié", className: "bg-guinea-green/15 text-guinea-green" },
  archived: { label: "Archivé", className: "bg-neutral-500/15 text-neutral-500 dark:text-neutral-400" },
  new: { label: "Nouveau", className: "bg-guinea-red/15 text-guinea-red" },
  processing: { label: "En cours", className: "bg-guinea-yellow/20 text-amber-700 dark:text-guinea-yellow" },
  treated: { label: "Traité", className: "bg-guinea-green/15 text-guinea-green" },
};

export default function StatusBadge({ status }: { status: string }) {
  const entry = STATUS_STYLES[status] ?? { label: status, className: "bg-neutral-500/15 text-neutral-500" };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        entry.className
      )}
    >
      {entry.label}
    </span>
  );
}