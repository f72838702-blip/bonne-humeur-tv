"use server";

import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validation/schemas";
import { ActionState, errorState, zodFieldErrors } from "./helpers";

/**
 * Authentification de l'équipe — Supabase Auth (session httpOnly).
 * Les rôles sont vérifiés APRÈS connexion (table profiles + RLS) ;
 * la page /admin refuse l'accès aux comptes sans profil staff.
 */

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return errorState("Veuillez corriger les champs signalés.", zodFieldErrors(parsed.error));
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return errorState(
      "Le back-office n'est pas encore configuré. Voir la documentation du projet (supabase/README-CONFIGURATION.md)."
    );
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Message générique : ne révèle pas si l'email existe.
    return errorState("Identifiants incorrects.");
  }

  redirect("/admin");
}

export async function signOut(): Promise<void> {
  const supabase = await getSupabaseServerClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  redirect("/admin/login");
}