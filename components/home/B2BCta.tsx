import Link from "next/link";
import { ArrowRight, Building2, Handshake, TrendingUp } from "lucide-react";

export default function B2BCta() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-night-900 text-white dark:border-white/10">
      <div className="tricolor-line absolute inset-x-0 top-0 h-1.5" />
      <div className="pointer-events-none absolute inset-0 [background:radial-gradient(ellipse_at_bottom_left,rgba(0,154,68,0.18),transparent_55%),radial-gradient(ellipse_at_top_right,rgba(206,17,38,0.2),transparent_55%)]" />
      <div className="relative px-6 py-14 text-center sm:px-12">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-guinea-yellow">
          <Handshake className="h-3.5 w-3.5" />
          Espace B2B
        </span>
        <h2 className="mx-auto mt-6 max-w-2xl text-balance font-display text-2xl font-extrabold sm:text-4xl">
          Entreprises & institutions : faites rayonner votre image
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-neutral-300 sm:text-base">
          Couverture médiatique, interviews, production audiovisuelle et
          communication digitale : Bonne Humeur Média met sa rédaction et sa
          diffusion au service de vos projets.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/partenariats"
            className="inline-flex items-center gap-2 rounded-full bg-guinea-red px-7 py-3.5 text-sm font-bold transition-transform hover:scale-105"
          >
            Découvrir nos offres
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 rounded-full border border-white/25 px-7 py-3.5 text-sm font-bold transition-colors hover:bg-white/10"
          >
            <Building2 className="h-4 w-4" />
            Nous contacter
          </Link>
        </div>

        <div className="mx-auto mt-10 grid max-w-lg grid-cols-3 gap-4 text-center">
          {[
            { icon: TrendingUp, label: "Audience croissante" },
            { icon: Building2, label: "Partenaires institutionnels" },
            { icon: Handshake, label: "Formats sur mesure" },
          ].map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-2">
              <s.icon className="h-5 w-5 text-guinea-green" />
              <span className="text-xs font-medium text-neutral-300">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
