"use client";

/**
 * VUE SIMPLIFIÉE DU STUDIO — le parcours 3 étapes demandé :
 *  1. Choisir un design (grandes cartes avec vraie miniature)
 *  2. Voir le résultat (aperçu réel, 3 formats, mise à jour instantanée)
 *  3. Publier (gros bouton + confirmation + carte de réussite + lien
 *     « Voir mon site »)
 * Réutilise le MOTEUR existant : actions serveur (brouillon / publication),
 * historique, aperçu StudioPreviewFrame. Rien n'est publié ici : seule
 * l'action serveur validée (admin seul) touche le site public.
 */
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { DesignConfig } from "@/lib/design/schema";
import { SimpleThemeCards } from "./panels/SimpleCards";
import { SimpleControls } from "./SimpleControls";
import { SimpleAccueil } from "./panels/SimpleAccueil";
import { StudioPreviewFrame } from "./StudioPreviewFrame";

function StepBadge({ n, text }: { n: 1 | 2 | 3; text: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3.5 py-2 text-sm font-extrabold text-neutral-700 dark:bg-white/5 dark:text-neutral-200">
      <span
        aria-hidden
        className="flex h-6 w-6 items-center justify-center rounded-full bg-guinea-red text-xs font-extrabold text-white"
      >
        {n}
      </span>
      {text}
    </span>
  );
}

function SectionTitle({ text }: { text: string }) {
  return (
    <h2 className="text-sm font-extrabold uppercase tracking-wider text-neutral-500 dark:text-neutral-300">
      {text}
    </h2>
  );
}

export function StudioSimple({
  config,
  update,
  publishedConfig,
  canPublish,
  pending,
  preview,
  publish,
  revert,
  onOpenAdvanced,
  reloadKey,
  unpub,
  message,
  publishedFlash,
}: {
  config: DesignConfig;
  update: (fn: (c: DesignConfig) => DesignConfig) => void;
  publishedConfig: DesignConfig | null;
  canPublish: boolean;
  pending: boolean;
  preview: () => void;
  publish: () => void;
  revert: () => void;
  onOpenAdvanced: () => void;
  reloadKey: number;
  unpub: boolean;
  message: { kind: "ok" | "err"; text: string } | null;
  publishedFlash: boolean;
}) {
  return (
    <div className="space-y-8">
      {/* Étapes — repères visuels du parcours */}
      <div className="flex flex-wrap gap-2" role="list">
        <StepBadge n={1} text="Choisir un design" />
        <StepBadge n={2} text="Regarder le résultat" />
        <StepBadge n={3} text="Publier" />
      </div>

      {/* Carte de réussite après publication */}
      {publishedFlash && (
        <div className="rounded-2xl border border-guinea-green/40 bg-guinea-green/10 p-5">
          <p className="text-lg font-extrabold text-neutral-900 dark:text-neutral-50">
            🎉 Votre design est en ligne !
          </p>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-200">
            Le site public a été mis à jour et l’ancien design est archivé dans
            l’historique.
          </p>
          <Link
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-guinea-green px-5 py-2.5 text-sm font-extrabold text-white hover:bg-guinea-green/90"
          >
            Voir mon site ↗
          </Link>
        </div>
      )}

      {/* Message d'information (prévisualisation / erreur) */}
      {message && (
        <p
          role="status"
          className={cn(
            "rounded-xl px-4 py-2.5 text-sm font-semibold",
            message.kind === "ok"
              ? "bg-guinea-green/10 text-guinea-green"
              : "bg-guinea-red/10 text-guinea-red",
          )}
        >
          {message.text}
        </p>
      )}

      {/* Rappel non-publication — phrase simple */}
      {unpub && !publishedFlash && (
        <p className="rounded-xl border border-guinea-yellow/60 bg-guinea-yellow/10 px-4 py-3 text-sm text-neutral-700 dark:text-neutral-100">
          Vos changements ne sont <strong>pas encore visibles</strong> par les
          visiteurs. Quand vous êtes satisfait, cliquez sur «{" "}
          <strong>Publier mon design</strong> ».
        </p>
      )}

      {/* ─── ÉTAPE 1 — CHOISIR ─── */}
      <section className="space-y-3">
        <SectionTitle text="1 · Choisir un design" />
        <SimpleThemeCards config={config} apply={(c) => update(() => c)} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        {/* ─── Personnalisations + Accueil (facultatifs) ─── */}
        <div className="min-w-0 space-y-5">
          <section className="space-y-3">
            <SectionTitle text="Personnaliser (facultatif)" />
            <SimpleControls config={config} update={update} />
          </section>

          <section className="space-y-3">
            <SectionTitle text="Organiser la page d’accueil" />
            <SimpleAccueil config={config} update={update} />
          </section>

          {/* Zone avancée : l'interface complète EXISTANTE (aucune
              fonctionnalité retirée — brief §5 et §8). */}
          <button
            type="button"
            onClick={onOpenAdvanced}
            className="w-full rounded-2xl border border-dashed border-neutral-300 px-4 py-4 text-left transition-colors hover:border-guinea-red/50 dark:border-white/20"
          >
            <span className="text-sm font-extrabold text-neutral-600 dark:text-neutral-100">
              ⚙ Personnalisation avancée
            </span>
            <span className="mt-0.5 block text-xs text-neutral-500 dark:text-neutral-400">
              Tout le contrôle fin — typographies détaillées, en-tête, pied de
              page, titres des sections, historique.
            </span>
          </button>
        </div>

        {/* ─── ÉTAPE 2 — VOIR ─── */}
        <section className="min-w-0 space-y-3">
          <SectionTitle text="2 · Voir le résultat" />
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Faites défiler l’aperçu pour voir la vraie page d’accueil, avec
            vos contenus réels.
          </p>
          <button
            type="button"
            onClick={preview}
            disabled={pending}
            className="rounded-xl border border-neutral-900 bg-neutral-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-neutral-700 disabled:opacity-40 dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
          >
            {pending ? "…" : "Mettre à jour l’aperçu"}
          </button>
          <StudioPreviewFrame config={config} reloadKey={reloadKey} />
        </section>
      </div>

      {/* ─── ÉTAPE 3 — PUBLIER (barre toujours accessible) ─── */}
      <div
        className="sticky bottom-2 z-30 flex flex-col gap-2.5 rounded-2xl border border-neutral-200 bg-white/95 p-3.5 shadow-lg backdrop-blur dark:border-white/10 dark:bg-night-800/95 sm:flex-row sm:items-center"
      >
        <button
          type="button"
          onClick={revert}
          disabled={!publishedConfig || pending}
          title="Revenir au dernier design publié"
          className="rounded-xl border border-neutral-300 px-5 py-3 text-sm font-bold text-neutral-600 hover:border-neutral-500 disabled:opacity-40 dark:border-white/20 dark:text-neutral-200"
        >
          ↺ Annuler mes changements
        </button>
        <span className="grow" />
        <button
          type="button"
          onClick={publish}
          disabled={!canPublish || pending}
          title={canPublish ? undefined : "Réservé aux administrateurs"}
          className={cn(
            "rounded-xl bg-guinea-red px-8 py-3.5 text-base font-extrabold text-white shadow-md hover:bg-guinea-red/90 disabled:opacity-40",
            "w-full sm:w-auto",
          )}
        >
          Publier mon design
        </button>
        {!canPublish && (
          <p className="text-xs text-neutral-400 sm:max-w-[220px]">
            Vous pouvez choisir et essayer — la publication est réservée aux
            administrateurs.
          </p>
        )}
      </div>
    </div>
  );
}
