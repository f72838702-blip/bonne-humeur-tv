"use client";

import type { DesignConfig } from "@/lib/design/schema";
import { SelectField, ColorGroup } from "../ui";
import { FONT_LABELS } from "@/lib/design/schema";

const FONT_OPTIONS_LIST = [
  { value: "inter" as const, label: FONT_LABELS.inter },
  { value: "archivo" as const, label: FONT_LABELS.archivo },
  { value: "dmSans" as const, label: FONT_LABELS.dmSans },
  { value: "lora" as const, label: FONT_LABELS.lora },
  { value: "newsreader" as const, label: FONT_LABELS.newsreader },
  { value: "oswald" as const, label: FONT_LABELS.oswald },
];

const COLOR_LABELS: Record<string, string> = {
  bg: "Fond de page",
  surface: "Cartes / surfaces",
  surfaceAlt: "Surfaces alternées",
  line: "Bordures (claire)",
  inkStrong: "Texte fort (titres)",
  ink: "Texte courant",
  inkMuted: "Texte discret",
  inkFaint: "Texte léger",
  brand: "Couleur de marque",
  accent: "Accent (surlignage)",
  positive: "Positif / succès",
};

/** Panneau « Identité visuelle » : palettes claire + sombre, typographie
 *  (listes fermées uniquement — §5 du brief : aucune valeur libre). */
export function IdentityPanel({
  config,
  update,
}: {
  config: DesignConfig;
  update: (fn: (c: DesignConfig) => DesignConfig) => void;
}) {
  const setColor = (tone: "light" | "dark", key: string, v: string | null) =>
    update((c) => ({
      ...c,
      colors: {
        ...c.colors,
        [tone]: { ...c.colors[tone], [key]: v },
      },
    }));

  const setTypography = (
    value: string | null,
    key: keyof DesignConfig["typography"],
  ) =>
    update((c) => ({
      ...c,
      typography: { ...c.typography, [key]: value },
    }));

  return (
    <div className="space-y-5">
      <p className="rounded-xl bg-neutral-100 px-4 py-3 text-[11px] leading-relaxed text-neutral-500 dark:bg-white/5 dark:text-neutral-400">
        Une couleur laissée « par défaut » suit automatiquement le thème clair
        ou sombre du socle. Les palettes claire et sombre sont indépendantes.
      </p>
      <ColorGroup
        title="Palette claire"
        set={config.colors.light}
        labels={COLOR_LABELS}
        onChange={(k, v) => setColor("light", k, v)}
      />
      <ColorGroup
        title="Palette sombre"
        set={config.colors.dark}
        labels={COLOR_LABELS}
        onChange={(k, v) => setColor("dark", k, v)}
      />

      <div className="grid gap-4 rounded-2xl border border-neutral-200 p-4 dark:border-white/10 dark:bg-night-900 sm:grid-cols-2">
        <SelectField
          label="Police du corps"
          value={config.typography.fontBody}
          options={FONT_OPTIONS_LIST}
          onChange={(v) => setTypography(v, "fontBody")}
        />
        <SelectField
          label="Police des titres"
          value={config.typography.fontTitles}
          options={FONT_OPTIONS_LIST}
          onChange={(v) => setTypography(v, "fontTitles")}
        />
        <SelectField
          label="Taille du texte"
          value={config.typography.baseSize}
          options={[
            { value: "14px", label: "14 px — très compact" },
            { value: "15px", label: "15 px — compact" },
            { value: "16px", label: "16 px — standard (actuel)" },
            { value: "17px", label: "17 px — généreux" },
            { value: "18px", label: "18 px — très lisible" },
          ]}
          onChange={(v) => setTypography(v, "baseSize")}
        />
        <SelectField
          label="Échelle des titres"
          value={config.typography.titleScale}
          options={[
            { value: "0.9", label: "90 % — sobre" },
            { value: "1", label: "100 % — standard" },
            { value: "1.1", label: "110 % — affirmé" },
            { value: "1.2", label: "120 % — antenne" },
          ]}
          onChange={(v) => setTypography(v, "titleScale")}
        />
        <SelectField
          label="Graisse des titres"
          value={config.typography.titleWeight}
          options={[
            { value: "700", label: "700 — gras" },
            { value: "800", label: "800 — extra-gras (actuel)" },
            { value: "900", label: "900 — très massif" },
          ]}
          onChange={(v) => setTypography(v, "titleWeight")}
        />
        <SelectField
          label="Interlignage"
          value={config.typography.lineHeight}
          options={[
            { value: "1.4", label: "1,4 — dense" },
            { value: "1.5", label: "1,5 — compact" },
            { value: "1.6", label: "1,6 — standard" },
            { value: "1.75", label: "1,75 — aéré" },
          ]}
          onChange={(v) => setTypography(v, "lineHeight")}
        />
        <SelectField
          label="Espacement des lettres (titres)"
          value={config.typography.titleTracking}
          options={[
            { value: "-0.02em", label: "Serré" },
            { value: "-0.01em", label: "Légèrement serré (actuel)" },
            { value: "0", label: "Normal" },
            { value: "0.01em", label: "Aéré" },
          ]}
          onChange={(v) => setTypography(v, "titleTracking")}
        />
      </div>
    </div>
  );
}
