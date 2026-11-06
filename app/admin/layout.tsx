import type { Metadata } from "next";
import { getSessionInfo } from "@/lib/auth/session";
import Sidebar from "@/components/admin/Sidebar";
import { getDemandesNotificationCount } from "@/lib/data/requests";

/**
 * Layout du back-office.
 * Sans session (seul cas accessible : /admin/login) → rendu nu, sans
 * sidebar — pas de redirection ici, sinon /admin/login bouclerait ;
 * chaque page admin applique elle-même requireRole() (le middleware
 * n'est qu'une garde UX).
 */

export const metadata: Metadata = {
  title: { default: "Back-office", template: "%s | Bonne Humeur TV" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSessionInfo();

  if (!session) {
    return <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</div>;
  }

  const fullName =
    session.profile?.full_name?.trim() || session.email || "Membre de la rédaction";
  const role = session.profile?.role ?? "reporter";

  // Badge de notification « Demandes » : nouveau partenariat OU message
  // non lu, UNIQUEMENT pour les rôles qui voient cet onglet (reporter :
  // aucune requête — RLS et quotas préservés).
  const count =
    role === "admin" || role === "editor" ? await getDemandesNotificationCount() : null;
  const demandsTotal = count ? count.unseenPartnerships + count.unreadContacts : 0;

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:flex-row">
      <Sidebar
        role={role}
        userName={fullName}
        demandsCount={role === "admin" || role === "editor" ? demandsTotal : undefined}
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}