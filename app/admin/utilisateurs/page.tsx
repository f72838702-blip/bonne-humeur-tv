import { redirect } from "next/navigation";
import { UserPlus, Users } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { getProfiles } from "@/lib/data/users";
import { formatDate } from "@/lib/utils";
import { InviteUserForm, RoleChangeForm, UserDisableForm } from "@/components/admin/UserForms";
import { ForbiddenScreen, NotFoundScreen, UnconfiguredScreen } from "@/components/admin/AccessDenied";

export const metadata = { title: "Utilisateurs" };

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrateur",
  editor: "Éditeur",
  reporter: "Reporter",
};

export default async function AdminUsersPage() {
  const guard = await requireRole(["admin"]);
  if ("denied" in guard) {
    if (guard.denied === "unauthenticated") redirect("/admin/login");
    if (guard.denied === "unconfigured") return <UnconfiguredScreen />;
    return <ForbiddenScreen />;
  }

  const currentUserId = guard.session.userId;
  const profiles = await getProfiles();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Utilisateurs</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Équipe de la rédaction : rôles, invitations et comptes.
        </p>
      </header>

      <section className="rounded-2xl border border-neutral-200 bg-surface p-6 dark:border-white/10 dark:bg-night-800">
        <h2 className="mb-4 flex items-center gap-2 font-display text-base font-bold">
          <UserPlus className="h-4 w-4 text-guinea-red" />
          Inviter un membre
        </h2>
        <InviteUserForm />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <Users className="h-4 w-4 text-guinea-red" />
          Membres ({profiles.length})
        </h2>

        {profiles.length === 0 ? (
          <NotFoundScreen what="Aucun membre" />
        ) : (
          <ul className="flex flex-col gap-3">
            {profiles.map((p) => {
              const isSelf = p.id === currentUserId;
              return (
                <li
                  key={p.id}
                  className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-surface p-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10 dark:bg-night-800"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-guinea-red/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-guinea-red">
                        {ROLE_LABELS[p.role] ?? p.role}
                      </span>
                      {isSelf && (
                        <span className="rounded-full bg-guinea-green/10 px-2 py-0.5 text-[10px] font-bold text-guinea-green">
                          Vous
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 truncate font-display text-base font-bold">
                      {p.full_name ?? "Nom non renseigné"}
                    </p>
                    <p className="text-xs text-neutral-400">
                      Membre depuis le {formatDate(p.created_at)}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    {isSelf ? (
                      <span className="text-[11px] italic text-neutral-400">
                        Rôle modifiable depuis un autre compte admin
                      </span>
                    ) : (
                      <>
                        <RoleChangeForm profileId={p.id} currentRole={p.role} />
                        <UserDisableForm userId={p.id} />
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="text-[11px] leading-relaxed text-neutral-400">
        L’état d’un compte (activé/désactivé) et les adresses email relèvent de
        Supabase Auth : les invitations et désactivations exigent la clé
        service_role sur le serveur — toute absence est signalée honnêtement par
        le formulaire.
      </p>
    </div>
  );
}