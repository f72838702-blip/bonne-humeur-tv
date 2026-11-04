"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  FolderTree,
  ImagesIcon,
  Inbox,
  LayoutDashboard,
  Megaphone,
  FileText,
  Users,
  Video,
  Zap,
} from "lucide-react";
import type { UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/actions/auth";

/**
 * Navigation du back-office. Les entrées sont masquées selon le rôle
 * (UX uniquement) : chaque page ET chaque Server Action revérifient
 * requireRole() côté serveur — l'UI n'est jamais le contrôle d'accès.
 */

const ALL_ITEMS = [
  { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard, roles: ["admin", "editor", "reporter"] },
  { href: "/admin/articles", label: "Articles", icon: FileText, roles: ["admin", "editor", "reporter"] },
  { href: "/admin/videos", label: "Vidéos", icon: Video, roles: ["admin", "editor"] },
  { href: "/admin/flash-infos", label: "Flash-infos", icon: Zap, roles: ["admin", "editor"] },
  { href: "/admin/demandes", label: "Demandes", icon: Inbox, roles: ["admin", "editor"] },
  { href: "/admin/statistiques", label: "Statistiques", icon: BarChart3, roles: ["admin"] },
  { href: "/admin/categories", label: "Catégories", icon: FolderTree, roles: ["admin", "editor"] },
  { href: "/admin/medias", label: "Médiathèque", icon: ImagesIcon, roles: ["admin", "editor"] },
  { href: "/admin/publicites", label: "Publicités", icon: Megaphone, roles: ["admin", "editor"] },
  { href: "/admin/utilisateurs", label: "Utilisateurs", icon: Users, roles: ["admin"] },
] as const;

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrateur",
  editor: "Éditeur",
  reporter: "Reporter",
};

export default function Sidebar({
  role,
  userName,
  demandsCount = 0,
}: {
  role: UserRole;
  userName: string;
  /** Demandes jamais vues + messages jamais lus (notifications utiles
   *  SEULEMENT — les éléments déjà consultés ne comptent jamais). */
  demandsCount?: number;
}) {
  const pathname = usePathname();
  const items = ALL_ITEMS.filter((item) =>
    (item.roles as readonly UserRole[]).includes(role)
  );

  function isActive(href: string): boolean {
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <aside className="flex w-full shrink-0 flex-col gap-6 lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)] lg:w-64">
      {/* Identité de l'utilisateur connecté (données réelles de la session) */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-night-800">
        <p className="truncate font-display text-sm font-bold">{userName}</p>
        <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-guinea-red">
          {ROLE_LABELS[role]}
        </p>
      </div>

      <nav className="flex flex-col gap-1" aria-label="Navigation du back-office">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors",
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

      <form action={signOut} className="mt-auto">
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