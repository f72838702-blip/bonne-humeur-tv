"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { DesignConfig } from "@/lib/design/schema";
import { DEFAULT_DESIGN } from "@/lib/design/default";
import {
  saveDraftAction,
  publishDesignAction,
  restoreDesignAction,
} from "@/lib/design/actions";
import { IdentityPanel } from "./panels/IdentityPanel";
import { ComposantsPanel } from "./panels/ComposantsPanel";
import { EnTetePanel } from "./panels/EnTetePanel";
import { AccueilPanel } from "./panels/AccueilPanel";
import { FooterPanel } from "./panels/FooterPanel";
import { ThemesPanel } from "./panels/ThemesPanel";
import { HistoriquePanel, type HistoryEntry } from "./panels/HistoriquePanel";
import { StudioPreviewFrame } from "./StudioPreviewFrame";

const TABS = [
  { id: "themes", label: "Thèmes" },
  { id: "identite", label: "Identité & Typographie" },
  { id: "composants", label: "Composants" },
  { id: "en-tete", label: "En-tête" },
  { id: "accueil", label: "Page d'accueil" },
  { id: "footer", label: "Pied de page" },
  { id: "historique", label: "Historique" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/**
 * ÉDITEUR DU STUDIO — état local + piles Annuler/Rétablir (chaque
 * modification pousse dans « Annuler »). Aucun réglage ne touche le
 * site public : « Publier les modifications » passe par l'action
 * serveur VALIDÉE (admin seul) — revérification côté serveur.
 */
export default function StudioEditor({
  initial,
  publishedConfig,
  draftUpdatedAt,
  canPublish,
  history,
  categories,
}: {
  initial: DesignConfig;
  publishedConfig: DesignConfig | null;
  draftUpdatedAt: string | null;
  canPublish: boolean;
  history: HistoryEntry[];
  categories: { slug: string; name: string }[];
}) {
  const router = useRouter();
  const [config, setConfig] = useState<DesignConfig>(() => initial);
  const [past, setPast] = useState<DesignConfig[]>([]);
  const [future, setFuture] = useState<DesignConfig[]>([]);
  const [tab, setTab] = useState<TabId>("themes");
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [pending, startTransition] = useTransition();

  /** Modifie la config : entrée dans « past », « future » vidé. */
  const update = useCallback((fn: (c: DesignConfig) => DesignConfig) => {
    setConfig((current) => {
      const next = fn(current);
      if (JSON.stringify(next) === JSON.stringify(current)) return current;
      setPast((p) => [...p.slice(-49), current]);
      setFuture([]);
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p;
      const previous = p[p.length - 1];
      setConfig((current) => {
        setFuture((f) => [current, ...f].slice(0, 50));
        return previous;
      });
      return p.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];
      setConfig((current) => {
        setPast((p) => [...p, current]);
        return next;
      });
      return f.slice(1);
    });
  }, []);

  const unpub = useMemo(
    () =>
      JSON.stringify(config) !==
      JSON.stringify(publishedConfig ?? DEFAULT_DESIGN),
    [config, publishedConfig],
  );

  /* ─── Actions (Server Actions revérifiées côté serveur) ───────────── */
  const publish = () => {
    if (!canPublish) return;
    if (!window.confirm("Publier ce design sur le site public ? L'ancien design sera archivé.")) return;
    startTransition(async () => {
      const r = await publishDesignAction(config, "Publication depuis le Studio");
      if (r.status === "success") {
        setMessage({ kind: "ok", text: "Design publié — le site public est mis à jour." });
        router.refresh();
      } else {
        setMessage({ kind: "err", text: r.message ?? "Publication refusée." });
      }
    });
  };

  const preview = () => {
    // Prévisualiser = enregistrer le brouillon + recharger l'aperçu.
    startTransition(async () => {
      const r = await saveDraftAction(config);
      if (r.status === "success") {
        setMessage({
          kind: "ok",
          text: "Aperçu à jour (brouillon enregistré) — rien n'est publié.",
        });
        setReloadKey((k) => k + 1);
      } else {
        setMessage({ kind: "err", text: r.message ?? "Prévisualisation impossible." });
      }
    });
  };

  const revertToPublished = () => {
    if (!publishedConfig) return;
    update(() => structuredClone(publishedConfig));
    setMessage({
      kind: "ok",
      text: "Revenu au design publié — ajustez et republiez à votre rythme.",
    });
  };

  const restore = (id: string) => {
    startTransition(async () => {
      const r = await restoreDesignAction(id);
      if (r.status === "success") {
        setMessage({
          kind: "ok",
          text: "Ancien design chargé en brouillon — la page se met à jour.",
        });
        router.refresh();
      } else {
        setMessage({ kind: "err", text: r.message ?? "Restauration impossible." });
      }
    });
  };

  return (
    <div className="space-y-5">
      {/* ─── Barre d'actions ─── */}
      <div className="sticky top-0 z-40 flex flex-wrap items-center gap-2 rounded-2xl border border-neutral-200 bg-white/95 px-3 py-2.5 backdrop-blur dark:border-white/10 dark:bg-night-800/95">
        <button
          type="button"
          onClick={undo}
          disabled={past.length === 0 || pending}
          className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:border-neutral-500 disabled:opacity-40 dark:border-white/20 dark:text-neutral-300"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={future.length === 0 || pending}
          className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:border-neutral-500 disabled:opacity-40 dark:border-white/20 dark:text-neutral-300"
        >
          Rétablir
        </button>
        <span className="grow" />
        <button
          type="button"
          onClick={revertToPublished}
          disabled={!publishedConfig || pending}
          className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:border-neutral-500 disabled:opacity-40 dark:border-white/20 dark:text-neutral-300"
        >
          Revenir au publié
        </button>
        <button
          type="button"
          onClick={preview}
          disabled={pending}
          className="rounded-full border border-neutral-900 px-4 py-1.5 text-xs font-bold text-neutral-900 hover:bg-neutral-900 hover:text-white disabled:opacity-40 dark:border-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-100 dark:hover:text-neutral-900"
        >
          Prévisualiser
        </button>
        <button
          type="button"
          onClick={publish}
          disabled={!canPublish || pending}
          title={canPublish ? "Publier sur le site public" : "Réservé aux administrateurs"}
          className="rounded-full bg-guinea-red px-4 py-1.5 text-xs font-bold text-white hover:bg-guinea-red/90 disabled:opacity-40"
        >
          Publier les modifications
        </button>
        {!canPublish && (
          <span className="grow text-right text-[11px] text-neutral-400">
            L’éditeur enregistre et prévisualise — la publication est réservée
            aux administrateurs.
          </span>
        )}
      </div>

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
      {unpub && (
        <p className="rounded-xl border border-guinea-yellow/60 bg-guinea-yellow/10 px-4 py-2.5 text-xs font-semibold text-neutral-700 dark:text-neutral-200">
          Modifications non publiées : le site public n’est PAS modifié tant
          que vous n’avez pas publié.{" "}
          {draftUpdatedAt
            ? `Brouillon enregistré le ${new Date(draftUpdatedAt).toLocaleString("fr-FR")}.`
            : "Aucun brouillon enregistré pour le moment."}
        </p>
      )}

      <div className="grid gap-5 xl:grid-cols-[440px_1fr]">
        {/* ─── Panneaux d'édition ─── */}
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap gap-1.5" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                  tab === t.id
                    ? "border-guinea-red bg-guinea-red/10 text-guinea-red"
                    : "border-neutral-200 text-neutral-500 hover:border-guinea-red/40 dark:border-white/10 dark:text-neutral-300",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div>
            {tab === "themes" && (
              <>
                <ThemesPanel config={config} apply={(c) => update(() => c)} />
                <p className="mt-3 text-[11px] text-neutral-400">
                  Appliquer un thème remplace TOUS les réglages — « Annuler »
                  revient en arrière ; chaque détail reste ajustable ensuite.
                </p>
              </>
            )}
            {tab === "identite" && <IdentityPanel config={config} update={update} />}
            {tab === "composants" && <ComposantsPanel config={config} update={update} />}
            {tab === "en-tete" && <EnTetePanel config={config} update={update} />}
            {tab === "accueil" && (
              <AccueilPanel config={config} update={update} categories={categories} />
            )}
            {tab === "footer" && <FooterPanel config={config} update={update} />}
            {tab === "historique" && (
              <HistoriquePanel history={history} onRestore={restore} disabled={pending} />
            )}
          </div>
        </div>

        {/* ─── Aperçu ─── */}
        <div className="min-w-0">
          <StudioPreviewFrame config={config} reloadKey={reloadKey} />
        </div>
      </div>
    </div>
  );
}
