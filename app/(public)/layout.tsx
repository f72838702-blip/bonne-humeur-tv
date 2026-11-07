import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import BreakingNews from "@/components/home/BreakingNews";
import WhatsAppFloat from "@/components/layout/WhatsAppFloat";
import AiChatWidget from "@/components/home/AiChatWidget";
import TrackerStats from "@/components/analytics/TrackerStats";
import JsonLd from "@/components/shared/JsonLd";
import DesignStyle from "@/components/design/DesignStyle";
import { getPublishedDesignCached } from "@/lib/design/data";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bonne-humeur-tv.bonne-humeur-tv.workers.dev";

/**
 * Layout du SITE PUBLIC uniquement (route group — n'affecte pas les URL).
 * Toute la façade visiteur vit ici : navigation, pied de page, bouton
 * WhatsApp, publicités, collecte d'audience. Le back-office (/admin/*)
 * ne passe JAMAIS par ce layout : son rendu est totalement isolé
 * (correction UX « administration pro » demandée par la direction).
 */
export default async function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Design publié — lecture dégradable (table absente / repli = null,
  // aucun style injecté, socle historique intact). Le contenu du <style>
  // est produit par cssDesignStyle : UNIQUEMENT des variables --bhtv-*
  // issues du schéma fermé — aucune chaîne libre ne le traverse.
  const design = await getPublishedDesignCached();
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
      {/* Studio de design : identité personnalisée (variables only). */}
      <DesignStyle config={design.config} />
      {/* En-tête + pied de page pilotés par la config publiée
          (défauts = comportement historique exact). */}
      <Header config={design.config?.header} />
      {/* Flash Infos : bandeau du layout — visible sur TOUTES les pages
          publiques (accueil, actualités, articles, vidéos, recherche,
          contact, partenariats…) sans duplication par page. Un seul
          rendu serveur, mêmes données et règles que l'accueil (RLS
          période + re-filtrage classifyFlash). Les flashs expirés
          disparaissent comme avant : côté client (FlashTicker) à
          l'heure exacte, et côté serveur à la prochaine requête. Le
          back-office (/admin/*) ne passe JAMAIS par ce layout. */}
      <BreakingNews />
      <main className="flex-1">{children}</main>
      <Footer config={design.config?.footer} />
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
