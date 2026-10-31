import type { Metadata } from "next";
import { getSessionInfo } from "@/lib/auth/session";
import Sidebar from "@/components/admin/Sidebar";

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

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:flex-row">
      <Sidebar role={role} userName={fullName} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}