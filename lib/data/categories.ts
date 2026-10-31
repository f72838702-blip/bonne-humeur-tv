import { getSupabasePublicClient } from "@/lib/supabase/server";
import type { Category } from "@/lib/types";

/**
 * Accès aux catégories (rubriques éditoriales).
 * Sans backend configuré → liste vide (l'UI affiche un état vide honnête).
 */
export async function getCategories(): Promise<Category[]> {
  const supabase = getSupabasePublicClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("[data/categories] getCategories :", error.message);
    return [];
  }
  return (data ?? []) as Category[];
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const supabase = getSupabasePublicClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("[data/categories] getCategoryBySlug :", error.message);
    return null;
  }
  return (data as Category) ?? null;
}