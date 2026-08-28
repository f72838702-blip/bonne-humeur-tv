import Link from "next/link";
import { MapPin, Mail, Phone, Play } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-neutral-200 bg-white dark:border-white/10 dark:bg-night-900">
      <div className="tricolor-line h-1 w-full opacity-70" />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-guinea-red">
              <Play className="ml-0.5 h-4 w-4 fill-white text-white" />
            </span>
            <span className="font-display text-lg font-extrabold">
              Bonne Humeur <span className="text-guinea-red">TV</span>
            </span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
            La Télé de la nouvelle génération. Information, culture, éducation et
            divertissement — en direct de Conakry, pour la Guinée et sa diaspora.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400">
            Navigation
          </h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            {[
              { href: "/", label: "Accueil" },
              { href: "/videos", label: "Vidéos & Émissions" },
              { href: "/partenariats", label: "Offres & Partenariats" },
              { href: "/contact", label: "Contact" },
            ].map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="text-neutral-600 transition-colors hover:text-guinea-red dark:text-neutral-300"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400">
            Nous trouver
          </h3>
          <ul className="mt-4 space-y-3 text-sm text-neutral-600 dark:text-neutral-300">
            <li className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-guinea-red" />
              Kaloum, Sans-Fil, Immeuble Mbemba Diaby — Conakry, Guinée
            </li>
            <li className="flex items-center gap-2.5">
              <Phone className="h-4 w-4 shrink-0 text-guinea-red" />
              <a
                href="https://wa.me/224662860976"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-guinea-green"
              >
                +224 662 860 976 (WhatsApp)
              </a>
            </li>
            <li className="flex items-center gap-2.5">
              <Mail className="h-4 w-4 shrink-0 text-guinea-red" />
              contact@bonnehumeur.tv
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-neutral-200 py-5 text-center text-xs text-neutral-500 dark:border-white/10 dark:text-neutral-500">
        © 2026 Bonne Humeur TV — Tous droits réservés.
      </div>
    </footer>
  );
}
