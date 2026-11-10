"use client";

import { useActionState, useEffect, useState } from "react";
import type { ActionState } from "@/lib/actions/helpers";
import {
  PERMISSION_KEYS,
  type PermissionKey,
} from "@/lib/auth/permissions";
import {
  createManager,
  changeRole,
  setUserSuspended,
  updatePermissions,
  deleteTeamMemberAction,
  resetManagerPasswordAction,
} from "@/lib/actions/admin";
import { FieldError, FormMessage, SubmitButton, idleActionState, inputClass, labelClass } from "./form-ui";
import DeleteActionForm from "./DeleteActionForm";
import CopyableInput from "./CopyableInput";

/**
 * Gestion des ADMINISTRATEURS — Super Administrateur uniquement.
 * CRÉATION DIRECTE (mission) : le Super saisit identifiant + mot de passe
 * provisoire + les tâches autorisées, le compte est IMMEDIATEMENT utilisable
 * (aucune invitation, aucun e-mail d'activation). La transformation
 * identifiant → adresse technique ainsi que l'appel Auth se font côté
 * serveur ; le mot de passe provisoire ne quitte jamais le serveur (jamais
 * stocké ailleurs, jamais journalisé, réaffiché une seule fois ici).
 */

// ─────────────────────────────────────────────────────────────
// Tâches autorisées : les 9 clés réelles de la migration 0036
// (groupées par domaine de travail, libellés plain-language).
// ─────────────────────────────────────────────────────────────
const TASK_GROUPS: { titre: string; items: { key: PermissionKey; label: string }[] }[] = [
  {
    titre: "Articles",
    items: [
      { key: "articles", label: "Consulter, créer et modifier ses articles" },
      { key: "articles_publier", label: "Publier et dépublier les articles" },
      { key: "articles_tous", label: "Modifier les articles des autres" },
    ],
  },
  {
    titre: "Vidéos et directs",
    items: [
      { key: "videos", label: "Gérer les vidéos" },
      { key: "directs", label: "Gérer l'affichage des directs sur le site" },
    ],
  },
  {
    titre: "Flash Infos",
    items: [{ key: "flash", label: "Créer et gérer les Flash Infos" }],
  },
  {
    titre: "Publicités",
    items: [
      { key: "publicite", label: "Créer et gérer les publicités" },
      { key: "publicite_approuver", label: "Approuver publicités et opérations autorisées" },
    ],
  },
  {
    titre: "Consultation",
    items: [{ key: "consultation", label: "Consulter statistiques et informations" }],
  },
];

