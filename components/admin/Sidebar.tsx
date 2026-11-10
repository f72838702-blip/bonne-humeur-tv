"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ExternalLink,
  FolderTree,
  History,
  ImagesIcon,
  Inbox,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Palette,
  FileText,
  Radio,
  Sparkles,
  Users,
  Video,
  Zap,
} from "lucide-react";
import type { UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/actions/auth";
import Logo from "@/components/shared/Logo";

/**
 * Navigation du back-office. Les entrées sont masquées selon le rôle ET
 * les permissions effectives (mission 0036, calculées côté serveur via
 * effectivePermissions — la liste `permissions` est DONNÉE, jamais une
 * décision : chaque page ET chaque Server Action revérifient
 * requireRole()/requirePermission() côté serveur — l'UI n'est jamais le
 * contrôle d'accès, elle n'explique que la règle).
 */

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Rôles admis (super_admin hérite de tout ce qui exige « admin »). */
  roles?: readonly string[];
  /** Éditeur : au moins une de ces clés (0036). Ignorée pour les autres. */
  any?: readonly string[];
  superOnly?: boolean;
}

const ALL_ITEMS: NavItem[] = [
  { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard, roles: ["admin", "editor", "reporter"] },
  // Articles : reporter inclus (SES propres brouillons) ; un éditeur doit
  // posséder au moins une permission « articles » (0036).
  { href: "/admin/articles", label: "Articles", icon: FileText, roles: ["admin", "editor", "reporter"], any: ["articles", "articles_tous", "articles_publier"] },
  // Assistant IA de rédaction — l'éditeur doit posséder une permission article.
  { href: "/admin/assistant", label: "Assistant IA", icon: Sparkles, roles: ["admin", "editor"], any: ["articles", "articles_tous", "articles_publier"] },
  { href: "/admin/videos", label: "Vidéos", icon: Video, roles: ["admin", "editor"], any: ["videos"] },
  { href: "/admin/direct", label: "Direct", icon: Radio, roles: ["admin", "editor"], any: ["directs"] },
  { href: "/admin/flash-infos", label: "Flash-infos", icon: Zap, roles: ["admin", "editor"], any: ["flash"] },
  // Demandes B2B : traitement réservé admin/super_admin (0036).
  { href: "/admin/demandes", label: "Demandes", icon: Inbox, roles: ["admin"] },
  { href: "/admin/statistiques", label: "Statistiques", icon: BarChart3, roles: ["admin", "editor"], any: ["consultation"] },
  { href: "/admin/categories", label: "Catégories", icon: FolderTree, roles: ["admin", "editor"], any: ["articles"] },
  { href: "/admin/medias", label: "Médiathèque", icon: ImagesIcon, roles: ["admin", "editor"], any: ["articles", "videos", "flash", "publicite", "directs"] },
  { href: "/admin/publicites", label: "Publicités", icon: Megaphone, roles: ["admin", "editor"], any: ["publicite"] },
  // Super Administrateur UNIQUEMENT (mission 0036) :
  { href: "/admin/journal", label: "Journal d'activité", icon: History, superOnly: true },
  // Studio de design — personnalisation de l'apparence (super admin seul).
  { href: "/admin/studio", label: "Studio de design", icon: Palette, superOnly: true },
  { href: "/admin/utilisateurs", label: "Gestion des administrateurs", icon: Users, superOnly: true },
];

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Administrateur",
  admin: "Administrateur",
  editor: "Éditeur",
  reporter: "Reporter",
};

