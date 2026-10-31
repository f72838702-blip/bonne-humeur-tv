import Link from "next/link";
import { Lock, Settings, ShieldAlert } from "lucide-react";

/**
 * Écrans de refus honnêtes du back-office :
 * - « forbidden »      : session valide mais rôle insuffisant
 * - « unconfigured »    : backend Supabase non configuré (jamais de faux CMS)
 * - « not found »       : contenu inexistant ou hors périmètre RLS
 */
export function ForbiddenScreen() {
  return (
    <AdminNotice
      icon={<ShieldAlert className="h-6 w-6" />}
      title="Accès refusé"
      description="Votre rôle ne permet pas d'accéder à cette section. Contactez un administrateur de la rédaction si vous pensez que c'est une erreur."
    />
  );
}

export function UnconfiguredScreen() {
  return (
    <AdminNotice
      icon={<Settings className="h-6 w-6" />}
      title="Back-office non configuré"
      description="Le backend Supabase n'est pas encore relié à cette application. Suivez les étapes du fichier supabase/README-CONFIGURATION.md (création du projet, migrations, premier compte administrateur, variables d'environnement), puis rechargez cette page."
    />
  );
}

export function NotFoundScreen({ what }: { what: string }) {
  return (
    <AdminNotice
      icon={<Lock className="h-6 w-6" />}
      title={`${what} introuvable`}
      description="Ce contenu n'existe pas, a été supprimé, ou n'est pas dans votre périmètre. Retournez à la liste pour poursuivre."
    />
  );
}

function AdminNotice({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-16 text-center dark:border-white/10 dark:bg-night-900/50">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-guinea-red/10 text-guinea-red">
        {icon}
      </span>
      <h2 className="mt-4 font-display text-xl font-bold">{title}</h2>
      <p className="mt-2 max-w-lg text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
        {description}
      </p>
      <Link
        href="/admin"
        className="mt-6 rounded-xl bg-guinea-red px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-guinea-red/90"
      >
        Retour au tableau de bord
      </Link>
    </div>
  );
}