import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ThemeState {
  /** Mode sombre activé (par défaut : apparence appliquée au BOOT par
   *  app/layout.tsx depuis le design publié — Studio de design). */
  dark: boolean;
  toggle: () => void;
}

/**
 * Valeur initiale alignée sur le boot : le script d'amorçage
 * (app/layout.tsx) applique avant le premier rendu la préférence
 * visiteur OU l'apparence par défaut du design publié
 * (data-bhtv-mode). « store/theme.ts » n'EST PLUS la source de vérité :
 * il ne fait que refléter et commuter (le persist prend le relais dès
 * qu'une préférence existe).
 */
const bootDark = (): boolean => {
  if (typeof document === "undefined") return true; // SSR (site nuit d'abord — historique)
  return document.documentElement.dataset.bhtvMode !== "light";
};

export const useTheme = create<ThemeState>()(
  persist(
    (set) => ({
      dark: bootDark(),
      toggle: () => set((s) => ({ dark: !s.dark })),
    }),
    { name: "bhtv-theme" }
  )
);
