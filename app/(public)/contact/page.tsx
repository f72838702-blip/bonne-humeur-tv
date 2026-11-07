import type { Metadata } from "next";
import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import ContactForm from "@/components/contact/ContactForm";
import PageTitle from "@/components/shared/PageTitle";

/** Flash Infos (layout) : fenêtre ISR du site (120 s) — le HTML n'est
 *  plus figé au build, le bandeau suit l'activité éditoriale. */
export const revalidate = 120;

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contactez Bonne Humeur TV : Kaloum, Sans-Fil, Immeuble Mbemba Diaby — Conakry, Guinée.",
};

export default function ContactPage() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <PageTitle
        kicker="À votre écoute"
        title="Nous"
        highlight="contacter"
        subtitle="Une question, un projet, un événement à couvrir ? Écrivez-nous."
      />

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          <div className="rounded-2xl border border-neutral-200 bg-surface p-6 dark:border-white/10 dark:bg-night-800">
            <h2 className="font-display text-lg font-bold">Coordonnées officielles</h2>
            <ul className="mt-4 space-y-4 text-sm text-neutral-600 dark:text-neutral-300">
              <li className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-guinea-red" />
                <span>
                  Kaloum, Sans-Fil, Immeuble Mbemba Diaby
                  <br />
                  Conakry, République de Guinée
                </span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="h-5 w-5 shrink-0 text-guinea-red" />
                <a href="tel:+224662860976" className="transition-colors hover:text-guinea-red">
                  +224 662 860 976
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="h-5 w-5 shrink-0 text-guinea-red" />
                contact@bonnehumeur.tv
              </li>
              <li className="flex items-start gap-3">
                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-guinea-red" />
                <span>
                  Rédaction : lun. – sam., 9 h – 19 h
                  <br />
                  Pôle commercial : sur rendez-vous
                </span>
              </li>
            </ul>
          </div>

          <a
            href="https://wa.me/224662860976?text=Bonjour%20Bonne%20Humeur%20TV%20!"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2.5 rounded-2xl bg-guinea-green px-6 py-4 text-sm font-bold text-white transition-transform hover:scale-[1.02]"
          >
            <MessageCircle className="h-5 w-5" />
            Discuter sur WhatsApp : +224 662 860 976
          </a>

          <div className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-white/10">
            <iframe
              title="Localisation — Kaloum, Conakry"
              src="https://www.openstreetmap.org/export/embed.html?bbox=-13.7350%2C9.4950%2C-13.6900%2C9.5250&layer=mapnik&marker=9.5092%2C-13.7122"
              className="h-64 w-full"
              loading="lazy"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-surface p-6 dark:border-white/10 dark:bg-night-800 sm:p-8">
          <h2 className="font-display text-lg font-bold">Formulaire de contact</h2>
          <div className="mt-5">
            <ContactForm />
          </div>
        </div>
      </div>
    </section>
  );
}
