import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ThemeState {
  /** Mode sombre activé (par défaut : true pour le rendu "Web TV") */
  dark: boolean;
  toggle: () => void;
}

export const useTheme = create<ThemeState>()(
  persist(
    (set) => ({
      dark: true,
      toggle: () => set((s) => ({ dark: !s.dark })),
    }),
    { name: "bhtv-theme" }
  )
);
