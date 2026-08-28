import type { Metadata, Viewport } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bonne-humeur-tv.vercel.app";

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
      <body className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
