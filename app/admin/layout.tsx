import type { Metadata } from "next";
import { getSessionInfo } from "@/lib/auth/session";
import Sidebar from "@/components/admin/Sidebar";
import PwaAdmin from "@/components/admin/PwaAdmin";
import { getDemandesNotificationCount } from "@/lib/data/requests";

/**
 * Layout du back-office.
 * Sans session (seul cas accessible : /admin/login) → rendu nu, sans
 * sidebar — pas de redirection ici, sinon /admin/login bouclerait ;
 * chaque page admin applique elle-même requireRole() (le middleware
 * n'est qu'une garde UX).
 *
 * PWA « Bonne Humeur TV Admin » : le manifest est volontairement lié
 * ICI et nulle part ailleurs — le navigateur ne propose l'installation
 * que depuis le back-office, jamais depuis la façade publique. Le
 * service worker (/sw.js) est « réseau seul » : il ne met AUCUNE page
 * ni donnée en cache (aucun contenu privé hors ligne) ; le composant
 * client PwaAdmin l'enregistre et affiche l'indicateur déconnexion.
 */

export const metadata: Metadata = {
  title: { default: "Back-office", template: "%s | Bonne Humeur TV" },
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "BHTV Admin",
    statusBarStyle: "black-translucent",
  },
  // Sécurité maximale iOS : certaines versions de Safari ignorent le
  // manifest pour le mode standalone — la meta historique est émise
  // explicitement (Next 15 ne la génère plus automatiquement).
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
  icons: {
    apple: "/icons/bhtv-admin-apple-180.png",
  },
};

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSessionInfo();

  if (!session) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {children}
        {/* PWA même sur la page de connexion : l'app reste installable
            et l'indicateur réseau fonctionne avant connexion. */}
        <PwaAdmin />
      </div>
    );
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
      {/* PWA Admin : SW « réseau seul » + indicateur hors ligne (zéro
          effet sur la navigation, la session ou les données). */}
      <PwaAdmin />
    </div>
  );
}