export default function Sidebar({
  role,
  permissions,
  userName,
  demandsCount = 0,
}: {
  role: UserRole;
  /** Permissions EFFECTIVES de la session (server-computed —
   *  lib/auth/permissions.effectivePermissions). */
  permissions: string[];
  userName: string;
  /** Demandes jamais vues + messages jamais lus (notifications utiles
   *  SEULEMENT — les éléments déjà consultés ne comptent jamais). */
  demandsCount?: number;
}) {
  const pathname = usePathname();
  const items = ALL_ITEMS.filter((item) => {
    // Entrées strictement super admin (Studio, Journal, Gestion des
    // administrateurs) : personne d'autre ne les voit, page ET action
    // revérifient isSuperAdmin() côté serveur.
    if (item.superOnly) {
      return role === "super_admin";
    }
    const roles = item.roles ?? [];
    if (!roles.includes(role)) {
      // 0036 : le super admin couvre partout où « admin » est requis.
      if (!(role === "super_admin" && roles.includes("admin"))) {
        return false;
      }
    }
    // Permissions de l'ÉDITEUR uniquement (le reporter n'a aucune clé ;
    // admin/super_admin reçoivent déjà toutes les clés du serveur).
    if (role === "editor" && item.any) {
      return item.any.some((key) => permissions.includes(key));
    }
    return true;
  });

  function isActive(href: string): boolean {
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <aside className="flex w-full shrink-0 flex-col gap-3 lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)] lg:w-64 lg:gap-6 lg:overflow-y-auto lg:pb-2">
      {/* ── MOBILE (<lg) : ligne compacte logo + identité + déconnexion,
          puis bandes de navigation horizontales — le contenu suit
          immédiatement, sans interminable menu vertical. ── */}
      <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-surface p-3 dark:border-white/10 dark:bg-night-800 lg:hidden">
        <Logo className="h-7 w-auto shrink-0 select-none object-contain" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-bold">{userName}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-guinea-red">
            {ROLE_LABELS[role]}
          </p>
        </div>
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Voir le site public"
          className="shrink-0 rounded-lg p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-guinea-red dark:text-neutral-400 dark:hover:bg-white/5 dark:hover:text-guinea-red"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
        <form action={signOut}>
          <button
            type="submit"
            aria-label="Se déconnecter"
            className="shrink-0 rounded-lg p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-guinea-red dark:text-neutral-400 dark:hover:bg-white/5 dark:hover:text-guinea-red"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </form>
      </div>

      {/* ── DESKTOP (lg+) : carte utilisateur complète, inchangée. ── */}
      <div className="hidden rounded-2xl border border-neutral-200 bg-surface p-4 dark:border-white/10 dark:bg-night-800 lg:block">
        <Logo className="h-8 w-auto select-none object-contain" />
        <p className="mt-3 truncate font-display text-sm font-bold">{userName}</p>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-guinea-red">
          {ROLE_LABELS[role]}
        </p>
        {/* SEUL accès évident vers le site public depuis l'administration
            (demande direction) : nouvel onglet, session et page de travail
            préservées. Aucune autre navigation publique dans le back-office. */}
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-guinea-red dark:text-neutral-400 dark:hover:bg-white/5 dark:hover:text-guinea-red"
        >
          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
          Voir le site public
        </a>
      </div>

      {/* Navigation : bandes à défilement horizontal sur téléphone
          (barre de défilement masquée, chaque entrée reste cliquable),
          colonne verticale classique sur ordinateur. */}
      <nav
        className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0"
        aria-label="Navigation du back-office"
      >
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-transparent px-3.5 py-2 text-xs font-semibold transition-colors",
                "lg:w-full lg:rounded-xl lg:px-4 lg:py-2.5 lg:text-sm lg:whitespace-normal",
                active
                  ? "bg-guinea-red/10 text-guinea-red"
                  : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-white/5 dark:hover:text-white"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
              {item.href === "/admin/demandes" && demandsCount > 0 && (
                <span className="ml-auto rounded-full bg-guinea-red px-2 py-0.5 text-[10px] font-extrabold leading-none text-white">
                  {demandsCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <form action={signOut} className="hidden lg:mt-auto lg:block">
        <button
          type="submit"
          className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-600 transition-colors hover:border-guinea-red/50 hover:text-guinea-red dark:border-white/10 dark:text-neutral-300"
        >
          Se déconnecter
        </button>
      </form>
    </aside>
  );
}