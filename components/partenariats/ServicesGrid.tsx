import { Clapperboard, Megaphone, Mic, Radio, type LucideIcon } from "lucide-react";

interface Service {
  icon: LucideIcon;
  title: string;
  description: string;
  accent: string;
}

const SERVICES: Service[] = [
  {
    icon: Radio,
    title: "Couverture médiatique",
    description:
      "Reportages et diffusion de vos événements : conférences, lancements, cérémonies officielles et actions sur le terrain.",
    accent: "text-guinea-green bg-guinea-green/10",
  },
  {
    icon: Mic,
    title: "Interviews & Portraits",
    description:
      "Interviews institutionnelles et portraits d'acteurs clés, produits par notre rédaction pour valoriser votre expertise.",
    accent: "text-guinea-yellow bg-guinea-yellow/10",
  },
  {
    icon: Clapperboard,
    title: "Production audiovisuelle",
    description:
      "Spots, clips institutionnels, documentaires courts et captations multicam — de l'écriture à la post-production.",
    accent: "text-guinea-red bg-guinea-red/10",
  },
  {
    icon: Megaphone,
    title: "Communication digitale",
    description:
      "Stratégie social media, sponsoring d'émissions et diffusion multi-plateforme pour toucher la nouvelle génération.",
    accent: "text-sky-500 bg-sky-500/10 dark:text-sky-400",
  },
];

export default function ServicesGrid() {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {SERVICES.map((service) => (
        <article
          key={service.title}
          className="group rounded-2xl border border-neutral-200 bg-surface p-6 transition-all hover:-translate-y-1 hover:shadow-xl dark:border-white/10 dark:bg-night-800 dark:hover:border-white/25"
        >
          <span
            className={`flex h-12 w-12 items-center justify-center rounded-xl transition-transform group-hover:scale-110 ${service.accent}`}
          >
            <service.icon className="h-6 w-6" />
          </span>
          <h3 className="mt-5 font-display text-lg font-bold">{service.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
            {service.description}
          </p>
        </article>
      ))}
    </div>
  );
}
