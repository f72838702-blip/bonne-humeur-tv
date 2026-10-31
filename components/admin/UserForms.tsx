"use client";

import { useActionState } from "react";
import type { UserRole } from "@/lib/types";
import { changeRole, inviteUser, setUserDisabled } from "@/lib/actions/admin";
import { FieldError, FormMessage, SubmitButton, idleActionState, inputClass, labelClass } from "./form-ui";

/**
 * Gestion de l'équipe (admin uniquement — revérifié par les actions
 * ET la RLS) : changement de rôle, invitation, désactivation.
 */

// ─────────────────────────────────────────────────────────────
// Changement de rôle
// ─────────────────────────────────────────────────────────────
export function RoleChangeForm({
  profileId,
  currentRole,
}: {
  profileId: string;
  currentRole: UserRole;
}) {
  const [state, formAction] = useActionState(changeRole, idleActionState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="profile_id" value={profileId} />
      <div className="flex flex-wrap items-center gap-2">
        <select name="role" defaultValue={currentRole} aria-label="Rôle" className={`${inputClass} w-36`}>
          <option value="reporter">Reporter</option>
          <option value="editor">Éditeur</option>
          <option value="admin">Administrateur</option>
        </select>
        <SubmitButton label="Appliquer" pendingLabel="…" variant="neutral" />
      </div>
      <FormMessage state={state} />
      <FieldError errors={state.fieldErrors} name="role" />
    </form>
  );
}

// ─────────────────────────────────────────────────────────────
// Invitation d'un membre
// ─────────────────────────────────────────────────────────────
export function InviteUserForm() {
  const [state, formAction] = useActionState(inviteUser, idleActionState);

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
          <select id="invite-role" name="role" defaultValue="reporter" className={inputClass}>
            <option value="reporter">Reporter</option>
            <option value="editor">Éditeur</option>
            <option value="admin">Administrateur</option>
          </select>
          <FieldError errors={state.fieldErrors} name="role" />
        </div>
      </div>
      <div className="flex justify-end">
        <SubmitButton label="Envoyer l'invitation" pendingLabel="Envoi…" />
      </div>
      <p className="text-[11px] leading-relaxed text-neutral-400">
        Un email d’invitation (Supabase Auth) est envoyé au membre ; il apparaît
        dans la liste après acceptation. Le rôle peut être ajusté ensuite.
      </p>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────
// Désactivation / réactivation (confirmation intégrée)
// L'état réel du compte (banni ou non) n'est pas lisible sans
// service_role : les deux actions sont proposées honnêtement.
// ─────────────────────────────────────────────────────────────
export function UserDisableForm({ userId }: { userId: string }) {
  const [state, formAction] = useActionState(setUserDisabled, idleActionState);

  return (
    <details className="relative inline-block text-left">
      <summary className="inline-flex cursor-pointer list-none items-center rounded-lg px-2 py-1 text-xs font-semibold text-guinea-red transition-colors hover:bg-guinea-red/10">
        Compte…
      </summary>
      <div className="absolute right-0 z-10 mt-2 w-72 rounded-xl border border-guinea-red/40 bg-white p-4 shadow-lg dark:bg-night-800">
        <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">
          Désactivation = le membre ne peut plus se connecter (ses contenus
          restent en place). Réactivation = accès restauré.
        </p>
        <div className="mt-3 flex flex-col gap-2">
          <form action={formAction}>
            <input type="hidden" name="user_id" value={userId} />
            <input type="hidden" name="disable" value="1" />
            <SubmitButton label="Désactiver le compte" pendingLabel="…" variant="danger" />
          </form>
          <form action={formAction}>
            <input type="hidden" name="user_id" value={userId} />
            <input type="hidden" name="disable" value="0" />
            <SubmitButton label="Réactiver le compte" pendingLabel="…" variant="neutral" />
          </form>
        </div>
        {state.status !== "idle" && <div className="mt-3"><FormMessage state={state} /></div>}
      </div>
    </details>
  );
}