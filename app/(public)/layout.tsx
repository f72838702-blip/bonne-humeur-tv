import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import WhatsAppFloat from "@/components/layout/WhatsAppFloat";
import AiChatWidget from "@/components/home/AiChatWidget";
import TrackerStats from "@/components/analytics/TrackerStats";
import JsonLd from "@/components/shared/JsonLd";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bonne-humeur-tv.bonne-humeur-tv.workers.dev";

/**
 * Layout du SITE PUBLIC uniquement (route group — n'affecte pas les URL).
 * Toute la façade visiteur vit ici : navigation, pied de page, bouton
 * WhatsApp, publicités, collecte d'audience. Le back-office (/admin/*)
 * ne passe JAMAIS par ce layout : son rendu est totalement isolé
 * (correction UX « administration pro » demandée par la direction).
 */
export default function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {/* Identité de l'organisation — données réelles, aucune invention */}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Bonne Humeur TV",
          url: siteUrl,
          slogan: "La Télé de la nouvelle génération",
          areaServed: "GN",
          address: {
            "@type": "PostalAddress",
            addressLocality: "Conakry",
            addressCountry: "GN",
          },
        }}
      />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <WhatsAppFloat />
      {/* Assistant public (bas gauche — aucun chevauchement avec WhatsApp).
          Monté UNIQUEMENT ici : le back-office ne l'exécute pas. */}
      <AiChatWidget />
      {/* Collecte d'audience ANONYME (0029) — MONTÉE UNIQUEMENT ICI : le
          back-office n'exécute même plus ce composant (auto-exclusions
          conservées en défense en profondeur). */}
      <TrackerStats />
    </>
  );
}
