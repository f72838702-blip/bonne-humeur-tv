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
 * PWA « Bonne Humeur Média Admin » : les artefacts d'installation sont
 * volontairement émis ICI et nulle part ailleurs — et SEULEMENT avec une
 * session connectée (l'installation n'est jamais proposée ni depuis la
 * façade publique, ni depuis /admin/login — demande direction 07/11).
 * Le service worker (/sw.js) est « réseau seul » : il ne met AUCUNE page
 * ni donnée en cache (aucun contenu privé hors ligne) ; le composant
 * client PwaAdmin l'enregistre (session seulement) et affiche
 * l'indicateur déconnexion.
 */

export const metadata: Metadata = {
  title: { default: "Administration — Bonne Humeur Média", template: "%s | Bonne Humeur Média" },
  robots: { index: false, follow: false },
  // Sécurité : AUCUN artefact d'installation (« manifest », méta Apple,
  // icône Apple) n'est émis ici — ils sont rendus UNIQUEMENT dans la
  // branche avec session ci-dessous (React 19 hisse <link>/<meta> dans
  // <head>). Une page sans session ne contient donc littéralement pas de
  // manifest : le navigateur ne peut pas proposer l'installation tant
  // qu'on n'est pas connecté (demande direction 07/11).
};

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSessionInfo();

  if (!session) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {children}
        {/* SANS session : aucun artefact d'installation, aucun SW —
            l'installation est impossible depuis /admin/login. L'indicateur
            hors ligne reste actif (informatif, sans état). */}
        <PwaAdmin offlineOnly />
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
      {/* Artefacts d'installation UNIQUEMENT avec une session connectée
          (demande direction 07/11) : React 19 hisse ces <link>/<meta>
          dans <head> côté serveur — la page HTML contient le manifest
          avant même l'hydratation. Sans session, ils n'existent nulle
          part : « Installer l'application » ne peut pas être proposé. */}
      <link rel="manifest" href="/manifest.webmanifest" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-title" content="Bonne Humeur Média Admin" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <link rel="apple-touch-icon" href="/icons/bhtv-admin-apple-180.png" />
      <Sidebar
        role={role}
        userName={fullName}
        demandsCount={role === "admin" || role === "editor" ? demandsTotal : undefined}
      />
      <div className="min-w-0 flex-1">{children}</div>
      {/* PWA Admin : SW « réseau seul » enregistré ici (session connectée)
          + indicateur hors ligne (zéro effet sur la navigation, la session
          ou les données). */}
      <PwaAdmin />
    </div>
  );
}