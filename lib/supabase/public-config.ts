/**
 * Constantes SÛRES pour le navigateur et l'Edge runtime (uniquement des
 * variables NEXT_PUBLIC_*). Ce module est le SEUL importable par les
 * composants clients et le middleware ; les secrets restent dans
 * lib/supabase/config.ts (serveur applicatif).
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function isSupabaseConfigured(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
}

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

export function isTurnstileConfigured(): boolean {
  return TURNSTILE_SITE_KEY.length > 0;
}