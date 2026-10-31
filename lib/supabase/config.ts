/**
 * Configuration Supabase partagée (serveur applicatif).
 * Les variables NEXT_PUBLIC_* sont volontairement publiques (clé anon + RLS) ;
 * la clé service_role n'est JAMAIS exposée au navigateur (cf. lib/supabase/admin.ts).
 * Les composants clients et le middleware importent public-config.ts, pas ce fichier.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function isSupabaseConfigured(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
}

/**
 * Clé secrète Turnstile (Cloudflare) — optionnelle.
 * Si absente, les formulaires fonctionnent sans vérification captcha
 * (protection par rate limiting + honeypot) et l'état est documenté.
 */
export const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY ?? "";
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

export function isTurnstileConfigured(): boolean {
  return TURNSTILE_SECRET_KEY.length > 0 && TURNSTILE_SITE_KEY.length > 0;
}