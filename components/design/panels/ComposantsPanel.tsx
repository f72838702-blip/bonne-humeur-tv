"use client";

import type { DesignConfig } from "@/lib/design/schema";
import { cn } from "@/lib/utils";

/** Boutons radio en pilule — tous les choix sont fermés (§5). */
function Pills<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint?: string;
  value: T | null;
  options: { value: T; label: string; preview?: string }[];
  onChange: (v: T | null) => void;
}) {
  return (
    <div>
      <span className="block text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
        {label}
      </span>
      {hint && <span className="mt-0.5 block text-[11px] text-neutral-400">{hint}</span>}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
            value === null
              ? "border-guinea-red bg-guinea-red/10 text-guinea-red"
              : "border-neutral-200 text-neutral-500 hover:border-guinea-red/40 dark:border-white/10 dark:text-neutral-300",
          )}
        >
          Défaut
        </button>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            title={o.preview}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              value === o.value
                ? "border-guinea-red bg-guinea-red/10 text-guinea-red"
                : "border-neutral-200 text-neutral-500 hover:border-guinea-red/40 dark:border-white/10 dark:text-neutral-300",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ComposantsPanel({
  config,
  update,
}: {
  config: DesignConfig;
  update: (fn: (c: DesignConfig) => DesignConfig) => void;
}) {
  return (
    <div className="space-y-6 rounded-2xl border border-neutral-200 p-4 dark:border-white/10 dark:bg-night-900">
      <Pills
        label="Arrondis"
        hint="Rayon des cartes, blocs et boutons."
        value={config.components.radius}
        options={[
          { value: "sharp", label: "Angle vif" },
          { value: "small", label: "Petits" },
          { value: "standard", label: "Standard" },
          { value: "round", label: "Très arrondis" },
        ]}
        onChange={(v) => update((c) => ({ ...c, components: { ...c.components, radius: v } }))}
      />
      <Pills
        label="Ombres / élévation"
        hint="Profondeur visuelle des cartes."
        value={config.components.shadows}
        options={[
          { value: "soft", label: "Douces" },
          { value: "strong", label: "Marquées" },
          { value: "none", label: "Aucune (plat)" },
        ]}
        onChange={(v) => update((c) => ({ ...c, components: { ...c.components, shadows: v } }))}
      />
      <Pills
        label="Densité des espacements"
        value={config.components.spacing}
        options={[
          { value: "compact", label: "Compacte" },
          { value: "standard", label: "Standard" },
          { value: "airy", label: "Aérée" },
        ]}
        onChange={(v) => update((c) => ({ ...c, components: { ...c.components, spacing: v } }))}
      />
    </div>
  );
}
