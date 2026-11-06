"use client";

/**
 * ÉTAPE 1 « CHOISIR » DU STUDIO SIMPLIFIÉ — grandes cartes de thème avec
 * VRAIE miniature (couleurs, arrondis, ombres, polices RÉELS du thème,
 * sur la palette que verront les nouveaux visiteurs). Aucun réglage
 * technique affiché : un clic choisit le design.
 * Sécurité : tout est rendu React (aucune chaîne libre n'atteint le DOM).
 */
import type { DesignConfig } from "@/lib/design/schema";
import { THEME_PRESETS } from "@/lib/design/themes";
import { FONT_VAR_FOR, SHADOW_SETS, RADIUS_SETS } from "@/lib/design/tokens";
import type { ColorSet } from "@/lib/design/schema";
import { cn } from "@/lib/utils";

/** Valeurs du socle (globals.css) — repli quand une clé est « null ». */
const SOCLE = {
  light: {
    bg: "#fafafa",
    surface: "#ffffff",
    surfaceAlt: "#f5f5f5",
    line: "#e5e5e5",
    inkStrong: "#171717",
    ink: "#525252",
    inkMuted: "#737373",
    inkFaint: "#a3a3a3",
    brand: "#CE1126",
    accent: "#FCD116",
    positive: "#009A44",
  },
  dark: {
    bg: "#0a0a0f",
    surface: "#17171f",
    surfaceAlt: "#101016",
    line: "rgb(255 255 255 / 0.1)",
    inkStrong: "#f5f5f5",
    ink: "#d4d4d4",
    inkMuted: "#737373",
    inkFaint: "#a3a3a3",
    brand: "#CE1126",
    accent: "#FCD116",
    positive: "#009A44",
  },
} as const;

type SocleSet = Record<keyof (typeof SOCLE)["dark"], string>;

/** #rrggbb(/3) → rgba — pour les fonds teintés (badge, pastilles). */
function withAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return hex;
  let h = m[1];
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function resolved(config: DesignConfig, tone: "light" | "dark"): SocleSet {
  const s = config.colors[tone] as ColorSet;
  return {
    bg: s.bg ?? SOCLE[tone].bg,
    surface: s.surface ?? SOCLE[tone].surface,
    surfaceAlt: s.surfaceAlt ?? SOCLE[tone].surfaceAlt,
    line: s.line ?? SOCLE[tone].line,
    inkStrong: s.inkStrong ?? SOCLE[tone].inkStrong,
    ink: s.ink ?? SOCLE[tone].ink,
    inkMuted: s.inkMuted ?? SOCLE[tone].inkMuted,
    inkFaint: s.inkFaint ?? SOCLE[tone].inkFaint,
    brand: s.brand ?? SOCLE[tone].brand,
    accent: s.accent ?? SOCLE[tone].accent,
    positive: s.positive ?? SOCLE[tone].positive,
  };
}

/** Vraie miniature du rendu : en-tête, titre, cartes, puces — tout est
 *  peint avec les RÉGLAGES du thème (pas une image figée). */
