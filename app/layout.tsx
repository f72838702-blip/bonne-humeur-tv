import type { Metadata, Viewport } from "next";
import { Inter, Archivo } from "next/font/google";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import WhatsAppFloat from "@/components/layout/WhatsAppFloat";
import JsonLd from "@/components/shared/JsonLd";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["500", "700", "800", "900"],
  variable: "--font-display",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bonne-humeur-tv.vercel.app";

/**
 * Correctif FOUC (A3-2) : applique le thème persisté AVANT le premier
 * rendu du navigateur. Le store Zustand persiste l'état sous la clé
 * « bhtv-theme » au format {"state":{"dark":boolean},"version":0}.
 */
const themeInitScript = `
(function () {
  try {
    var raw = localStorage.getItem("bhtv-theme");
    var dark = true;
    if (raw) {
      var stored = JSON.parse(raw);
      if (stored && stored.state && typeof stored.state.dark === "boolean") {
        dark = stored.state.dark;
      }
    }
    document.documentElement.classList.toggle("dark", dark);
  } catch (e) {
    document.documentElement.classList.add("dark");
  }
})();
`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Bonne Humeur TV — La Télé de la nouvelle génération",
    template: "%s | Bonne Humeur TV",
  },
  description:
    "Bonne Humeur TV, la Télé de la nouvelle génération basée à Conakry, Guinée. Information, culture, économie, éducation et offres de partenariat pour entreprises et institutions.",
  openGraph: {
    type: "website",
    locale: "fr_GN",
    siteName: "Bonne Humeur TV",
    title: "Bonne Humeur TV — La Télé de la nouvelle génération",
    description:
      "Information, culture et divertissement en direct de Conakry. Offres B2B pour entreprises et institutions.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Bonne Humeur TV",
    description: "La Télé de la nouvelle génération — Conakry, Guinée.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0A0A0F" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${inter.variable} ${archivo.variable} flex min-h-screen flex-col`}>
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
      </body>
    </html>
  );
}
