"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";

/**
 * Actualisation fluide et légère : `router.refresh()` rejoue UNIQUEMENT
 * les composants serveur de la page (aucun rechargement complet du
 * site, aucune requête inutile, aucun polling — Quotas Free respectés).
 */
export default function RefreshButton({ label = "Actualiser" }: { label?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [spin, setSpin] = useState(false);

  function refresh() {
    setSpin(true);
    startTransition(() => router.refresh());
    setTimeout(() => setSpin(false), 600);
  }

  return (
    <button
      type="button"
      onClick={refresh}
      disabled={isPending}
      className="inline-flex items-center gap-2 rounded-full border border-neutral-200 px-4 py-2 text-xs font-semibold text-neutral-600 transition-colors hover:border-guinea-red/50 hover:text-guinea-red disabled:opacity-60 dark:border-white/10 dark:text-neutral-300"
    >
      <RotateCw className={`h-3.5 w-3.5 ${spin ? "animate-spin" : ""}`} />
      {isPending ? "Actualisation…" : label}
    </button>
  );
}