"use client";

/**
 * PERSONNALISATIONS FACILES (Studio simplifié) — 6 groupes de boutons
 * ILLUSTRÉS uniquement : jamais de code hexadécimal affiché, jamais de
 * paramètre technique. Chaque choix retombe sur le thème ; ne rien
 * toucher est toujours une option valide.
 * Sécurité : valeurs fermées (énumérations + sélecteur natif) — les
 * couleurs traversent la validation Zod comme partout ailleurs.
 */
import type { DesignConfig } from "@/lib/design/schema";
import { cn } from "@/lib/utils";

const BRAND_SWATCHES = [
  "#CE1126", // rouge guinea (défaut)
  "#B45309", // ambre chaud
  "#1D4ED8", // bleu
  "#009A44", // vert
  "#7C3AED", // violet
  "#111111", // encre
];

const ACCENT_SWATCHES = [
  "#FCD116", // jaune guinea (défaut)
  "#F97316", // orange
  "#009A44", // vert
  "#0EA5E9", // bleu clair
  "#EC4899", // rose
  "#B98A00", // or discret
];

/** Groupe visuel : titre simple, sous-texte, grands boutons. */
function OptionGroup({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 p-4 dark:border-white/10 dark:bg-night-900">
      <p className="text-sm font-extrabold text-neutral-800 dark:text-neutral-100">
        {title}
      </p>
      {hint && (
        <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
          {hint}
        </p>
      )}
      <div className="mt-3">{children}</div>
    </div>
  );
}

/** Bouton de choix — grand, cliquable, libellé humain. */
function Choice({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors",
        active
          ? "border-guinea-red bg-guinea-red/10 text-guinea-red"
          : "border-neutral-200 text-neutral-600 hover:border-guinea-red/50 dark:border-white/10 dark:text-neutral-200",
      )}
    >
      {children}
    </button>
  );
}

/** Pastille de couleur — le code n'APPARAÎT JAMAIS. */
function Swatch({
  hex,
  active,
  onClick,
  label,
}: {
  hex: string;
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1",
        "text-[11px] font-semibold text-neutral-500 dark:text-neutral-300",
      )}
    >
      <span
        className={cn(
          "h-9 w-9 rounded-full border shadow-sm transition-transform hover:scale-110",
          active ? "ring-2 ring-guinea-red ring-offset-2 dark:ring-offset-night-900" : "border-black/10",
        )}
        style={{ background: hex }}
      />
      {label}
    </button>
  );
}

