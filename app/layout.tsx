import type { Metadata, Viewport } from "next";
import {
  Inter,
  Archivo,
  DM_Sans,
  Lora,
  Newsreader,
  Oswald,
} from "next/font/google";
import "./globals.css";
import { getPublishedDesignCached } from "@/lib/design/data";

/* Jeu FERMÉ de polices du média (Studio de design) — toutes self-hostées
   par next/font (aucune requête externe, CSP intacte, 0 USD) et à
   séries variables. Seules les polices EFFECTIVEMENT utilisées par la
   variable CSS active sont téléchargées par le navigateur (font-face
   déclarées mais jamais requêtées tant que la famille n'est pas rendue).
   Le Studio publie --bhtv-font-body / --bhtv-font-display avec la bonne
   variable — aucune autre police ne pourra être injectée (liste fermée). */
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["500", "700", "800", "900"],
  variable: "--font-display",
});
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });
const lora = Lora({ subsets: ["latin"], variable: "--font-lora" });
const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-newsreader" });
const oswald = Oswald({ subsets: ["latin"], variable: "--font-oswald" });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bonnehumeur.info";

/**
 * Correctif FOUC (A3-2) : applique le thème persisté AVANT le premier
 * rendu du navigateur. Le store Zustand persiste l'état sous la clé
 * « bhtv-theme » au format {"state":{"dark":boolean},"version":0}.
 *
 * Studio de design : si le design publié choisit une apparence par défaut
 * (« mode »), elle s'applique aux visites SANS préférence enregistrée.
 * Le commutateur manuel de l'en-tête reste maître (préférence stockée).
 */
function buildThemeInitScript(defaultMode: "light" | "dark" | null): string {
  // Valeur de BOOT uniquement — littéral sérialisé côté serveur depuis
  // la config validée par le schéma (aucune donnée visiteur ici).
  const bootDark = defaultMode === "light" ? false : true;
  return `
(function () {
  try {
    var raw = localStorage.getItem("bhtv-theme");
    var dark = ${bootDark ? "true" : "false"};
    if (raw) {
      var stored = JSON.parse(raw);
      if (stored && stored.state && typeof stored.state.dark === "boolean") {
        dark = stored.state.dark;
      }
    }
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.dataset.bhtvMode = dark ? "dark" : "light";
  } catch (e) {
    document.documentElement.classList.add("dark");
  }
})();
`;
}

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

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Lecture dégradable (dédupliquée avec le layout public via cache()) :
  // le design publié peut définir l'apparence par défaut des visites.
  let defaultMode: "light" | "dark" | null = null;
  try {
    const design = await getPublishedDesignCached();
    defaultMode = design.config?.mode ?? null;
  } catch {
    defaultMode = null; // jamais de page cassée
  }

  return (
    <html lang="fr" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: buildThemeInitScript(defaultMode) }} />
      </head>
      {/* Châssis minimal : thème + polices SEULEMENT. Aucun élément public
          ici — la façade visiteur (navigation, pied de page, WhatsApp,
          publicités, collecte) vit exclusivement dans app/(public)/layout.tsx,
          donc /admin/* en est totalement isolé (correction UX 05/11/2026). */}
      <body className={`${inter.variable} ${archivo.variable} ${dmSans.variable} ${lora.variable} ${newsreader.variable} ${oswald.variable} flex min-h-screen flex-col`}>
        {children}
      </body>
    </html>
  );
}
