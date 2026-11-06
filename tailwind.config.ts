import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Palette = variables CSS du socle tokens (globals.css) — le Studio
        // de design surcharge ces variables ; la notation rgb(r g b / <a>)
        // préserve les modificateurs d'opacité (ex : guinea-red/10).
        neutral: {
          50: "rgb(var(--bhtv-nt-50) / <alpha-value>)",
          100: "rgb(var(--bhtv-nt-100) / <alpha-value>)",
          200: "rgb(var(--bhtv-nt-200) / <alpha-value>)",
          300: "rgb(var(--bhtv-nt-300) / <alpha-value>)",
          400: "rgb(var(--bhtv-nt-400) / <alpha-value>)",
          500: "rgb(var(--bhtv-nt-500) / <alpha-value>)",
          600: "rgb(var(--bhtv-nt-600) / <alpha-value>)",
          700: "rgb(var(--bhtv-nt-700) / <alpha-value>)",
          800: "rgb(var(--bhtv-nt-800) / <alpha-value>)",
          900: "rgb(var(--bhtv-nt-900) / <alpha-value>)",
        },
        // Couleurs thématiques — rappel du drapeau et du logo
        guinea: {
          green: "rgb(var(--bhtv-guinea-green) / <alpha-value>)",
          red: "rgb(var(--bhtv-guinea-red) / <alpha-value>)",
          yellow: "rgb(var(--bhtv-guinea-yellow) / <alpha-value>)",
        },
        night: {
          950: "rgb(var(--bhtv-night-950) / <alpha-value>)",
          900: "rgb(var(--bhtv-night-900) / <alpha-value>)",
          800: "rgb(var(--bhtv-night-800) / <alpha-value>)",
          700: "rgb(var(--bhtv-night-700) / <alpha-value>)",
        },
        // Libellés de catégories — nuance contrastée par thème (audit F6)
        catink: "rgb(var(--bhtv-cat-ink) / <alpha-value>)",
        // Surface unifiée (blanc historique) piloté par le Studio
        surface: "rgb(var(--bhtv-surface) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--bhtv-font-body)", "var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--bhtv-font-display)", "var(--font-display)", "system-ui", "sans-serif"],
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        pulseDot: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
      },
      animation: {
        marquee: "marquee 30s linear infinite",
        "pulse-dot": "pulseDot 1.4s ease-in-out infinite",
      },
      // Arrondis et ombres pilotés par les tokens (Studio de design) :
      // les rounded-2xl/xl/3xl et shadow-lg/xl/glow du site entier suivent
      // les valeurs publiées — arrondis 100 % hérités du socle.
      borderRadius: {
        xl: "var(--bhtv-radius-xl)",
        "2xl": "var(--bhtv-radius-2xl)",
        "3xl": "var(--bhtv-radius-3xl)",
      },
      boxShadow: {
        lg: "var(--bhtv-shadow-lg)",
        xl: "var(--bhtv-shadow-xl)",
        glow: "var(--bhtv-shadow-glow)",
      },
    },
  },
  plugins: [],
};

export default config;
