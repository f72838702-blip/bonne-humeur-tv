import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { AD_PLACEMENT_CODES, fingerprintOf } from "@/lib/ads/ads-core";
import { getSupabasePublicClient } from "@/lib/supabase/server";

/**
 * Enregistrement d'IMPRESSION — §10 :
 *   - POST JSON { creative_id, placement } depuis AdImpressionTracker
 *     (IntersectionObserver 50 % + déduplication navigateur via
 *     sessionStorage : 1 envoi/jour/créative) ;
 *   - déduplication SERVEUR par empreinte SHA-256(IP|UA|créative|jour
 *     UTC) — l'agrégat journalier n'est incrémenté que si elle est
 *     neuve ; AUCUNE adresse IP brute n'est stockée (purge pg_cron
 *     quotidienne de la table d'empreintes, > 3 jours) ;
 *   - la base refuse le comptage hors diffusion (fail-closed).
 * Réponse minimaliste { counted } — rien d'autre n'est renvoyé.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ counted: false }, { status: 400 });
  }

  const raw = body as { creative_id?: unknown; placement?: unknown };
  const creativeId = typeof raw.creative_id === "string" ? raw.creative_id : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(creativeId)) {
    return NextResponse.json({ counted: false }, { status: 400 });
  }
  const placement =
    typeof raw.placement === "string" &&
    (AD_PLACEMENT_CODES as readonly string[]).includes(raw.placement)
      ? raw.placement
      : null;

  const supabase = getSupabasePublicClient();
  if (!supabase) return NextResponse.json({ counted: false }, { status: 200 });

  // L'empreinte est TOUJOURS calculée serveur — le client n'en propose aucune.
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "inconnu";
  const ua = request.headers.get("user-agent") ?? "";
  const day = new Date().toISOString().slice(0, 10);
  const digest = createHash("sha256")
    .update(`${ip}|${ua}|${creativeId}|${day}`)
    .digest("hex");
  const fingerprint = fingerprintOf(["v1", digest]);

  try {
    const { data, error } = await supabase.rpc("record_ad_event", {
      p_creative: creativeId,
      p_kind: "impression",
      p_placement: placement,
      p_fingerprint: fingerprint,
    });
    if (error) {
      console.error("[ads/track] rpc :", error.message);
      return NextResponse.json({ counted: false }, { status: 200 });
    }
    return NextResponse.json({ counted: data === true }, { status: 200 });
  } catch (error) {
    console.error("[ads/track] exception :", error instanceof Error ? error.message : error);
    return NextResponse.json({ counted: false }, { status: 200 });
  }
}