export function RichMiniature({
  config,
  appearance,
}: {
  config: DesignConfig;
  appearance: "light" | "dark";
}) {
  const c = resolved(config, appearance);
  const radiusSm = RADIUS_SETS[config.components.radius ?? "small"][1];
  const radiusXs = RADIUS_SETS[config.components.radius ?? "small"][0];
  const shadow = SHADOW_SETS[config.components.shadows ?? "soft"];
  const fontTitle = FONT_VAR_FOR[config.typography.fontTitles ?? "archivo"];
  const fontBody = FONT_VAR_FOR[config.typography.fontBody ?? "inter"];
  const headerBg =
    appearance === "dark" ? "rgb(255 255 255 / 0.06)" : c.surface;

  return (
    <div
      aria-hidden
      className="h-44 w-full overflow-hidden rounded-xl text-[7px] leading-snug"
      style={{ background: c.bg, fontFamily: fontBody }}
    >
      {/* En-tête */}
      <div
        className="flex items-center gap-1.5 px-2.5 py-1.5"
        style={{ background: headerBg, borderBottom: `1px solid ${c.line}` }}
      >
        <span className="h-2 w-2 rounded-full" style={{ background: c.brand }} />
        <span
          className="font-extrabold"
          style={{ color: c.inkStrong, fontFamily: fontTitle }}
        >
          Bonne Humeur TV
        </span>
        <span className="ml-auto flex gap-1">
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className="h-1 w-3.5 rounded-full"
              style={{ background: c.inkFaint }}
            />
          ))}
        </span>
      </div>

      {/* Corps : héro + cartes */}
      <div className="px-2.5 py-2">
        <div style={{ color: c.inkMuted }}>Actualités à la une</div>
        <div
          className="mt-0.5 w-4/5 truncate text-base font-extrabold"
          style={{ color: c.inkStrong, fontFamily: fontTitle }}
        >
          Le direct de Conakry
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span
            className="rounded-full px-1.5 py-0.5 font-bold text-white"
            style={{ background: c.brand }}
          >
            Regarder
          </span>
          <span className="h-1 w-16 rounded-full" style={{ background: c.accent }} />
        </div>

        <div className="mt-2 flex gap-1.5">
          {[0, 1, 2].map((n) => (
            <div
              key={n}
              className="flex-1 overflow-hidden p-1"
              style={{
                background: c.surface,
                borderRadius: radiusSm,
                boxShadow: shadow,
                border: `1px solid ${c.line}`,
              }}
            >
              <div
                className="h-8 w-full"
                style={{
                  background: c.surfaceAlt,
                  borderRadius: radiusXs,
                }}
              />
              <span
                className="mt-1 inline-block rounded-full px-1 py-px font-bold"
                style={{ background: withAlpha(c.brand, 0.12), color: c.brand }}
              >
                News
              </span>
              <div className="mt-0.5 h-1 w-10" style={{ background: c.ink }} />
              <div className="mt-0.5 h-1 w-8" style={{ background: c.inkMuted }} />
            </div>
          ))}
        </div>

        <div className="mt-2 flex gap-1">
          {["Société", "Économie", "Sport"].map((tag) => (
            <span
              key={tag}
              className="rounded-full border px-1.5 py-px font-semibold"
              style={{ borderColor: c.line, color: c.ink }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Descriptions du Studio simplifié — langage courant (thèmes inchangés). */
export const SIMPLE_THEME_INFO: Record<string, { text: string }> = {
  signature: {
    text: "Les couleurs de Bonne Humeur — rouge, jaune, vert. Moderne et chaleureux.",
  },
  premium: {
    text: "Sobre et professionnel : parfait pour une chaîne d'information sérieuse.",
  },
  modernTv: {
    text: "Fait pour la vidéo : gros titres et effet chaîne de télévision.",
  },
  magazine: {
    text: "Grandes images et texte généreux, comme un magazine papier.",
  },
  minimal: {
    text: "Tout simple, très lisible, sans décoration superflue.",
  },
};

/** Les 5 cartes de thème — cliquer choisit le design ENTIER. */
export function SimpleThemeCards({
  config,
  apply,
}: {
  config: DesignConfig;
  apply: (c: DesignConfig) => void;
}) {
  // Miniature = apparence que verront les NOUVEAUX visiteurs.
  const appearance: "light" | "dark" = config.mode ?? "dark";
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {THEME_PRESETS.map((preset) => {
        const active = JSON.stringify(config) === JSON.stringify(preset.config);
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() =>
              apply({
                ...structuredClone(preset.config),
                // Le choix clair/sombre (ÉTAPE 2) suit l'administrateur.
                mode: config.mode ?? null,
              })
            }
            className={cn(
              "group rounded-3xl border p-3 text-left transition-all dark:bg-night-900",
              active
                ? "border-guinea-red ring-2 ring-guinea-red/30"
                : "border-neutral-200 hover:-translate-y-0.5 hover:border-guinea-red/50 hover:shadow-lg dark:border-white/10",
            )}
          >
            <RichMiniature
              config={preset.config}
              appearance={appearance}
            />
            <p className="mt-3 text-base font-extrabold text-neutral-800 dark:text-neutral-50">
              {preset.name}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-neutral-500 dark:text-neutral-300">
              {SIMPLE_THEME_INFO[preset.id]?.text ?? preset.description}
            </p>
            <span
              className={cn(
                "mt-3 flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold transition-colors",
                active
                  ? "bg-guinea-red/10 text-guinea-red"
                  : "bg-guinea-red text-white group-hover:bg-guinea-red/90",
              )}
            >
              {active ? "Design choisi ✓" : "Choisir ce design"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
