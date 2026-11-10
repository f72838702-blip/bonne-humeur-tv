"use server";

import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validation/schemas";
import {
  identifiantToEmail,
  looksLikeEmail,
  validateIdentifiant,
} from "@/lib/auth/manager-account";
import { ActionState, errorState, zodFieldErrors } from "./helpers";

/**
 * Authentification de l'équipe — Supabase Auth (session httpOnly).
 * Les rôles sont vérifiés APRÈS connexion (table profiles + RLS) ;
 * la page /admin refuse l'accès aux comptes sans profil staff.
 * CONNEXION PAR IDENTIFIANT (comptes créés par le Super Administrateur) :
 * une saisie SANS « @ » est transformée CÔTÉ SERVEUR en adresse technique
 * stable (identifiant@gestion.bonnehumeur.info) — jamais simulée dans le
 * navigateur. Les emails réels (historiques inclus) passent inchangés.
 */

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const rawInput = String(formData.get("email") ?? "").trim();
  let emailForAuth = rawInput;

  if (!looksLikeEmail(rawInput)) {
    const idCheck = validateIdentifiant(rawInput);
    if (!idCheck.ok) {
      return errorState(
        idCheck.reason === "bornes"
          ? "Identifiant invalide : aucun point ou tiret en première/dernière position."
          : "Identifiant invalide : 2 à 32 caractères (lettres non accentuées, chiffres, . _ -)."
      );
    }
    emailForAuth = identifiantToEmail(idCheck.identifiant);
  }

  const parsed = loginSchema.safeParse({
    email: emailForAuth,
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