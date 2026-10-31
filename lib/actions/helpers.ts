import { createHash } from "crypto";
import { headers } from "next/headers";
import { slugify } from "@/lib/utils";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Helpers partagés par les Server Actions.
 */

/** Résultat standard renvoyé aux formulaires (useActionState). */
export interface ActionState {
  status: "idle" | "success" | "error";
  message: string;
  /** Erreurs par champ (clés = noms des champs du formulaire). */
  fieldErrors?: Record<string, string>;
  /** Données optionnelles (ex : URL de redirection). */
  redirectTo?: string;
}

export const idleState: ActionState = { status: "idle", message: "" };

export function errorState(message: string, fieldErrors?: Record<string, string>): ActionState {
  return { status: "error", message, fieldErrors };
}

export function successState(message: string, redirectTo?: string): ActionState {
  return { status: "success", message, redirectTo };
}

/** Transforme une erreur Zod en dictionnaire champ → message. */
export function zodFieldErrors(error: { issues: { path: PropertyKey[]; message: string }[] }): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** IP cliente (Vercel) hachée : aucune donnée personnelle en clair en base. */
export async function getRequestIdentifier(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim() || headerList.get("x-real-ip") || "inconnu";
  return createHash("sha256").update(`bhtv::${ip}`).digest("hex").slice(0, 40);
}

/**
 * Rate limiting serveur via la fonction check_rate_limit (0003) :
 * la BASE est l'état partagé → fiable en serverless.
 * Retourne :
 *   - "allowed"  : requête acceptée
 *   - "limited"  : quota atteint (requête refusée)
 *   - "degraded" : protection indisponible (service_role absent) —
 *                  le traitement continue SANS limite, état documenté.
 */
export async function checkRateLimit(
  formType: "contact" | "partnership",
  identifier: string,
  maxRequests: number,
  windowSeconds: number
): Promise<"allowed" | "limited" | "degraded"> {
  const { getSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const admin = getSupabaseAdminClient();
  if (!admin) return "degraded";

  const { data, error } = await admin.rpc("check_rate_limit", {
    p_form_type: formType,
    p_identifier: identifier,
    p_max_requests: maxRequests,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("[actions/helpers] check_rate_limit :", error.message);
    return "degraded";
  }
  return data === true ? "allowed" : "limited";
}

/**
 * Vérification Turnstile (Cloudflare) — réelle si TURNSTILE_SECRET_KEY
 * est configurée ; sinon la protection est documentée comme inactive.
 */
export async function verifyTurnstile(token: string | undefined): Promise<"ok" | "invalid" | "inactive"> {
  const secret = process.env.TURNSTILE_SECRET_KEY ?? "";
  if (!secret) return "inactive";
  if (!token) return "invalid";

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ secret, response: token }),
  });
  const outcome = (await res.json()) as { success: boolean };
  return outcome.success ? "ok" : "invalid";
}

/**
 * Slug unique : suffixe incrémental si déjà pris (contrôle d'unicité final
 * garanti par la contrainte SQL).
 */
export async function ensureUniqueSlug(
  table: "articles" | "videos" | "categories",
  desired: string,
  excludeId?: string
): Promise<string> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return desired;

  let candidate = desired;
  let suffix = 2;
  // Boucle bornée : en cas de course, la contrainte SQL unique produira
  // une erreur explicite côté action.
  while (suffix < 50) {
    let query = supabase.from(table).select("id").eq("slug", candidate).limit(1);
    if (excludeId) query = query.neq("id", excludeId);
    const { data } = await query;
    if (!data || data.length === 0) return candidate;
    candidate = `${desired}-${suffix}`;
    suffix += 1;
  }
  return `${desired}-${Date.now()}`;
}

/** Slugifie un titre en préservant un slug saisi manuellement. */
export function slugFromTitleOrInput(title: string, slugInput?: string): string {
  const manual = (slugInput ?? "").trim();
  return slugify(manual.length >= 3 ? manual : title);
}

/** Booléen depuis FormData (checkbox). */
export function formDataBool(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  return value === "on" || value === "true" || value === "1";
}

/** Tableau (tags séparés par virgules) depuis FormData. */
export function formDataTags(formData: FormData): string[] {
  const raw = formData.get("tags");
  if (typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .slice(0, 10);
}