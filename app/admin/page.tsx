import Link from "next/link";
import { redirect } from "next/navigation";
import {
  FileText,
  Inbox,
  Video,
  Zap,
} from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { getDashboardStats } from "@/lib/data/dashboard";
import { ForbiddenScreen, UnconfiguredScreen } from "@/components/admin/AccessDenied";

/**
 * Tableau de bord : compteurs réels calculés par la base, dans le
 * périmètre RLS du rôle connecté. Aucun chiffre inventé.
 */

export const metadata = { title: "Tableau de bord" };

export default async function AdminDashboardPage() {
  const guard = await requireRole(["admin", "editor", "reporter"]);
  if ("denied" in guard) {
    if (guard.denied === "unauthenticated") redirect("/admin/login");
    if (guard.denied === "unconfigured") return <UnconfiguredScreen />;
    return <ForbiddenScreen />;
  }

  const role = guard.session.profile?.role ?? "reporter";
  const isStaff = role === "admin" || role === "editor";
  const stats = await getDashboardStats();

  if (!stats) return <UnconfiguredScreen />;

  const statCards = [
    { label: "Articles publiés", value: stats.articlesPublished, href: "/admin/articles", icon: FileText, staffOnly: false },
    { label: "Brouillons", value: stats.articlesDraft, href: "/admin/articles?statut=draft", icon: FileText, staffOnly: false },
    { label: "À valider", value: stats.articlesReview, href: "/admin/articles?statut=review", icon: FileText, staffOnly: false },
    { label: "Publications programmées", value: stats.articlesScheduled, href: "/admin/articles?statut=scheduled", icon: FileText, staffOnly: true },
    { label: "Vidéos publiées", value: stats.videosPublished, href: "/admin/videos", icon: Video, staffOnly: true },
    { label: "Flash-infos actifs", value: stats.breakingNewsActive, href: "/admin/flash-infos", icon: Zap, staffOnly: true },
    { label: "Nouvelle demande de partenariat", value: stats.partnershipRequestsUnseen, href: "/admin/demandes", icon: Inbox, staffOnly: true },
    { label: "Messages non lus", value: stats.contactMessagesUnread, href: "/admin/demandes?onglet=contact", icon: Inbox, staffOnly: true },
  ];

  const quickLinks = [
    { href: "/admin/articles/new", label: "Rédiger un article" },
    ...(isStaff ? [{ href: "/admin/videos/new", label: "Ajouter une vidéo" }] : []),
    ...(isStaff ? [{ href: "/admin/flash-infos", label: "Gérer les flash-infos" }] : []),
    ...(isStaff ? [{ href: "/admin/demandes", label: "Traiter les demandes" }] : []),
  ];

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Tableau de bord</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Vue d’ensemble de l’activité éditoriale — chiffres réels, en direct de la base.
        </p>
      </header>

      <section aria-label="Statistiques" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards
          .filter((c) => !c.staffOnly || isStaff)
          .map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.label}
                href={card.href}
                className="group flex flex-col rounded-2xl border border-neutral-200 bg-white p-5 transition-all hover:border-guinea-red/40 hover:shadow-lg dark:border-white/10 dark:bg-night-800 dark:hover:border-guinea-red/50"
              >
                <span className="flex items-center justify-between">
                  <Icon className="h-4 w-4 text-guinea-red" />
                </span>
                <span className="mt-3 font-display text-3xl font-extrabold tabular-nums">
                  {card.value}
                </span>
                <span className="mt-1 text-xs font-semibold leading-snug text-neutral-500 dark:text-neutral-400">
                  {card.label}
                </span>
              </Link>
            );
          })}
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold">Actions rapides</h2>
        <div className="flex flex-wrap gap-3">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-xl bg-guinea-red px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-guinea-red/90"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}