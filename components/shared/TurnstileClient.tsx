"use client";

import Script from "next/script";
import { useActionState } from "react";
import { TURNSTILE_SITE_KEY, isTurnstileConfigured } from "@/lib/supabase/public-config";
import type { ActionState } from "@/lib/actions/helpers";

/**
 * Widget Cloudflare Turnstile — rendu UNIQUEMENT si la clé publique
 * est configurée. Sinon : rien (le serveur documente la protection
 * comme inactive ; honeypot + rate limiting restent actifs).
 * Le rechargement après une erreur de soumission est automatique
 * grâce à la surveillance de l'état du formulaire.
 */
export default function TurnstileClient({
  actionState,
}: {
  /** État courant du formulaire : en cas d'échec, le widget se recharge. */
  actionState: ActionState;
}) {
  const siteKey = TURNSTILE_SITE_KEY;
  if (!isTurnstileConfigured()) return null;

  // Clé de rechargement : à chaque erreur, un nouveau jeton est demandé
  // (l'ancien a été consommé par la vérification serveur).
  const reloadKey = `${actionState.status}-${actionState.message}`;

  return (
    <div className="flex justify-center">
      <Script
        key={reloadKey}
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="lazyOnload"
      />
      <div
        className="cf-turnstile"
        data-sitekey={siteKey}
        data-theme="auto"
        data-language="fr"
      />
    </div>
  );
}