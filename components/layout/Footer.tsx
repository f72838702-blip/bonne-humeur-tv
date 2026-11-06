import Link from "next/link";
import { MapPin, Mail, Phone } from "lucide-react";
import Logo from "@/components/shared/Logo";
import type { FooterConfig } from "@/lib/design/schema";

/**
 * Pied de page — refonte Studio (audit F1) : l'ancienne identité
 * provisoire (badge Play + nom textuel) est remplacée par le LOGO
 * OFFICIEL intégral (object-contain, jamais déformé), dans une
 * présentation plus aérée : 3 colonnes (identité, navigation, contact)
 * + bandeau légal. Présentation pilotable par le Studio de design
 * (config footer publiée — repli = ces valeurs) :
 *  • classic    : 3 colonnes (identité / navigation / contact) ;
 *  • columns2   : identité à gauche, navigation+contact à droite ;
 *  • centered   : identité centrée, liens centrés dessous.
 */
export default function Footer({
  links,
  config,
}: {
  /** Liens de navigation facultatifs (Studio) — repli : navigation standard. */
  links?: { href: string; label: string }[];
  config?: FooterConfig | null;
}) {
  const nav =
    links ??
    [
      { href: "/", label: "Accueil" },
      { href: "/actualites", label: "Actualités" },
      { href: "/videos", label: "Vidéos & Émissions" },
      { href: "/partenariats", label: "Offres & Partenariats" },
      { href: "/recherche", label: "Rechercher" },
      { href: "/contact", label: "Contact" },
    ];
  const showNav = config?.showNavigation ?? true;
  const showContact = config?.showContact ?? true;
  const layout = config?.style === "columns2" || config?.style === "centered" ? config.style : "classic";

  const gridLayout = {
    classic: "md:grid-cols-3",
    columns2: "md:grid-cols-2",
    centered: "md:grid-cols-1 place-items-center text-center",
  }[layout];

  return (
    <footer className="border-t border-neutral-200 bg-surface dark:border-white/10 dark:bg-night-900">
      <div className="tricolor-line h-1 w-full opacity-70" />
      <div className={`mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 ${gridLayout}`}>
        <div className={layout === "centered" ? "text-center" : ""}>
          <Logo className="h-9 w-auto select-none object-contain" />
          <p className={`mt-5 max-w-sm text-sm leading-relaxed text-neutral-500 dark:text-neutral-400 ${layout === "centered" ? "mx-auto" : ""}`}>
            La Télé de la nouvelle génération. Information, culture, éducation et
            divertissement — en direct de Conakry, pour la Guinée et sa diaspora.
          </p>
        </div>

        {showNav && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-400">
              Navigation
            </h3>
            <ul className={`mt-4 grid grid-cols-1 gap-2.5 text-sm sm:grid-cols-2 ${layout === "centered" ? "flex flex-col items-center" : ""}`}>
              {nav.map((l) => (
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
        )}

        {showContact && (
          <div>
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-400">
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
        )}
      </div>
      <div className="border-t border-neutral-200 py-5 dark:border-white/10">
        <div className="flex flex-col items-center justify-between gap-3 px-4 text-xs text-neutral-500 sm:flex-row dark:text-neutral-500">
          <p>© 2026 Bonne Humeur TV — Tous droits réservés.</p>
          <div className="flex items-center gap-4">
            <Link
              href="/mentions-legales"
              className="transition-colors hover:text-guinea-red"
            >
              Mentions légales
            </Link>
            <Link
              href="/confidentialite"
              className="transition-colors hover:text-guinea-red"
            >
              Confidentialité
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
