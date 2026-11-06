"use client";

import type { DesignConfig } from "@/lib/design/schema";
import { SelectField } from "../ui";

export function EnTetePanel({
  config,
  update,
}: {
  config: DesignConfig;
  update: (fn: (c: DesignConfig) => DesignConfig) => void;
}) {
  return (
    <div className="grid gap-4 rounded-2xl border border-neutral-200 p-4 dark:border-white/10 dark:bg-night-900 sm:grid-cols-2">
      <SelectField
        label="Hauteur de la barre"
        value={config.header.height}
        options={[
          { value: "compact", label: "Compacte" },
          { value: "standard", label: "Standard (actuelle)" },
          { value: "airy", label: "Aérée" },
        ]}
        onChange={(v) => update((c) => ({ ...c, header: { ...c.header, height: v } }))}
      />
      <SelectField
        label="Fond de la barre"
        hint="Défilée ou non, la lisibilité reste garantie."
        value={config.header.style}
        options={[
          { value: "glass", label: "Verre (flou) — actuel" },
          { value: "solid", label: "Solide" },
          { value: "flat", label: "Transparente" },
        ]}
        onChange={(v) => update((c) => ({ ...c, header: { ...c.header, style: v } }))}
      />
      <SelectField
        label="Comportement au défilement"
        hint="« Compacte au défilement » réduit la barre quand on lit."
        value={config.header.behavior}
        options={[
          { value: "sticky", label: "Fixe (actuel)" },
          { value: "static", label: "Défile avec la page" },
          { value: "compact", label: "Fixe + réduite au défilement" },
        ]}
        onChange={(v) => update((c) => ({ ...c, header: { ...c.header, behavior: v } }))}
      />
      <SelectField
        label="Taille du logo"
        hint="Le logo officiel n'est JAMAIS déformé — seule sa hauteur varie."
        value={config.header.logoScale}
        options={[
          { value: "small", label: "Petit" },
          { value: "standard", label: "Standard (actuelle)" },
          { value: "large", label: "Large" },
        ]}
        onChange={(v) => update((c) => ({ ...c, header: { ...c.header, logoScale: v } }))}
      />
    </div>
  );
}
