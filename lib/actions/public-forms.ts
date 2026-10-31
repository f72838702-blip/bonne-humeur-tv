"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { contactSchema, partnershipSchema } from "@/lib/validation/schemas";
import {
  ActionState,
  checkRateLimit,
  errorState,
  getRequestIdentifier,
  successState,
  verifyTurnstile,
  zodFieldErrors,
} from "./helpers";

/**
 * Formulaires publics — traitement 100 % serveur.
 * Ordre des contrôles : honeypot → validation Zod → rate limiting (base)
 * → Turnstile (si configuré) → insertion sous RLS (policy INSERT anon).
 * Le message de succès n'apparaît QUE si le serveur a confirmé l'écriture.
 */

const WHATSAPP_FALLBACK =
  "Le formulaire est momentanément indisponible. Contactez-nous directement sur WhatsApp : +224 662 860 976.";

export async function submitContact(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  // Honeypot : champ caché « website » — rempli uniquement par les bots.
  if ((formData.get("website") ?? "") !== "") {
    return errorState("Requête refusée.");
  }

  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
    subject: formData.get("subject"),
    message: formData.get("message"),
    consent: formData.get("consent") === "on",
    website: formData.get("website") ?? "",
  });
  if (!parsed.success) {
    return errorState("Veuillez corriger les champs signalés.", zodFieldErrors(parsed.error));
  }

  // Rate limiting : 3 messages / heure / IP (état partagé en base).
  const identifier = await getRequestIdentifier();
  const limit = await checkRateLimit("contact", identifier, 3, 3600);
  if (limit === "limited") {
    return errorState("Trop de messages envoyés depuis cette connexion. Réessayez plus tard ou écrivez-nous sur WhatsApp.");
  }

  // Turnstile : vérification réelle uniquement si la clé est configurée.
  const captcha = await verifyTurnstile(formData.get("cf-turnstile-response") as string | undefined);
  if (captcha === "invalid") {
    return errorState("Vérification anti-robot échouée. Réessayez.");
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    // Backend non configuré : message honnête + canal alternatif.
    return errorState(WHATSAPP_FALLBACK);
  }

  const { error } = await supabase.from("contact_messages").insert({
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone ?? null,
    subject: parsed.data.subject,
    message: parsed.data.message,
    ip_hash: identifier,
  });

  if (error) {
    console.error("[actions/public-forms] submitContact :", error.message);
    return errorState(WHATSAPP_FALLBACK);
  }

  return successState("Message bien reçu ! Notre rédaction vous répond dès que possible.");
}

export async function submitPartnership(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  if ((formData.get("website") ?? "") !== "") {
    return errorState("Requête refusée.");
  }

  const parsed = partnershipSchema.safeParse({
    contact_name: formData.get("contact_name"),
    organisation: formData.get("organisation"),
    fonction: formData.get("fonction") ?? "",
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
    service: formData.get("service"),
    message: formData.get("message"),
    budget: formData.get("budget") ?? "",
    timeline: formData.get("timeline") ?? "",
    consent: formData.get("consent") === "on",
    website: formData.get("website") ?? "",
  });
  if (!parsed.success) {
    return errorState("Veuillez corriger les champs signalés.", zodFieldErrors(parsed.error));
  }

  // Rate limiting : 5 demandes / 24 h / IP.
  const identifier = await getRequestIdentifier();
  const limit = await checkRateLimit("partnership", identifier, 5, 86_400);
  if (limit === "limited") {
    return errorState("Trop de demandes envoyées depuis cette connexion. Réessayez demain ou contactez-nous sur WhatsApp.");
  }

  const captcha = await verifyTurnstile(formData.get("cf-turnstile-response") as string | undefined);
  if (captcha === "invalid") {
    return errorState("Vérification anti-robot échouée. Réessayez.");
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return errorState(WHATSAPP_FALLBACK);
  }

  const { error } = await supabase.from("partnership_requests").insert({
    contact_name: parsed.data.contact_name,
    organisation: parsed.data.organisation,
    fonction: parsed.data.fonction ?? null,
    email: parsed.data.email,
    phone: parsed.data.phone ?? null,
    service: parsed.data.service,
    message: parsed.data.message,
    budget: parsed.data.budget || null,
    timeline: parsed.data.timeline ?? null,
    ip_hash: identifier,
  });

  if (error) {
    console.error("[actions/public-forms] submitPartnership :", error.message);
    return errorState(WHATSAPP_FALLBACK);
  }

  revalidatePath("/admin/demandes");
  return successState("Demande envoyée ! Notre équipe commerciale vous recontacte sous 48 h ouvrées.");
}