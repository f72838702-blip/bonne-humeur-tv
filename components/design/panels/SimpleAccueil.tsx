"use client";

/**
 * ORGANISATION DE LA PAGE D'ACCUEIL (Studio simplifié) — chaque section
 * est une grande carte : nom humain + illustration + interrupteur
 * Afficher/Masquer + boutons Monter / Descendre. Le glisser-déposer
 * reste disponible mais JAMAIS obligatoire.
 * Fil d'infos, bandeau EN DIRECT et emplacements publicitaires : hors
 * de cette interface (mobilier permanent, protégé — brief §8).
 */
import type { DesignConfig } from "@/lib/design/schema";
import {
  Briefcase,
  Clapperboard,
  Flame,
  Handshake,
  LayoutGrid,
  MonitorPlay,
} from "lucide-react";
import { ToggleField } from "../ui";
import { cn } from "@/lib/utils";

/** Intitulés HUMAINS + explication courte (jargon interdit). */
const SIMPLE_SECTIONS = {
  hero: {
    label: "La grande vidéo",
    desc: "La vidéo à la une, tout en haut de la page",
    icon: MonitorPlay,
  },
  featured: {
    label: "Actualités à la une",
    desc: "Les articles mis en avant",
    icon: Flame,
  },
  categories: {
    label: "Nos rubriques",
    desc: "Les grands thèmes du site",
    icon: LayoutGrid,
  },
  videos: {
    label: "Nos vidéos",
    desc: "Les dernières vidéos publiées",
    icon: Clapperboard,
  },
  b2b: {
    label: "Offres aux annonceurs",
    desc: "L'invitation aux entreprises et institutions",
    icon: Briefcase,
  },
  partners: {
    label: "Partenariats officiels",
    desc: "La bannière des partenaires",
    icon: Handshake,
  },
} as const;

export function SimpleAccueil({
  config,
  update,
}: {
  config: DesignConfig;
  update: (fn: (c: DesignConfig) => DesignConfig) => void;
}) {
  const move = (from: number, to: number) => {
    if (from === to) return;
    update((c) => {
      const sections = [...c.home.sections];
      const [moved] = sections.splice(from, 1);
      sections.splice(to, 0, moved);
      return { ...c, home: { ...c.home, sections } };
    });
  };

  const patch = (i: number, p: Partial<DesignConfig["home"]["sections"][number]>) =>
    update((c) => ({
      ...c,
      home: {
        ...c.home,
        sections: c.home.sections.map((s, idx) => (idx === i ? { ...s, ...p } : s)),
      },
    }));

  return (
    <div className="space-y-3">
      <p className="rounded-xl bg-neutral-100 px-4 py-3 text-xs leading-relaxed text-neutral-500 dark:bg-white/5 dark:text-neutral-400">
        Utilisez les boutons <strong>Monter / Descendre</strong> pour changer
        l’ordre (le glisser-déposer fonctionne aussi). Masquer une section la
        fait simplement disparaître — vous pourrez la réafficher ici.
      </p>

      <ul className="space-y-2.5">
        {config.home.sections.map((s, i) => {
          const info = SIMPLE_SECTIONS[s.id as keyof typeof SIMPLE_SECTIONS];
          const Icon = info.icon;
          return (
            <li
              key={s.id}
              data-testid={`simple-section-${s.id}`}
              draggable
              onDragStart={(e) => e.dataTransfer.setData("text/plain", String(i))}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const from = parseInt(e.dataTransfer.getData("text/plain"), 10);
                if (!Number.isNaN(from)) move(from, i);
              }}
              className={cn(
                "rounded-2xl border bg-surface p-3.5 transition-colors dark:bg-night-900",
                "border-neutral-200 dark:border-white/10",
                !s.visible && "opacity-55",
              )}
            >
              <div className="flex items-center gap-3">
                {/* Illustration */}
                <span
                  aria-hidden
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-guinea-red/10 text-guinea-red"
                >
                  <Icon className="h-5 w-5" />
                </span>
                {/* Nom humain */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold text-neutral-800 dark:text-neutral-50">
                    {info.label}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {info.desc}
                  </p>
                </div>
                {/* Monter / Descendre (moyens de taille confortable) */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={`Monter « ${info.label} »`}
                    onClick={() => move(i, Math.max(0, i - 1))}
                    className="rounded-lg border border-neutral-200 px-2.5 py-2 text-sm font-bold text-neutral-500 hover:border-neutral-400 hover:text-neutral-900 disabled:opacity-30 dark:border-white/10 dark:text-neutral-300 dark:hover:text-neutral-50"
                    style={{ opacity: i === 0 ? 0.35 : 1 }}
                    disabled={i === 0}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Descendre « ${info.label} »`}
                    onClick={() =>
                      move(i, Math.min(config.home.sections.length - 1, i + 1))
                    }
                    className="rounded-lg border border-neutral-200 px-2.5 py-2 text-sm font-bold text-neutral-500 hover:border-neutral-400 hover:text-neutral-900 dark:border-white/10 dark:text-neutral-300 dark:hover:text-neutral-50"
                    style={{ opacity: i === config.home.sections.length - 1 ? 0.35 : 1 }}
                    disabled={i === config.home.sections.length - 1}
                  >
                    ↓
                  </button>
                </div>
              </div>
              {/* Interrupteur Afficher / Masquer */}
              <ToggleField
                label={s.visible ? "Affichée" : "Masquée"}
                checked={s.visible}
                onChange={(v) => patch(i, { visible: v })}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
