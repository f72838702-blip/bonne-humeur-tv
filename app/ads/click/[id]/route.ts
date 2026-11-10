import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { AD_PLACEMENT_CODES, fingerprintOf, isSafeAdUrl } from "@/lib/ads/ads-core";
import { getPublicAdLink } from "@/lib/data/ads-public";
import { getSupabasePublicClient } from "@/lib/supabase/server";

/**
 * Route de CLIC publicitaire — §10 :
 *   - la destination ne vient JAMAIS d'un paramètre URL (anti
 *     open-redirect) : elle est relue EN BASE par get_public_ad_link,
 *     qui ne la rend que pour une créative effectivement diffusée
 *     (approuvée + campagne active en période) ;
 *   - revalidation RÉELLE du schéma côté route (audit M6) : isSafeAdUrl
 *     impose http/https — une écriture hors application de link_url ne
 *     peut pas servir de redirect (fail-closed → accueil) ;
 *   - le clic ne compte qu'uniquement si l'empreinte est neuve
 *     (1 clic max par navigateur/jour/créative, aucune IP brute).
 * Non diffusable → renvoi neutre vers la page d'accueil (302).
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.redirect(new URL("/", request.url), 302);
  }

  const placement =
    (AD_PLACEMENT_CODES as readonly string[]).includes(
      request.nextUrl.searchParams.get("p") ?? ""
    )
      ? request.nextUrl.searchParams.get("p")!
      : null;

  const link = await getPublicAdLink(id);
  // Revalidation de la destination (fail-closed) : schéma http/https UNIQUEMENT.
  if (!link || !isSafeAdUrl(link)) {
    return NextResponse.redirect(new URL("/", request.url), 302);
  }

  // Comptage best-effort : une erreur ne bloque JAMAIS la navigation.
  try {
    const forwarded = request.headers.get("x-forwarded-for") ?? "";
    const ip = forwarded.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "inconnu";
    const ua = request.headers.get("user-agent") ?? "";
    const day = new Date().toISOString().slice(0, 10);
    const digest = createHash("sha256")
      .update(`${ip}|${ua}|${id}|${day}`)
      .digest("hex");
    const fingerprint = fingerprintOf(["v1", digest]);
    const supabase = await getSupabasePublicClient();
    if (supabase) {
      await supabase.rpc("record_ad_event", {
        p_creative: id,
        p_kind: "clic",
        p_placement: placement,
        p_fingerprint: fingerprint,
      });
    }
  } catch (error) {
    console.error("[ads/click] comptage (non bloquant) :", error instanceof Error ? error.message : error);
  }

  return NextResponse.redirect(link, 302);
}