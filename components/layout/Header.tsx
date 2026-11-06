"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, Moon, Search, Sun, X } from "lucide-react";
import { useTheme } from "@/store/theme";
import { cn } from "@/lib/utils";
import Logo from "@/components/shared/Logo";
import type { HeaderConfig } from "@/lib/design/schema";

const NAV_LINKS = [
  { href: "/", label: "Accueil" },
  { href: "/actualites", label: "Actualités" },
  { href: "/videos", label: "Vidéos" },
  { href: "/partenariats", label: "Offres & Partenariats" },
  { href: "/contact", label: "Contact" },
];

/* Styles d'arrière-plan (listes fermées — aucune chaîne libre possible). */
const HEADER_STYLES = {
  glass: "bg-white/80 backdrop-blur-xl dark:bg-night-950/80 border-neutral-200/60 dark:border-white/10",
  solid: "bg-surface dark:bg-night-950 border-neutral-200 dark:border-white/10",
  flat: "bg-transparent border-transparent",
} as const;

const LOGO_SIZES = {
  small: "h-6 sm:h-7 lg:h-8",
  standard: "h-8 sm:h-9 lg:h-10",
  large: "h-9 sm:h-10 lg:h-12",
} as const;

/**
 * En-tête configurable (Studio de design). La config vient du layout
 * serveur (défauts = comportement historique EXACT). Le logo officiel
 * garde en toutes configurations h-fixe + w-auto + object-contain :
 * jamais déformé (règle §8).
 */
export default function Header({
  config,
}: {
  config?: HeaderConfig | null;
}) {
  const pathname = usePathname();
  const { dark, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const [shrunk, setShrunk] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // behavior = "compact" : la barre se réduit discrètement au défilement.
  const compact = config?.behavior === "compact";
  useEffect(() => {
    if (!compact) return;
    const onScroll = () => setShrunk(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [compact]);

  const style = headerStyleOr(config?.style);
  const position =
    config?.behavior === "static" ? "relative" : "sticky top-0";

  return (
    <header
      className={cn(
        "z-50 border-b transition-[background-color,border-color,height]",
        HEADER_STYLES[style],
        position,
      )}
    >
      <div className="tricolor-line h-1 w-full" />
      <div
        className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6"
        style={{
          height: compact && shrunk ? "3rem" : "var(--bhtv-header-h)",
          transition: "height 200ms ease",
        }}
      >
        {/* Logo officiel (PNG transparent, original tel quel) — hauteur
            choisie au Studio, jamais de déformation (w-auto + contain). */}
        <Link
          href="/"
          aria-label="Bonne Humeur TV — Accueil"
          className="group flex min-w-0 items-center"
        >
          <Logo
            className={cn(
              "w-auto select-none object-contain transition-transform group-hover:scale-[1.02]",
              LOGO_SIZES[config?.logoScale ?? "standard"],
            )}
          />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-guinea-red/10 text-guinea-red dark:bg-guinea-red/20"
                    : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-white/5 dark:hover:text-white"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/recherche"
            aria-label="Rechercher"
            className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-white/10"
          >
            <Search className="h-4 w-4" />
          </Link>
          <button
            onClick={toggle}
            aria-label="Basculer le thème"
            className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-white/10"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
            className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-white/10 md:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-neutral-200/60 bg-surface px-4 py-3 dark:border-white/10 dark:bg-night-950 md:hidden">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "block rounded-xl px-4 py-3 text-sm font-medium",
                pathname === link.href
                  ? "bg-guinea-red/10 text-guinea-red"
                  : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-white/5"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

/** Enum fermée — repli défensif (jamais de valeur inconnue). */
function headerStyleOr(s: HeaderConfig["style"] | undefined): keyof typeof HEADER_STYLES {
  return s === "solid" || s === "flat" ? s : "glass";
}
