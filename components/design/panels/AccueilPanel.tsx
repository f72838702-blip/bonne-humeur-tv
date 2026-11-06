"use client";

import { useState } from "react";
import type { DesignConfig, HomeSection } from "@/lib/design/schema";
import { SelectField, ToggleField } from "../ui";
import { cn } from "@/lib/utils";

const SECTION_LABELS: Record<string, string> = {
  hero: "Une (héro) — vidéo à la une",
  featured: "Actualités à la une",
  categories: "Rubriques mises en avant",
  videos: "Dernières vidéos",
  b2b: "Offres B2B (régie)",
  partners: "Partenaires officiels",
};

export function AccueilPanel({
  config,
  update,
  categories,
}: {
  config: DesignConfig;
  update: (fn: (c: DesignConfig) => DesignConfig) => void;
  categories: { slug: string; name: string }[];
}) {
  // Drag & drop natif : index pris au vol, déposé sur une cible.
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const move = (from: number, to: number) => {
    if (from === to) return;
    update((c) => {
      const sections = [...c.home.sections];
      const [moved] = sections.splice(from, 1);
      sections.splice(to, 0, moved);
      return { ...c, home: { ...c.home, sections } };
    });
  };

  const patch = (index: number, p: Partial<HomeSection>) =>
    update((c) => ({
      ...c,
      home: {
        ...c.home,
        sections: c.home.sections.map((s, i) => (i === index ? { ...s, ...p } : s)),
      },
    }));

  const toggleCategory = (slug: string) => {
    update((c) => {
      const current = c.home.featuredCategorySlugs;
      const next = current.includes(slug)
        ? current.filter((s) => s !== slug)
        : [...current, slug].slice(0, 6);
      return { ...c, home: { ...c.home, featuredCategorySlugs: next } };
    });
  };

  return (
    <div className="space-y-5">
      <p className="rounded-xl bg-neutral-100 px-4 py-3 text-[11px] leading-relaxed text-neutral-500 dark:bg-white/5 dark:text-neutral-400">
        Glissez-déposez les sections (ou utilisez les flèches) — sur mobile,
        les flèches ↑ ↓ sont plus confortables. Titre laissé vide = titre
        d’origine. Le mobilier permanent (fil d’infos, bandeau EN DIRECT) et
        les emplacements publicitaires ne sont PAS déplaçables.
      </p>

      <ul className="space-y-2">
        {config.home.sections.map((s, i) => (
          <li
            key={s.id}
            data-testid={`home-section-${s.id}`}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragEnter={() => setOverIndex(i)}
            onDragEnd={() => {
              if (dragIndex !== null && overIndex !== null) move(dragIndex, overIndex);
              setDragIndex(null);
              setOverIndex(null);
            }}
            onDragOver={(e) => e.preventDefault()}
            className={cn(
              "flex flex-wrap items-start gap-3 rounded-xl border bg-surface p-3 dark:bg-night-900",
              overIndex === i && dragIndex !== null && dragIndex !== i
                ? "border-guinea-red"
                : "border-neutral-200 dark:border-white/10",
              !s.visible && "opacity-60",
            )}
          >
            <span aria-hidden className="mt-1 cursor-grab select-none text-neutral-300 dark:text-neutral-600">
              ⠿
            </span>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-extrabold text-neutral-800 dark:text-neutral-100">
                  {i + 1}. {SECTION_LABELS[s.id]}
                </span>
                <span className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={`Monter ${SECTION_LABELS[s.id]}`}
                    onClick={() => move(i, Math.max(0, i - 1))}
                    className="rounded-md px-1.5 py-0.5 text-xs text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-white/5"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Descendre ${SECTION_LABELS[s.id]}`}
                    onClick={() => move(i, Math.min(config.home.sections.length - 1, i + 1))}
                    className="rounded-md px-1.5 py-0.5 text-xs text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-white/5"
                  >
                    ↓
                  </button>
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <input
                  type="text"
                  placeholder={`Titre (${SECTION_LABELS[s.id]} original)`}
                  value={s.title ?? ""}
                  onChange={(e) => patch(i, { title: e.target.value.trim() === "" ? null : e.target.value })}
                  className="rounded-lg border border-neutral-200 bg-surface px-2 py-1.5 text-xs text-neutral-900 outline-none focus:border-guinea-red dark:border-white/10 dark:bg-night-800 dark:text-neutral-100"
                />
                <input
                  type="text"
                  placeholder="Sous-titre (facultatif)"
                  value={s.subtitle ?? ""}
                  onChange={(e) => patch(i, { subtitle: e.target.value.trim() === "" ? null : e.target.value })}
                  className="rounded-lg border border-neutral-200 bg-surface px-2 py-1.5 text-xs text-neutral-900 outline-none focus:border-guinea-red dark:border-white/10 dark:bg-night-800 dark:text-neutral-100"
                />
                <SelectField
                  label=""
                  value={s.columns}
                  options={[
                    { value: "2", label: "2 colonnes" },
                    { value: "3", label: "3 colonnes (défaut)" },
                    { value: "4", label: "4 colonnes" },
                  ]}
                  onChange={(v) => patch(i, { columns: v })}
                />
              </div>
            </div>
            <ToggleField
              label="Visible"
              checked={s.visible}
              onChange={(v) => patch(i, { visible: v })}
            />
          </li>
        ))}
      </ul>

      <fieldset className="rounded-2xl border border-neutral-200 p-4 dark:border-white/10 dark:bg-night-900">
        <legend className="px-2 text-xs font-bold uppercase tracking-widest text-neutral-600 dark:text-neutral-300">
          Rubriques mises en avant (max 6)
        </legend>
        {categories.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-400">
            Aucune rubrique en base — la section « Rubriques » reste vide tant
            que la rédaction n’en a pas créé.
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {categories.map((cat) => {
              const active = config.home.featuredCategorySlugs.includes(cat.slug);
              return (
                <button
                  key={cat.slug}
                  type="button"
                  onClick={() => toggleCategory(cat.slug)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                    active
                      ? "border-guinea-red bg-guinea-red/10 text-guinea-red"
                      : "border-neutral-200 text-neutral-500 hover:border-guinea-red/40 dark:border-white/10 dark:text-neutral-300",
                  )}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        )}
      </fieldset>
    </div>
  );
}
