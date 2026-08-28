import { create } from "zustand";

export type CategoryKey =
  | "all"
  | "societe"
  | "culture"
  | "economie"
  | "education"
  | "institutionnel";

export const CATEGORIES: { key: CategoryKey; label: string }[] = [
  { key: "all", label: "Tout" },
  { key: "societe", label: "Société" },
  { key: "culture", label: "Culture" },
  { key: "economie", label: "Économie" },
  { key: "education", label: "Éducation" },
  { key: "institutionnel", label: "Institutionnel" },
];

interface FilterState {
  active: CategoryKey;
  search: string;
  setActive: (c: CategoryKey) => void;
  setSearch: (q: string) => void;
}

export const useFilters = create<FilterState>()((set) => ({
  active: "all",
  search: "",
  setActive: (active) => set({ active }),
  setSearch: (search) => set({ search }),
}));
