"use client";

import { useActionState, useState } from "react";
import type { ActionState } from "@/lib/actions/helpers";
import {
  PERMISSION_LABELS,
  PERMISSION_KEYS,
  type PermissionKey,
} from "@/lib/auth/permissions";
import { changeRole, inviteUser, setUserSuspended, updatePermissions, deleteTeamMemberAction } from "@/lib/actions/admin";
import { FieldError, FormMessage, SubmitButton, idleActionState, inputClass, labelClass } from "./form-ui";
import DeleteActionForm from "./DeleteActionForm";

/**
 * Gestion des ADMINISTRATEURS — Super Administrateur uniquement (mission
 * 0036) : invitations (rôle + permissions), changement de rôle (éditeur /
 * reporter SEULEMENT — cf. assignableRole et règle SQL 0036), permissions
 * granulaires par module, suspension réelle et suppression définitive.
 * Toute action est revérifiée par l'action serveur ET par la base (RLS +
 * triggers 0036) : masquer un formulaire ici n'est jamais la protection.
 */

// ─────────────────────────────────────────────────────────────
// Cases à cocher de permissions (liste fermée — toujours normalisée serveur)
// ─────────────────────────────────────────────────────────────
function PermissionCheckboxes({
  current,
}: {
  /** Clés actuelles (fiche) ou clés invitées (invitation). */ current: string[];
}) {
  return (
    <fieldset className="grid gap-2 sm:grid-cols-2">
      <legend className="sr-only">Permissions du module (éditeur)</legend>
      {PERMISSION_KEYS.map((key: PermissionKey) => (
        <label
          key={key}
          className="flex cursor-pointer flex-col gap-0.5 rounded-lg border border-neutral-200 px-3 py-2 text-xs transition-colors hover:border-guinea-green/60 dark:border-white/10 dark:hover:border-guinea-green/40"
        >
          <span className="flex items-start gap-2 font-semibold">
            <input
              type="checkbox"
              name="permissions"
              value={key}
              defaultChecked={current.includes(key)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-guinea-green"
            />
            {PERMISSION_LABELS[key]}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

// ─────────────────────────────────────────────────────────────
// Invitation d'un membre (rôle secondaire ONLY : éditeur | reporter)
// ─────────────────────────────────────────────────────────────
export function InviteUserForm() {
  const [state, formAction] = useActionState(inviteUser, idleActionState);
  const [role, setRole] = useState("reporter");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="invite-email" className={labelClass}>
            Email *
          </label>
          <input
            id="invite-email"
            name="email"
            type="email"
            required
            autoComplete="off"
            placeholder="nouveau.membre@email.com"
            className={inputClass}
          />
          <FieldError errors={state.fieldErrors} name="email" />
        </div>
        <div>
          <label htmlFor="invite-name" className={labelClass}>
            Nom complet *
          </label>
          <input
            id="invite-name"
            name="full_name"
            type="text"
            required
            minLength={2}
            maxLength={100}
            placeholder="Prénom Nom"
            className={inputClass}
          />
          <FieldError errors={state.fieldErrors} name="full_name" />
        </div>
        <div>
          <label htmlFor="invite-role" className={labelClass}>
            Rôle *
          </label>
          <select
            id="invite-role"
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className={inputClass}
          >
            <option value="reporter">Reporter</option>
            <option value="editor">Éditeur</option>
            {/* Aucun « administrateur » : seule la promotion du PDG crée des
                admins, et un seul Super Administrateur existe, immuable. */}
          </select>
          <FieldError errors={state.fieldErrors} name="role" />
        </div>
      </div>
      {role === "editor" && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
            Modules accessibles de l’éditeur (cocher au moins un — sans case cochée,
            l’éditeur ne peut RIEN faire) :
          </p>
          <PermissionCheckboxes current={[]} />
        </div>
      )}
      <div className="flex justify-end">
        <SubmitButton label="Envoyer l'invitation" pendingLabel="Envoi…" />
      </div>
      <p className="text-[11px] leading-relaxed text-neutral-400">
        Un email d’invitation sécurisé (Supabase Auth) est envoyé au membre ; le
        rôle et les permissions s’appliquent immédiatement et sont tracés dans le
        journal d’activité. Aucun mot de passe n’est saisi dans l’application.
      </p>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────
// Changement de rôle — éditeur | reporter uniquement
// ─────────────────────────────────────────────────────────────
export function RoleChangeForm({
  profileId,
  currentRole,
}: {
  profileId: string;
  currentRole: string;
}) {
  const [state, formAction] = useActionState(changeRole, idleActionState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="profile_id" value={profileId} />
      <div className="flex flex-wrap items-center gap-2">
        <select name="role" defaultValue={["editor", "reporter"].includes(currentRole) ? currentRole : "editor"} aria-label="Rôle" className={`${inputClass} w-40`}>
          <option value="editor">Éditeur</option>
          <option value="reporter">Reporter</option>
          {/* administrateur : jamais proposé — règle 0036 « Seul le Super
              Administrateur crée un admin » et la promotion du PDG se fait
              hors application (migrations SQL). */}
        </select>
        <SubmitButton label="Appliquer le rôle" pendingLabel="…" variant="neutral" />
      </div>
      <FormMessage state={state} />
      <FieldError errors={state.fieldErrors} name="role" />
    </form>
  );
}

// ─────────────────────────────────────────────────────────────
// Modification des PERMISSIONS d'un éditeur
// ─────────────────────────────────────────────────────────────
export function PermissionsForm({
  profileId,
  current,
}: {
  profileId: string;
  current: string[];
}) {
  const [state, formAction] = useActionState(updatePermissions, idleActionState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="profile_id" value={profileId} />
      <PermissionCheckboxes current={current} />
      <div className="flex items-center justify-between gap-2">
        <FormMessage state={state} />
        <SubmitButton label="Enregistrer les permissions" pendingLabel="…" variant="neutral" />
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────
// Suspension / réactivation — ban Auth + perte RLS immédiate
// ─────────────────────────────────────────────────────────────
export function SuspendForm({
  userId,
  isActive,
}: {
  userId: string;
  isActive: boolean;
}) {
  return (
    <DeleteActionForm
      action={async (fd) => setUserSuspended(idleActionState, fd)}
      hiddenFields={{ user_id: userId, suspend: isActive ? "1" : "0" }}
      tone={isActive ? "red" : "green"}
      buttonLabel={isActive ? "Suspendre" : "Réactiver"}
      pendingLabel="…"
      confirmLabel={
        isActive
          ? "Le compte sera banni (plus aucune connexion possible) ET perdra tous ses accès à la base immédiatement — même avec un jeton encore valide. Confirmer ?"
          : "Le compte retrouvera l'accès à la base et la possibilité de se connecter. Confirmer la réactivation ?"
      }
    />
  );
}

// ─────────────────────────────────────────────────────────────
// Suppression DÉFINITIVE (Auth + profil — irréversible)
// ─────────────────────────────────────────────────────────────
export function DeleteUserForm({
  userId,
  name,
}: {
  userId: string;
  name: string;
}) {
  return (
    <DeleteActionForm
      action={async (fd) => deleteTeamMemberAction(idleActionState, fd)}
      hiddenFields={{ user_id: userId }}
      tone="red"
      buttonLabel="Supprimer"
      pendingLabel="Suppression…"
      confirmLabel={`Suppression DÉFINITIVE du compte de ${name} (email + profil) — IRRÉVERSIBLE : aucune restauration possible. Le journal d'activité conservera la trace de l'opération. Confirmer ?`}
    />
  );
}
