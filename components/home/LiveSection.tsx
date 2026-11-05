import Link from "next/link";
import { ExternalLink, Radio, SquarePlay } from "lucide-react";
import {
  CHANNEL_URL,
  applyLiveConfig,
} from "@/lib/direct/core";
import { getLiveConfig } from "@/lib/direct/config";
import { detectLive } from "@/lib/direct/detect";
import DirectLivePlayer from "@/components/home/DirectLivePlayer";

/**
 * Section « EN DIRECT » de la page d'accueil — décision d'affichage
 * PUREMENT issue de applyLiveConfig (un seul point de vérité) :
 * • direct réel confirmé (API YouTube, serveur, clé jamais exposée) ou
 *   lien posé en mode manuel par la rédaction → lecteur en façade
 *   (YouTube contacté UNIQUEMENT au clic du visiteur) ;
 * • dans TOUT autre cas → présentation discrète + bouton « Voir notre
 *   chaîne YouTube », avec la rediffusion éventuelle clairement
 *   étiquetée — JAMAIS de lecteur vide ou d'ancienne diffusion présenté
 *   comme un direct ;
 * • module désactivé ou mode off → la section NE S'AFFICHE PAS du tout
 *   (zéro footprint sur la page d'accueil).
 * Les erreurs YouTube sont silencieusement résorbées en présentation
 * discrète — la page d'accueil ne casse jamais à cause du direct.
 */
export default async function LiveSection() {
  const config = await getLiveConfig();
  let detection = null;
  try {
    detection = await detectLive(); // cache mémoire ~3 min (lib/direct/detect)
  } catch {
    detection = { status: "error" as const };
  }

  const decision = applyLiveConfig(config, detection);
  if (decision.show === null) return null;

  return (
    <section
      aria-labelledby="direct-section-title"
      className="mx-auto max-w-7xl px-4 pb-14 pt-2 sm:px-6"
    >
      {decision.show === "player" ? (
        <div>
          <h2
            id="direct-section-title"
            className="mb-4 flex items-center gap-3 font-display text-xl font-extrabold sm:text-2xl"
          >
            <span className="flex items-center gap-2 rounded-full bg-guinea-red px-3 py-1 text-xs font-extrabold uppercase tracking-widest text-white">
              <span className="relative flex h-2 w-2">
                <span className="absolute h-full w-full animate-ping rounded-full bg-white opacity-75" />
                <span className="relative h-2 w-2 rounded-full bg-white" />
              </span>
              En direct
            </span>
            Bonne Humeur TV est <span className="text-guinea-red">en direct</span>
          </h2>
          {/* max-w raisonnable : un lecteur plein écran sur tablette reste
              lisible, mobile = 100 % de la largeur */}
          <div className="max-w-4xl">
            <DirectLivePlayer
              videoId={decision.videoId}
              title={decision.title}
              isLive={true}
            />
          </div>
        </div>
      ) : (
        /* Présentation discrète — JAMAIS un lecteur qui simule un direct */
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-6 text-center dark:border-white/10 dark:bg-night-800 sm:p-8">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-guinea-red/10 text-guinea-red">
            <Radio className="h-6 w-6" />
          </span>
          <div>
            <h2
              id="direct-section-title"
              className="font-display text-lg font-extrabold sm:text-xl"
            >
              Aucun direct pour le moment
            </h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Les émissions en direct de Bonne Humeur TV apparaissent ici dès le
              lancement. Rejoignez notre chaîne pour être averti du prochain.
            </p>
          </div>
          <a
            href={CHANNEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-bold transition-colors hover:border-guinea-red hover:text-guinea-red dark:border-white/20"
          >
            <ExternalLink className="h-4 w-4" />
            Voir notre chaîne YouTube
          </a>
        </div>
      )}

      {/* Rediffusion : accès DISTINCT, jamais présenté comme un direct */}
      {decision.show === "channel" && decision.replayVideoId && (
        <div className="mx-auto max-w-4xl pt-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
            <SquarePlay className="h-4 w-4" />
            Rediffusion récente
          </h3>
          <DirectLivePlayer
            videoId={decision.replayVideoId}
            title="Programme récent"
            isLive={false}
          />
          <p className="mt-2 flex justify-end">
            <Link
              href="/videos"
              className="text-xs font-bold text-guinea-red underline-offset-4 hover:underline"
            >
              Toutes les émissions →
            </Link>
          </p>
        </div>
      )}
    </section>
  );
}
