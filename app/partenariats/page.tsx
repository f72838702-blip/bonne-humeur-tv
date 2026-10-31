import type { Metadata } from "next";
import { Quote } from "lucide-react";
import ServicesGrid from "@/components/partenariats/ServicesGrid";
import PartnershipForm from "@/components/partenariats/PartnershipForm";
import Reveal from "@/components/shared/Reveal";

export const metadata: Metadata = {
  title: "Offres & Partenariats",
  description:
    "Couverture médiatique, interviews, production audiovisuelle et communication digitale : découvrez les offres B2B de Bonne Humeur TV pour entreprises et institutions en Guinée.",
};

export default function PartenariatsPage() {
  return (
    <>
      {/* ─── Hero institutionnel ─── */}
      <section className="relative overflow-hidden border-b border-neutral-200 bg-night-900 py-20 text-white dark:border-white/10">
        <div className="pointer-events-none absolute inset-0 [background:radial-gradient(ellipse_at_top,rgba(206,17,38,0.25),transparent_55%)]" />
        <div className="tricolor-line absolute inset-x-0 top-0 h-1.5" />
        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
          <span className="text-xs font-extrabold uppercase tracking-[0.25em] text-guinea-yellow">
            Offres & Partenariats
          </span>
          <h1 className="mt-4 text-balance font-display text-3xl font-extrabold sm:text-5xl">
            Votre partenaire média de la nouvelle génération
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-neutral-300 sm:text-base">
            Bonne Humeur TV accompagne les entreprises, institutions et ONG dans
            leur stratégie de visibilité : de la couverture d&apos;événement à la
            campagne digitale complète.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#devis"
              className="inline-flex items-center gap-2 rounded-full bg-guinea-red px-7 py-3.5 text-sm font-bold shadow-glow transition-transform hover:scale-105"
            >
              Demander un devis
            </a>
            <a
              href="/contact"
              className="inline-flex items-center gap-2 rounded-full border border-white/25 px-7 py-3.5 text-sm font-bold transition-colors hover:bg-white/10"
            >
              Nous contacter
            </a>
          </div>
        </div>
      </section>

      {/* ─── Mot du PDG ─── */}
      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <Reveal>
        <div className="relative rounded-3xl border border-neutral-200 bg-white p-8 dark:border-white/10 dark:bg-night-800 sm:p-12">
          <Quote className="absolute -top-5 left-8 h-10 w-10 rounded-full bg-guinea-red p-2 text-white shadow-glow" />
          <blockquote className="text-balance font-display text-lg font-medium leading-relaxed sm:text-2xl">
            « Notre ambition est simple : offrir à la Guinée une télévision
            moderne, proche de sa jeunesse et utile à ses institutions. Chaque
            partenaire qui nous rejoint participe à construire ce média de la
            nouvelle génération. »
          </blockquote>
          <figcaption className="mt-6 flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-guinea-red/10 font-display text-sm font-extrabold text-guinea-red">
              IST
            </span>
            <span>
              <span className="block font-bold">Ibrahima Sory Touré</span>
              <span className="block text-sm text-neutral-500 dark:text-neutral-400">
                Président-Directeur Général, Bonne Humeur TV
              </span>
            </span>
          </figcaption>
        </div>
        </Reveal>
      </section>

      {/* ─── Grille des prestations ─── */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <h2 className="text-center font-display text-2xl font-extrabold sm:text-3xl">
          Nos <span className="text-guinea-red">prestations</span>
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm text-neutral-500 dark:text-neutral-400">
          Quatre pôles d&apos;expertise, des formats adaptés à chaque objectif de
          communication.
        </p>
        <Reveal delay={100} className="mt-10">
          <ServicesGrid />
        </Reveal>
      </section>

      {/* ─── Formulaire de demande de devis ─── */}
      <section
        id="devis"
        className="scroll-mt-20 border-t border-neutral-200 bg-white/50 dark:border-white/10 dark:bg-night-900/50"
      >
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <h2 className="text-center font-display text-2xl font-extrabold sm:text-3xl">
            Demander un <span className="text-guinea-red">devis</span>
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-sm text-neutral-500 dark:text-neutral-400">
            Remplissez ce formulaire : notre équipe commerciale vous répond sous
            48 h ouvrées avec une proposition adaptée.
          </p>
          <Reveal delay={100} className="mt-10">
            <PartnershipForm />
          </Reveal>
        </div>
      </section>
    </>
  );
}
