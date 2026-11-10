import { redirect } from "next/navigation";
import { History } from "lucide-react";
import { getSessionInfo, isSuperAdmin } from "@/lib/auth/session";
import { getAuditLogs, type AuditEntry } from "@/lib/data/audit";
import {
  ForbiddenScreen,
  NotFoundScreen,
} from "@/components/admin/AccessDenied";
import { formatConakryDateTime } from "@/lib/flash/flash-core";
import { PERMISSION_LABELS } from "@/lib/auth/permissions";

export const metadata = { title: "Journal d'activité" };

/**
 * JOURNAL D'ACTIVITÉ — SUPER ADMINISTRATEUR UNIQUEMENT (mission 0036).
 * Toute création/modification/suspension de compte est tracée en base
 * (triggers audit_profile_delta / audit_profile_delete) et consultée
 * ICI. La RLS « audit_logs_select » (0036 : is_super_admin) est la
 * dernière barrière — cette page ne fait que refléter la règle.
 */

const ACTION_LABELS: Record<string, string> = {
  update: "Modification",
  insert: "Création",
  delete: "Suppression",
  permission_change: "Changement de permissions",
  role_change: "Changement de rôle",
  suspend: "Suspension",
  reactivate: "Réactivation",
};

/** Clé de permission → libellé du noyau 0036 (clé inconnue reste brute). */
function permissionLabel(key: unknown): string {
  if (typeof key === "string" && key in PERMISSION_LABELS) {
    return PERMISSION_LABELS[key as keyof typeof PERMISSION_LABELS];
  }
  return String(key);
}

function permissionsLine(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return "aucune";
  return value.map(permissionLabel).join(", ");
}

/** Delta d'un profil : rôle / permissions / statut, avant → après. */
function DetailsList({ details }: { details: Record<string, unknown> }) {
  const beforeRole = details.role_before;
  const afterRole = details.role_after;
  const beforePerms = details.permissions_before;
  const afterPerms = details.permissions_after;
  const beforeActive = details.is_active_before;
  const afterActive = details.is_active_after;

  return (
    <ul className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
      {beforeRole !== undefined && afterRole !== undefined && (
        <li>
          Rôle : {String(beforeRole)} → {String(afterRole)}
        </li>
      )}
      {(beforePerms !== undefined || afterPerms !== undefined) && (
        <li>
          Permissions : {permissionsLine(beforePerms)} → {permissionsLine(afterPerms)}
        </li>
      )}
      {(beforeActive !== undefined || afterActive !== undefined) && (
        <li>
          Statut du compte :{" "}
          {afterActive === false
            ? "SUSPENDU"
            : afterActive === true
              ? "actif"
              : String(afterActive)}
          {beforeActive === false && afterActive === true ? " (réactivé)" : ""}
        </li>
      )}
      {/* Autres champs éventuels (traces applicatives : invitation…) */}
      {Object.entries(details)
        .filter(
          ([key]) =>
            ![
              "role_before",
              "role_after",
              "permissions_before",
              "permissions_after",
              "is_active_before",
              "is_active_after",
            ].includes(key)
        )
        .slice(0, 4)
        .map(([key, value]) => (
          <li key={key}>
            {key} : {typeof value === "object" ? "(détail)" : String(value)}
          </li>
        ))}
    </ul>
  );
}

function EntryRow({ entry }: { entry: AuditEntry }) {
  const label = ACTION_LABELS[entry.action] ?? entry.action;
  return (
    <li className="rounded-xl border border-neutral-200 bg-surface p-4 dark:border-white/10 dark:bg-night-800">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-xs font-bold text-neutral-400">
          {formatConakryDateTime(entry.created_at)}
        </span>
        <span
          className={
            "rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide " +
            (entry.action === "delete"
              ? "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300"
              : entry.action === "insert"
                ? "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-300"
                : "bg-neutral-100 text-neutral-600 dark:bg-white/5 dark:text-neutral-300")
          }
        >
          {label}
        </span>
        <span className="text-sm font-semibold">{entry.entity}</span>
        {entry.actor_name && (
          <span className="text-xs text-neutral-400">par {entry.actor_name}</span>
        )}
      </div>
      {entry.details && Object.keys(entry.details).length > 0 && (
        <DetailsList details={entry.details} />
      )}
    </li>
  );
}

export default async function AdminJournalPage() {
  // Super Administrateur SEUL (mission 0036 : journal d'audit).
  const isSuper = await isSuperAdmin();
  if (!isSuper) {
    const session = await getSessionInfo();
    if (!session) redirect("/admin/login");
    return <ForbiddenScreen />;
  }

  const entries = await getAuditLogs();
  if (entries.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <header>
          <h1 className="font-display text-2xl font-extrabold sm:text-3xl">
            Journal d&apos;activité
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Toute action de gestion des comptes est tracée ici.
          </p>
        </header>
        <NotFoundScreen what="Aucune trace enregistrée — les actions de gestion des comptes s'y cumuleront." />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold sm:text-3xl">
          <History className="h-6 w-6 text-guinea-red" />
          Journal d&apos;activité
        </h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Toute action de gestion des comptes est tracée en base et
          consignée ici ({entries.length} dernière{entries.length > 1 ? "s" : ""}{" "}
          trace{entries.length > 1 ? "s" : ""}).
        </p>
      </header>
      <ol className="flex flex-col gap-3">
        {entries.map((entry) => (
          <EntryRow key={entry.id} entry={entry} />
        ))}
      </ol>
    </div>
  );
}
