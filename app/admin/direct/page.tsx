import { redirect } from "next/navigation";
import { Radio } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { getLiveConfig } from "@/lib/direct/config";
import { detectLive } from "@/lib/direct/detect";
import { CHANNEL_URL } from "@/lib/direct/core";
import DirectSettingsForm from "@/components/admin/DirectSettingsForm";
import DirectDetectForm from "@/components/admin/DirectDetectForm";
import DirectLivePlayer from "@/components/home/DirectLivePlayer";
import {
  ForbiddenScreen,
  UnconfiguredScreen,
} from "@/components/admin/AccessDenied";

export const metadata = { title: "Direct YouTube" };

/**
 * Écran d'administration du DIRECT (demande direction 05/11/2026) :
 * • activation/désactivation de la rubrique, mode auto/manuel/off ;
 * • détection automatique côté serveur (+ test à la demande) ;
 * • champ facultatif de lien de direct précis + rediffusion ;
 * • prévisualisation du lecteur ;
 * • la clé API YouTube n'apparaît JAMAIS à l'écran (elle n'est même
 *   jamais envoyée au navigateur — elle vit dans un secret Worker).
 */
export default async function AdminDirectPage() {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) {
    if (guard.denied === "unauthenticated") redirect("/admin/login");
    if (guard.denied === "unconfigured") return <UnconfiguredScreen />;
    return <ForbiddenScreen />;
  }

  if (guard.session.profile?.role === "editor" && !hasPermission(guard.session.profile, "directs")) {
    return <ForbiddenScreen />;
  }

  const config = await getLiveConfig();
  const detection = await detectLive();
  // Prévisualisation : lecteur affiché ici UNIQUEMENT si un direct est
  // réellement confirmé — jamais un faux « aperçu du direct ».
  const previewId =
    config.mode === "manual"
      ? config.manualVideoId
      : detection.status === "live"
        ? detection.videoId
        : null;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold sm:text-3xl">
          Direct YouTube
        </h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Rubrique « EN DIRECT » de la page d&apos;accueil : détection
          automatique du direct de la chaîne{" "}
          <a
            href={CHANNEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-guinea-red underline-offset-4 hover:underline"
          >
            @Bonnehumeurt
          </a>
          , ou lien posé manuellement. JAMAIS de lecteur vide ou d&apos;ancienne
          diffusion présenté comme un direct.
        </p>
      </header>

      <section className="rounded-2xl border border-neutral-200 bg-surface p-6 dark:border-white/10 dark:bg-night-800">
        <h2 className="mb-4 flex items-center gap-2 font-display text-base font-bold">
          <Radio className="h-4 w-4 text-guinea-red" />
          Configuration
        </h2>
        <DirectSettingsForm config={config} />
      </section>

      {previewId && (
        <section className="rounded-2xl border border-neutral-200 bg-surface p-6 dark:border-white/10 dark:bg-night-800">
          <h2 className="mb-4 font-display text-base font-bold">
            Prévisualisation du lecteur
          </h2>
          <p className="mb-4 text-xs text-neutral-500 dark:text-neutral-400">
            La connexion YouTube ne se fait qu&apos;au clic — aucune requête
            n&apos;est émise pour le visiteur tant qu&apos;il n&apos;a pas
            choisi de lancer la lecture.
          </p>
          <div className="max-w-2xl">
            {detection.status === "live" || config.mode === "manual" ? (
              <DirectLivePlayer
                videoId={previewId}
                title={detection.status === "live" ? detection.title : null}
                isLive={true}
              />
            ) : null}
          </div>
          <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
            En production, le lecteur n&apos;est présent sur l&apos;accueil QUE
            si un direct réel est confirmé (mode auto) ou posé par la
            rédaction (mode manuel).
          </p>
        </section>
      )}

      <section className="rounded-2xl border border-neutral-200 bg-surface p-6 dark:border-white/10 dark:bg-night-800">
        <h2 className="mb-4 font-display text-base font-bold">
          Détection — état réel
        </h2>
        <p className="mb-4 text-xs text-neutral-500 dark:text-neutral-400">
          La détection s&apos;exécute côté serveur avec la clé API YouTube
          (secret Worker, jamais exposé). Sans clé, la détection reste
          silencieuse : le mode manuel de la rédaction fonctionne sans aucune
          clé.
        </p>
        <DirectDetectForm config={config} />
        {detection.status === "live" && (
          <div className="mt-4 rounded-xl border border-guinea-green/40 bg-guinea-green/10 p-4">
            <p className="text-sm font-bold text-guinea-green">
              Un direct est en cours maintenant {detection.title ? `: « ${detection.title} »` : ""}.
            </p>
            <div className="mt-3 max-w-2xl">
              <DirectLivePlayer
                videoId={detection.videoId}
                title={detection.title}
                isLive={true}
              />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
