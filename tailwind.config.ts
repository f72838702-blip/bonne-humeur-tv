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
        // Couleurs thématiques — rappel du drapeau et du logo
        guinea: {
          green: "#009A44",
          red: "#CE1126",
          yellow: "#FCD116",
        },
        night: {
          950: "#0A0A0F",
          900: "#101016",
          800: "#17171F",
          700: "#22222C",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
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
      boxShadow: {
        glow: "0 0 40px -10px rgba(206, 17, 38, 0.45)",
      },
    },
  },
  plugins: [],
};

export default config;
