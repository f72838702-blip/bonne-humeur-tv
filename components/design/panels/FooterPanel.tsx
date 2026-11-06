"use client";

import type { DesignConfig } from "@/lib/design/schema";
import { SelectField, ToggleField } from "../ui";
import { cn } from "@/lib/utils";

/** Pied de page : présentation, blocs facultatifs, liens personnalisés
 *  (max 10) — chaque href validé (interne / ou https://). */
export function FooterPanel({
  config,
  update,
}: {
  config: DesignConfig;
  update: (fn: (c: DesignConfig) => DesignConfig) => void;
}) {
  const links = config.footer.links ?? [];

  const setLinks = (next: { label: string; href: string }[]) =>
    update((c) => ({
      ...c,
      footer: { ...c.footer, links: next.length > 0 ? next : undefined },
    }));

  return (
    <div className="space-y-5">
      <div className="grid gap-4 rounded-2xl border border-neutral-200 p-4 dark:border-white/10 dark:bg-night-900 sm:grid-cols-2">
        <SelectField
          label="Présentation"
          value={config.footer.style}
          options={[
            { value: "classic", label: "Classique — 3 colonnes (actuelle)" },
            { value: "columns2", label: "Deux colonnes" },
            { value: "centered", label: "Centré" },
          ]}
          onChange={(v) => update((c) => ({ ...c, footer: { ...c.footer, style: v } }))}
        />
        <div className="flex flex-col justify-center gap-3">
          <ToggleField
            label="Afficher la navigation"
            checked={config.footer.showNavigation}
            onChange={(v) => update((c) => ({ ...c, footer: { ...c.footer, showNavigation: v } }))}
          />
          <ToggleField
            label="Afficher le contact"
            checked={config.footer.showContact}
            onChange={(v) => update((c) => ({ ...c, footer: { ...c.footer, showContact: v } }))}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 p-4 dark:border-white/10 dark:bg-night-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-600 dark:text-neutral-300">
            Liens personnalisés ({links.length}/10)
          </h3>
          <button
            type="button"
            disabled={links.length >= 10}
            onClick={() => setLinks([...links, { label: "", href: "/" }])}
            className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-semibold text-neutral-600 transition-colors hover:border-guinea-red hover:text-guinea-red disabled:opacity-40 dark:border-white/20 dark:text-neutral-300"
          >
            + Ajouter un lien
          </button>
        </div>
        <ul className="mt-3 space-y-2">
          {links.map((l, i) => (
            <li key={i} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Libellé"
                value={l.label}
                onChange={(e) =>
                  setLinks(links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                }
                className="w-40 min-w-0 rounded-lg border border-neutral-200 bg-surface px-2 py-1.5 text-xs dark:border-white/10 dark:bg-night-800 dark:text-neutral-100"
              />
              <input
                type="text"
                placeholder="/chemin ou https://…"
                value={l.href}
                onChange={(e) =>
                  setLinks(links.map((x, j) => (j === i ? { ...x, href: e.target.value } : x)))
                }
                className={cn(
                  "flex-1 min-w-0 rounded-lg border bg-surface px-2 py-1.5 font-mono text-xs dark:bg-night-800 dark:text-neutral-100",
                  /^\/|^https:\/\//.test(l.href)
                    ? "border-neutral-200 dark:border-white/10"
                    : "border-guinea-red",
                )}
              />
              <button
                type="button"
                onClick={() => setLinks(links.filter((_, j) => j !== i))}
                aria-label={`Supprimer le lien « ${l.label || i + 1} »`}
                className="shrink-0 rounded-md px-1.5 py-1 text-xs text-neutral-400 hover:bg-neutral-100 hover:text-guinea-red dark:hover:bg-white/5"
              >
                ✕
              </button>
            </li>
          ))}
          {links.length === 0 && (
            <li className="text-xs text-neutral-400">
              Aucun lien personnalisé — le pied de page montre la navigation standard.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
