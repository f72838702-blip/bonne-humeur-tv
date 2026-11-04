"use client";

import { useActionState, useEffect, useState } from "react";
import { Reply } from "lucide-react";
import { sendReplyAction } from "@/lib/actions/admin";
import type { ActionState } from "@/lib/actions/helpers";
import { FormMessage, SubmitButton, idleActionState } from "./form-ui";

/**
 * Zone de rédaction d'une réponse, DANS le panneau (<details>, aucune
 * nouvelle page). Le destinataire est affiché en lecture seule — il
 * provient de la demande enregistrée et n'est PAS un champ modifiable.
 * La zone de texte est CONTRÔLÉE (React 19 : les <form action> réinitialisent
 * les champs non contrôlés) : en cas d'erreur, le texte rédigé est
 * conservé et le message s'affiche ; seul un succès réel efface la zone.
 */
export default function ReplyForm({
  type,
  requestId,
  recipientEmail,
  senderName,
}: {
  type: "partnership" | "contact";
  requestId: string;
  recipientEmail: string;
  senderName: string;
}) {
  const [state, formAction] = useActionState(sendReplyAction, idleActionState);
  const [body, setBody] = useState("");

  // Effacement UNIQUEMENT après un envoi réellement confirmé.
  useEffect(() => {
    if (state.status === "success") setBody("");
  }, [state]);

  return (
    <details className="group/reply">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-guinea-green transition-colors hover:bg-guinea-green/10">
        <Reply className="h-3.5 w-3.5" />
        Répondre
      </summary>
      <form action={formAction} className="mt-3 flex flex-col gap-3">
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="id" value={requestId} />

        <div className="rounded-xl bg-neutral-100 px-3 py-2 dark:bg-white/5">
          <p className="text-[11px] uppercase tracking-wide font-bold text-neutral-500 dark:text-neutral-400">
            Destinataire (non modifiable)
          </p>
          <p className="text-sm font-semibold">
            {recipientEmail}
            <span className="ml-2 font-normal text-neutral-500 dark:text-neutral-400">
              — {senderName}
            </span>
          </p>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold">Votre réponse</span>
          <textarea
            name="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            required
            minLength={2}
            maxLength={10000}
            placeholder="Rédigez la réponse du staff Bonne Humeur TV…"
            className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-guinea-red/60 dark:border-white/10 dark:bg-night-900"
          />
          <span className="text-[11px] text-neutral-400">{body.length}/10 000 caractères</span>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton label="Envoyer la réponse" pendingLabel="Envoi…" variant="success" />
          {state.status !== "idle" && <FormMessage state={state} />}
        </div>
      </form>
    </details>
  );
}