export function SimpleControls({
  config,
  update,
}: {
  config: DesignConfig;
  update: (fn: (c: DesignConfig) => DesignConfig) => void;
}) {
  const setBothPalettes = (
    v: string | null,
    key: "brand" | "accent",
  ) =>
    update((c) => ({
      ...c,
      colors: {
        light: { ...c.colors.light, [key]: v },
        dark: { ...c.colors.dark, [key]: v },
      },
    }));

  const setComponents = (
    radius: DesignConfig["components"]["radius"],
    shadows: DesignConfig["components"]["shadows"],
  ) =>
    update((c) => ({
      ...c,
      components: { ...c.components, radius, shadows },
    }));

  const setPresentation = (
    spacing: DesignConfig["components"]["spacing"],
    columns: DesignConfig["home"]["sections"][number]["columns"],
  ) =>
    update((c) => ({
      ...c,
      components: { ...c.components, spacing },
      home: {
        ...c.home,
        sections: c.home.sections.map((s) => (
          s.id === "featured" || s.id === "videos" ? { ...s, columns } : s
        )),
      },
    }));

  const brandNow = config.colors.light.brand ?? "#CE1126";
  const accentNow = config.colors.light.accent ?? "#FCD116";
  const radiusNow = config.components.radius;
  const shadowsNow = config.components.shadows;
  const logoNow = config.header.logoScale ?? "standard";
  const spacingNow = config.components.spacing;
  const featureColsNow = config.home.sections.find((s) => s.id === "featured")?.columns ?? null;
  const videosColsNow = config.home.sections.find((s) => s.id === "videos")?.columns ?? null;

  return (
    <div className="space-y-4">
      {/* Couleur principale */}
      <OptionGroup
        title="Couleur principale"
        hint="C'est la couleur des boutons et des éléments importants."
      >
        <div className="flex flex-wrap items-center gap-3">
          {BRAND_SWATCHES.map((hex) => (
            <Swatch
              key={hex}
              hex={hex}
              label={hex === "#CE1126" ? "Rouge" : "Couleur"}
              active={config.colors.light.brand !== null && config.colors.light.brand.toLowerCase() === hex.toLowerCase()}
              onClick={() => setBothPalettes(hex, "brand")}
            />
          ))}
          <label className="flex cursor-pointer flex-col items-center gap-1">
            <input
              type="color"
              aria-label="Autre couleur principale"
              value={brandNow}
              onChange={(e) => setBothPalettes(e.target.value, "brand")}
              className="h-9 w-9 cursor-pointer rounded-full border border-black/10 shadow-sm"
            />
            <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-300">
              Autre
            </span>
          </label>
          <button
            type="button"
            onClick={() => setBothPalettes(null, "brand")}
            className="mt-0 flex flex-col items-center gap-1 pl-1 text-[11px] font-semibold text-neutral-500 hover:text-neutral-800 dark:text-neutral-300 dark:hover:text-neutral-100"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-neutral-300 dark:border-white/20">
              ✕
            </span>
            Défaut
          </button>
        </div>
      </OptionGroup>

      {/* Couleur secondaire */}
      <OptionGroup
        title="Couleur secondaire"
        hint="Colorie les soulignés, badges et touches décoratives."
      >
        <div className="flex flex-wrap items-center gap-3">
          {ACCENT_SWATCHES.map((hex) => (
            <Swatch
              key={hex}
              hex={hex}
              label={hex === "#FCD116" ? "Jaune" : "Couleur"}
              active={config.colors.light.accent !== null && config.colors.light.accent.toLowerCase() === hex.toLowerCase()}
              onClick={() => setBothPalettes(hex, "accent")}
            />
          ))}
          <label className="flex cursor-pointer flex-col items-center gap-1">
            <input
              type="color"
              aria-label="Autre couleur secondaire"
              value={accentNow}
              onChange={(e) => setBothPalettes(e.target.value, "accent")}
              className="h-9 w-9 cursor-pointer rounded-full border border-black/10 shadow-sm"
            />
            <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-300">
              Autre
            </span>
          </label>
          <button
            type="button"
            onClick={() => setBothPalettes(null, "accent")}
            className="mt-0 flex flex-col items-center gap-1 pl-1 text-[11px] font-semibold text-neutral-500 hover:text-neutral-800 dark:text-neutral-300 dark:hover:text-neutral-100"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-neutral-300 dark:border-white/20">
              ✕
            </span>
            Défaut
          </button>
        </div>
      </OptionGroup>

      {/* Apparence claire / sombre */}
      <OptionGroup
        title="Apparence du site"
        hint="Les visiteurs peuvent toujours passer du clair au sombre à l'aide du bouton de l'en-tête — ce choix définit l'apparence des nouveaux visiteurs."
      >
        <div className="flex flex-wrap gap-2.5">
          <Choice
            active={config.mode === null}
            onClick={() => update((c) => ({ ...c, mode: null }))}
          >
            🌗 Actuel (nuit d’abord)
          </Choice>
          <Choice
            active={config.mode === "light"}
            onClick={() => update((c) => ({ ...c, mode: "light" }))}
          >
            ☀️ Clair
          </Choice>
          <Choice
            active={config.mode === "dark"}
            onClick={() => update((c) => ({ ...c, mode: "dark" }))}
          >
            🌙 Sombre
          </Choice>
        </div>
      </OptionGroup>

      {/* Style des cartes */}
      <OptionGroup
        title="Style des cartes"
        hint="L'aspect des blocs d'actualités et de vidéos."
      >
        <div className="flex flex-wrap gap-2.5">
          <Choice
            active={radiusNow === null && shadowsNow === null}
            onClick={() => setComponents(null, null)}
          >
            Défaut du thème
          </Choice>
          <Choice
            active={radiusNow === "sharp" && shadowsNow === "none"}
            onClick={() => setComponents("sharp", "none")}
          >
            <span className="mr-1 inline-block h-3 w-3 rounded-[2px] border border-current align-middle" />
            Classique
          </Choice>
          <Choice
            active={radiusNow === "standard" && shadowsNow === "soft"}
            onClick={() => setComponents("standard", "soft")}
          >
            <span className="mr-1 inline-block h-3 w-3 rounded-[4px] border border-current align-middle" />
            Arrondi
          </Choice>
          <Choice
            active={radiusNow === "round" && shadowsNow === "strong"}
            onClick={() => setComponents("round", "strong")}
          >
            <span className="mr-1 inline-block h-3 w-3 rounded-full border border-current align-middle shadow" />
            Moderne
          </Choice>
        </div>
      </OptionGroup>

      {/* Taille du logo */}
      <OptionGroup
        title="Taille du logo"
        hint="Le logo garde toujours ses proportions exactes."
      >
        <div className="flex flex-wrap gap-2.5">
          <Choice active={logoNow === "small"} onClick={() => update((c) => ({ ...c, header: { ...c.header, logoScale: "small" } }))}>
            Petit
          </Choice>
          <Choice active={logoNow === "standard"} onClick={() => update((c) => ({ ...c, header: { ...c.header, logoScale: "standard" } }))}>
            Normal
          </Choice>
          <Choice active={logoNow === "large"} onClick={() => update((c) => ({ ...c, header: { ...c.header, logoScale: "large" } }))}>
            Grand
          </Choice>
        </div>
      </OptionGroup>

      {/* Présentation de la page d'accueil */}
      <OptionGroup
        title="Présentation de la page d'accueil"
        hint="Nombre de cartes d’articles et de vidéos + respiration de la page."
      >
        <div className="flex flex-wrap gap-2.5">
          <Choice
            active={spacingNow === "compact" && featureColsNow === "4" && videosColsNow === "4"}
            onClick={() => setPresentation("compact", "4")}
          >
            Compacte
          </Choice>
          <Choice
            active={spacingNow === null && featureColsNow === null && videosColsNow === null}
            onClick={() => setPresentation(null, null)}
          >
            Équilibrée (défaut)
          </Choice>
          <Choice
            active={spacingNow === "airy" && featureColsNow === "2" && videosColsNow === "2"}
            onClick={() => setPresentation("airy", "2")}
          >
            Visuelle (grandes images)
          </Choice>
        </div>
      </OptionGroup>
    </div>
  );
}
