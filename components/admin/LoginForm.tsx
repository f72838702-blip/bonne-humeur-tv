"use client";

import { useActionState } from "react";
import { Play } from "lucide-react";
import { signIn } from "@/lib/actions/auth";
import { FieldError, FormMessage, SubmitButton, idleActionState, inputClass, labelClass } from "./form-ui";

/**
 * Connexion à l'espace rédaction. Le message d'échec est volontairement
 * générique (le serveur ne révèle pas si l'email existe).
 */
export default function LoginForm() {
  const [state, formAction] = useActionState(signIn, idleActionState);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <FormMessage state={state} />

      <div>
        <label htmlFor="email" className={labelClass}>
          Email ou identifiant de connexion
        </label>
        {/* type="text" (pas "email") : une saisie identifiant sans « @ » est
            transformée en adresse technique CÔTÉ SERVEUR — jamais dans le
            navigateur ; les emails réels passent inchangés. */}
        <input
          id="email"
          name="email"
          type="text"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="username"
          required
          placeholder="identifiant ou email reçus du Super Administrateur"
          className={inputClass}
        />
        <FieldError errors={state.fieldErrors} name="email" />
      </div>

      <div>
        <label htmlFor="password" className={labelClass}>
          Mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
          placeholder="8 caractères minimum"
          className={inputClass}
        />
        <FieldError errors={state.fieldErrors} name="password" />
      </div>

      <SubmitButton
        label="Se connecter"
        pendingLabel="Connexion…"
        className="w-full rounded-xl py-3"
      />

      <p className="flex items-center justify-center gap-2 text-[11px] text-neutral-400">
        <Play className="h-3 w-3 fill-guinea-red text-guinea-red" />
        Espace réservé à l’équipe de Bonne Humeur Média
      </p>
    </form>
  );
}