function TaskCheckboxes({ current }: { current: string[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {TASK_GROUPS.map((g) => (
        <fieldset key={g.titre} className="rounded-xl border border-neutral-200 p-3 dark:border-white/10">
          <legend className="px-1 text-[11px] font-bold uppercase tracking-wide text-neutral-400">
            {g.titre}
          </legend>
          <div className="flex flex-col gap-1.5">
            {g.items.map((it) => (
              <label
                key={it.key}
                className="flex cursor-pointer items-start gap-2 text-xs font-medium transition-colors hover:text-guinea-green"
              >
                <input
                  type="checkbox"
                  name="permissions"
                  value={it.key}
                  defaultChecked={current.includes(it.key)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-guinea-green"
                />
                {it.label}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

/**
 * Encart « une seule fois » : identifiants de connexion à transmettre
 * (champs copiables). Le mot de passe peut contenir des espaces → capture
 * paresseuse jusqu'au tiret cadratin, jamais un simple \S+.
 */
export function CredentialsOnce({ message }: { message: string }) {
  const email = message.match(/Connexion\s*:\s*(\S+@[^\s—]+)\s/)?.[1];
  const password = message.match(/provisoire\s*:\s*(.+?)\s+—/)?.[1];
  if (!email || !password) return null;
  return (
    <div className="rounded-2xl border border-guinea-green/40 bg-guinea-green/5 p-4">
      <p className="font-display text-sm font-bold text-guinea-green">
        Gestionnaire créé avec succès.
      </p>
      <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-300">
        À transmettre par un moyen sûr. Ces informations ne seront plus jamais
        affichées ; pour un mot de passe perdu, utilisez « Réinitialiser le
        mot de passe » sur le compte.
      </p>
      <div className="mt-3 grid gap-2">
        <CopyableInput value={email} label="Adresse de connexion (technique ou réelle)" />
        <CopyableInput value={password} label="Mot de passe provisoire" />
      </div>
    </div>
  );
}

/** Extrait le mot de passe provisoire du message de succès (une seule fois). */
function extractProvisionalPassword(message: string): string | null {
  return message.match(/provisoire\s*:\s*(.+?)\s+—/)?.[1] ?? null;
}

// ─────────────────────────────────────────────────────────────
// Ajouter un gestionnaire (création directe)
// ─────────────────────────────────────────────────────────────
export function AddManagerForm() {
  const [state, formAction] = useActionState(createManager, idleActionState);
  // Remise à zéro du formulaire uniquement après un succès (règle React 19 :
  // ne jamais vider la saisie sur un refus serveur).
  const [resetKey, setResetKey] = useState(0);
  useEffect(() => {
    if (state.status === "success") setResetKey((k) => k + 1);
  }, [state.status, state.message]);

  return (
    <div className="flex flex-col gap-4">
      {/* Succès : l'encart « une seule fois » REMPLACE le message brut
          (mot de passe + copie, jamais deux affichages concurrents). */}
      {state.status === "success" && state.message ? (
        <CredentialsOnce message={state.message} />
      ) : (
        <FormMessage state={state} />
      )}
      <form action={formAction} className="flex flex-col gap-4" key={resetKey}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="mg-fullname" className={labelClass}>
              Nom et prénom *
            </label>
            <input
              id="mg-fullname"
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
            <label htmlFor="mg-identifiant" className={labelClass}>
              Identifiant de connexion *
            </label>
            <input
              id="mg-identifiant"
              name="identifiant"
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              minLength={2}
              maxLength={32}
              placeholder="ex. fatou.balde"
              className={inputClass}
            />
            <p className="mt-1 text-[11px] text-neutral-400">
              2–32 caractères : lettres non accentuées, chiffres, « . » « - »
              « _ ». La transformation en adresse de connexion sécurisée se
              fait côté serveur.
            </p>
            <FieldError errors={state.fieldErrors} name="identifiant" />
          </div>
        </div>
        <div>
          <label htmlFor="mg-email" className={labelClass}>
            Adresse email du gestionnaire — facultative
          </label>
          <input
            id="mg-email"
            name="email"
            type="email"
            autoCapitalize="none"
            placeholder="seulement si la personne possède un email réel à utiliser"
            className={inputClass}
          />
          <p className="mt-1 text-[11px] text-neutral-400">
            Si renseignée, cette adresse devient l’adresse de connexion ; sinon
            l’identifiant ci-dessus en génère une côté serveur. Dans les deux
            cas, aucun e-mail n’est envoyé.
          </p>
          <FieldError errors={state.fieldErrors} name="email" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="mg-pass" className={labelClass}>
              Mot de passe provisoire *
            </label>
            <input
              id="mg-pass"
              name="password"
              type="text"
              required
              minLength={10}
              maxLength={128}
              placeholder="10 caractères minimum — à transmettre ensuite"
              className={inputClass}
            />
            <FieldError errors={state.fieldErrors} name="password" />
          </div>
          <div>
            <label htmlFor="mg-pass2" className={labelClass}>
              Confirmer le mot de passe *
            </label>
            <input
              id="mg-pass2"
              name="password_confirm"
              type="text"
              required
              minLength={10}
              maxLength={128}
              placeholder="répétez le mot de passe provisoire"
              className={inputClass}
            />
            <FieldError errors={state.fieldErrors} name="password_confirm" />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
            Tâches autorisées (cocher uniquement ce dont la personne a besoin —
            sans case cochée, le compte n’est qu’un « reporter » limité à ses
            brouillons) :
          </p>
          <TaskCheckboxes current={[]} />
        </div>
        <div className="flex justify-end">
          <SubmitButton label="Créer le compte" pendingLabel="Création…" />
        </div>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Réinitialisation du mot de passe perdu (généré serveur, une seule fois)
// ─────────────────────────────────────────────────────────────
export function ResetPasswordForm({ profileId }: { profileId: string }) {
  const [state, formAction] = useActionState(resetManagerPasswordAction, idleActionState);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="profile_id" value={profileId} />
      <SubmitButton label="Réinitialiser le mot de passe" pendingLabel="…" variant="neutral" />
      <FormMessage state={state} />
      {state.status === "success" && extractProvisionalPassword(state.message ?? "") !== null && (
        <div className="rounded-xl border border-guinea-green/40 bg-guinea-green/5 p-3">
          <p className="text-[11px] text-neutral-500 dark:text-neutral-300">
            À transmettre par un moyen sûr — plus jamais affiché :
          </p>
          <div className="mt-2">
            <CopyableInput
              value={extractProvisionalPassword(state.message ?? "") as string}
              label="Nouveau mot de passe provisoire généré"
            />
          </div>
        </div>
      )}
    </form>
  );
}

// ─────────────────────────────────────────────────────────────
// Cases de permissions (fiche du compte) — mêmes 9 clés
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
      <TaskCheckboxes current={current} />
      <div className="flex items-center justify-between gap-2">
        <FormMessage state={state} />
        <SubmitButton label="Enregistrer les permissions" pendingLabel="…" variant="neutral" />
      </div>
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
