import Image from "next/image";
import { getPartners } from "@/lib/data/ads-public";

/**
 * Vitrine des PARTENAIRES OFFICIELS (home_partners) — logos réels
 * servis depuis Storage, section DISTINCTE du contenu journalistique.
 * Un logo sans image rendu : mention texte seule (jamais d'icône
 * inventée). Zone vide : ne retourne rien.
 */
export default async function PartnerShowcase({ className }: { className?: string }) {
  const partners = await getPartners();
  if (partners.length === 0) return null;

  return (
    <section className={className ?? "my-8"}>
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-400">
        Partenaires officiels
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {partners.map((partner) => {
          const logo = (
            <Image
              src={partner.logo_url}
              alt={partner.alt_text || partner.name}
              width={200}
              height={80}
              loading="lazy"
              unoptimized
              className="h-12 w-full rounded-lg object-contain opacity-80 transition-opacity hover:opacity-100"
            />
          );
          return (
            <div
              key={partner.id}
              className="flex items-center justify-center rounded-xl border border-neutral-200 bg-surface p-3 dark:border-white/10 dark:bg-night-800"
            >
              {partner.link_url ? (
                <a
                  href={partner.link_url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  title={partner.name}
                >
                  {logo}
                </a>
              ) : (
                logo
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}