import { redirect } from "next/navigation";
import { ShieldCheck, Shield, Users } from "lucide-react";
import { isSuperAdmin, getSessionInfo } from "@/lib/auth/session";
import { getTeamEntries } from "@/lib/data/users";
import { effectivePermissions, isFullyPrivileged, PERMISSION_LABELS } from "@/lib/auth/permissions";
import { formatDate } from "@/lib/utils";
import { AddManagerForm, RoleChangeForm, PermissionsForm, SuspendForm, DeleteUserForm, ResetPasswordForm } from "@/components/admin/UserForms";
import { ForbiddenScreen, NotFoundScreen } from "@/components/admin/AccessDenied";

export const metadata = { title: "Gestion des administrateurs" };

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Administrateur",
  admin: "Administrateur",
  editor: "Éditeur",
  reporter: "Reporter",
};

/**
 * Gestion des administrateurs — Super Administrateur UNIQUEMENT (mission
 * 0036). Le compte Super Administrateur (le PDG) s'y voit protégé : un
 * seul, immuable (rôle/permissions/statut), insupprimable — triggers SQL
 * 0036 en dernière barrière, même si un formulaire était contourné.
 */
export default async function AdminUsersPage() {
  const ok = await isSuperAdmin();
  if (!ok) {
    const anySession = await getSessionInfo();
    if (!anySession) redirect("/admin/login");
    return <ForbiddenScreen />;
  }
  const session = await getSessionInfo();
  if (!session) redirect("/admin/login");

  const currentUserId = session.userId;
  const team = await getTeamEntries();

  const badge = (role: string, isSuper: boolean, active: boolean) => (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
          isSuper
            ? "bg-guinea-green/10 text-guinea-green"
            : "bg-guinea-red/10 text-guinea-red"
        }`}
      >
        {isSuper && <Shield className="h-3 w-3" />}
        {ROLE_LABELS[role] ?? role}
      </span>
      {!active && (
        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
          Suspendu
        </span>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold sm:text-3xl">
          Gestion des administrateurs
        </h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Vous êtes l’unique Super Administrateur : seul ce compte peut créer
          directement des gestionnaires, organiser, suspendre ou supprimer des
          comptes d’équipe — et aucun administrateur secondaire ne peut vous
          atteindre.
        </p>
      </header>

      <section className="rounded-2xl border border-guinea-green/40 bg-surface p-5 dark:border-guinea-green/30 dark:bg-night-800">
        <h2 className="flex items-center gap-2 font-display text-base font-bold">
          <ShieldCheck className="h-4 w-4 text-guinea-green" />
          Votre compte est sous protection maximale
        </h2>
        <ul className="mt-2 list-disc pl-5 text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">
          <li>Rôle, permissions et statut immuables — même via une base SQL ou un appel direct.</li>
          <li>Compte insupprimable et insuspendable par quiconque, y compris par sa propre session.</li>
          <li>Aucun second Super Administrateur ne peut être créé ; aucun admin ne peut créer d’admin.</li>
        </ul>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-surface p-6 dark:border-white/10 dark:bg-night-800">
        <h2 className="mb-1 flex items-center gap-2 font-display text-base font-bold">
          <Users className="h-4 w-4 text-guinea-red" />
          Ajouter un gestionnaire
        </h2>
        <p className="mb-4 text-xs text-neutral-500 dark:text-neutral-300">
          Création directe : le compte est utilisable immédiatement — aucune
          invitation par e-mail. Transmettez les identifiants par un moyen
          sûr ; ils ne s’affichent qu’une seule fois.
        </p>
        <AddManagerForm />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <Users className="h-4 w-4 text-guinea-red" />
          Équipe ({team.length})
        </h2>

        {team.length === 0 ? (
          <NotFoundScreen what="Aucun membre" />
        ) : (
          <ul className="flex flex-col gap-3">
            {team.map((p) => {
              const isSelf = p.id === currentUserId;
              const isSuper = p.role === "super_admin";
              const perms = effectivePermissions(p);
              const privileged = isFullyPrivileged(p.role);

              return (
                <li
                  key={p.id}
                  className={`flex flex-col gap-4 rounded-2xl border p-4 ${
                    isSuper
                      ? "border-guinea-green/40 bg-surface dark:border-guinea-green/30 dark:bg-night-800"
                      : p.is_active
                        ? "border-neutral-200 bg-surface dark:border-white/10 dark:bg-night-800"
                        : "border-amber-500/40 bg-surface dark:border-amber-500/30 dark:bg-night-800"
                  }`}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {badge(p.role, isSuper, p.is_active)}
                        {isSelf && (
                          <span className="rounded-full bg-guinea-green/10 px-2 py-0.5 text-[10px] font-bold text-guinea-green">
                            Vous (compte protégé)
                          </span>
                        )}
                        {p.invitation_pending && (
                          <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                            Invitation en attente
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 truncate font-display text-base font-bold">
                        {p.full_name ?? "Nom non renseigné"}
                      </p>
                      <p className="break-all text-xs text-neutral-500 dark:text-neutral-400">
                        {p.email ?? "E-mail Auth indisponible (service_role non configuré)"}
                        {p.last_sign_in_at ? ` · dernière connexion ${formatDate(p.last_sign_in_at)}` : ""}
                        {" · "}membre depuis le {formatDate(p.created_at)}
                      </p>
                    </div>

                    {!isSelf && !isSuper && (
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <RoleChangeForm profileId={p.id} currentRole={p.role} />
                        <ResetPasswordForm profileId={p.id} />
                        <SuspendForm userId={p.id} isActive={p.is_active} />
                        <DeleteUserForm userId={p.id} name={p.full_name ?? p.email ?? "ce compte"} />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 border-t border-neutral-200/60 pt-3 dark:border-white/5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                      {privileged
                        ? p.role === "super_admin"
                          ? "Accès TOTAL (rôle Super Administrateur — immuable)"
                          : "Accès TOTAL (rôle Administrateur)"
                        : p.role === "reporter"
                          ? "Ses propres brouillons d'articles — aucune autre permission"
                          : "Modules autorisés"}
                    </p>
                    {!privileged && p.role === "editor" && !isSelf && (
                      <PermissionsForm profileId={p.id} current={perms} />
                    )}
                    {!privileged && p.role === "editor" && isSelf && (
                      <p className="text-xs italic text-neutral-400">
                        Permissions non modifiables sur son propre compte
                        (protection « pas d’auto-modification » — règle 0036).
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="text-[11px] leading-relaxed text-neutral-400">
        Chaque action server reste vérifiée côté base (RLS + triggers 0036) :
        un Super Administrateur immuable, des changements de rôle limités à
        éditeur↔reporter, des permissions tracées avant/après dans le journal
        d’activité. La création des comptes se fait directement côté serveur
        (adresse de connexion technique générée par le serveur, mot de passe
        provisoire jamais journalisé — il n’est affiché qu’une seule fois).
        Les opérations Auth (création, suspension, suppression,
        réinitialisation) exigent la clé service_role sur le serveur — son
        absence est signalée honnêtement par les formulaires.
      </p>
    </div>
  );
}
