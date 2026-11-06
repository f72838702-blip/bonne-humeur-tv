"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, Moon, Search, Sun, X } from "lucide-react";
import { useTheme } from "@/store/theme";
import { cn } from "@/lib/utils";
import Logo from "@/components/shared/Logo";

const NAV_LINKS = [
  { href: "/", label: "Accueil" },
  { href: "/actualites", label: "Actualités" },
  { href: "/videos", label: "Vidéos" },
  { href: "/partenariats", label: "Offres & Partenariats" },
  { href: "/contact", label: "Contact" },
];

export default function Header() {
  const pathname = usePathname();
  const { dark, toggle } = useTheme();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200/60 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-night-950/80">
      <div className="tricolor-line h-1 w-full" />
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Logo officiel (PNG transparent, original tel quel) — remplace
            l'ancien badge Play + nom textuel ; h-8 mobile / h-10 desktop,
            aucune déformation (w-auto + object-contain). */}
        <Link
          href="/"
          aria-label="Bonne Humeur TV — Accueil"
          className="group flex min-w-0 items-center"
        >
          <Logo className="h-8 w-auto select-none object-contain transition-transform group-hover:scale-[1.02] sm:h-9 lg:h-10" />
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
        <nav className="border-t border-neutral-200/60 bg-white px-4 py-3 dark:border-white/10 dark:bg-night-950 md:hidden">
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
