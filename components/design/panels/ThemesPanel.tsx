"use client";

import type { DesignConfig } from "@/lib/design/schema";
import { THEME_PRESETS } from "@/lib/design/themes";
import { cn } from "@/lib/utils";

function MiniAperture({ config }: { config: DesignConfig }) {
  // Mire d'aperçu compacte : bande marque + texte + carte
  const bg = config.colors.light.bg ?? "#faf9f7";
  const ink = config.colors.light.inkStrong ?? "#101018";
  const brand = config.colors.light.brand ?? "#CE1126";
  const surface = config.colors.light.surface ?? "#ffffff";
  return (
    <div
      className="rounded-xl border border-neutral-200 p-3 dark:border-white/10"
      style={{ background: bg }}
      aria-hidden
    >
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: brand }} />
        <span className="text-[10px] font-bold" style={{ color: ink }}>
          Bonne Humeur Média
        </span>
      </div>
      <div className="mt-2 flex gap-2">
        <div
          className="h-9 flex-1 overflow-hidden rounded-md"
          style={{ background: surface, boxShadow: "0 1px 3px rgb(0 0 0 / 0.12)" }}
        />
        <div
          className="h-9 w-9 overflow-hidden rounded-md"
          style={{ background: surface }}
        />
      </div>
    </div>
  );
}

/** Les 5 thèmes prédéfinis — cliquer APPLIQUE la pile complète du
 *  thème (puis chaque réglage reste modifiable individuellement). */
export function ThemesPanel({
  config,
  apply,
}: {
  config: DesignConfig;
  apply: (c: DesignConfig) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {THEME_PRESETS.map((preset) => {
        const active = JSON.stringify(config) === JSON.stringify(preset.config);
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => apply(structuredClone(preset.config))}
            className={cn(
              "rounded-2xl border p-3 text-left transition-colors dark:border-white/10 dark:bg-night-900",
              active
                ? "border-guinea-red ring-2 ring-guinea-red/30"
                : "border-neutral-200 hover:border-guinea-red/40",
            )}
          >
            <MiniAperture config={preset.config} />
            <p className="mt-2.5 text-sm font-extrabold text-neutral-800 dark:text-neutral-100">
              {preset.name}
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-400">
              {preset.description}
            </p>
            {active && (
              <p className="mt-1 text-[11px] font-bold text-guinea-red">Thème actif</p>
            )}
          </button>
        );
      })}
    </div>
  );
}
