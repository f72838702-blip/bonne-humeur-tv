import { createHash } from "crypto";
import {
  classifyBrowser,
  classifyDevice,
  classifyReferrer,
  capEngagement,
  isBotUserAgent,
  toCountryIso2,
  type Browser,
  type Device,
  type ReferrerClass,
} from "@/lib/analytics/classes";
import { rpcEngagement, rpcInsertPageView } from "@/lib/analytics/queries";

/**
 * Endpoint de collecte (dans le Worker Cloudflare, via OpenNext) — anonyme :
 *
 *  • NE RENVOIE JAMAIS de détail : 204 silencieux (échec = rien, les stats
 *    ne cassent jamais le site) ;
 *  • le PAYS vient de request.cf.country (Cloudflare, gratuit — l'IP n'est
 *    JAMAIS stockée) ;
 *  • appareil/navigateur/provenance classifiés ICI (le navigateur ne décide
 *    de rien) depuis les en-têtes réels ;
 *  • empreinte = sha256("bhtv::analytics::" + IP + UA + jour UTC) — anti-abus
 *    uniquement (rotée chaque jour), motif ad_event_fingerprints 0025 ;
 *  • bots : refusés silencieusement (UA connus ou vides) ;
 *  • le plafond d'événements (240/h/empreinte) vit DANS la fonction SQL.
 *
 * Aucun secret n'expose ici : la clé anon est publique et la RPC SQL
 * valide/limite tout en dernier ressort.
 */

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PATH_RE = /^\/[^\s#?]{0,1998}$/;

/** request.cf.country — disponible dans le Worker OpenNext, null ailleurs. */
async function cloudflareCountry(): Promise<string | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = getCloudflareContext();
    const cf = (ctx as { cf?: { country?: unknown } }).cf;
    return toCountryIso2(typeof cf?.country === "string" ? cf.country : null);
  } catch {
    return null; // environnement non-Workers (build/validation) : inconnu
  }
}

function analyticsFingerprint(ip: string, ua: string): string {
  const day = new Date().toISOString().slice(0, 10); // roté chaque jour UTC
  return createHash("sha256")
    .update(`bhtv::analytics::${day}::${ip}::${ua}`)
    .digest("hex")
    .slice(0, 48);
}

interface TrackBody {
  t?: string;
  sid?: string;
  eid?: string;
  path?: string;
  ms?: number;
  tz?: number;
}

function sanitizeTz(tz: unknown): number | null {
  if (typeof tz !== "number" || !Number.isFinite(tz)) return null;
  const value = Math.round(tz);
  return value >= -840 && value <= 840 ? value : null;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const ua = request.headers.get("user-agent") ?? "";
    if (isBotUserAgent(ua)) return new Response(null, { status: 204 });

    let body: TrackBody;
    try {
      // sendBeacon envoi application/json (Blob typé) ; on accepte une
      // charge utile stricte et bornée, rien d'autre.
      body = (await request.json()) as TrackBody;
    } catch {
      return new Response(null, { status: 204 });
    }

    const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "inconnu";
    const fingerprint = analyticsFingerprint(ip, ua.slice(0, 300));
    const referrer: ReferrerClass = classifyReferrer(request.headers.get("referer"));

    // ── page view
    if (body.t === "pv") {
      const path = typeof body.path === "string" ? body.path.slice(0, 2000) : "";
      if (!UUID_RE.test(body.sid ?? "") || !UUID_RE.test(body.eid ?? "")) {
        return new Response(null, { status: 204 });
      }
      if (!PATH_RE.test(path) || path.startsWith("/admin")) {
        return new Response(null, { status: 204 });
      }
      const device: Device = classifyDevice(ua);
      const browser: Browser = classifyBrowser(ua);
      const country = await cloudflareCountry();
      await rpcInsertPageView({
        sessionId: body.sid as string,
        eventId: body.eid as string,
        path,
        device,
        browser,
        countryIso2: country,
        referrerClass: referrer,
        tzOffsetMinutes: sanitizeTz(body.tz),
        fingerprint,
      });
      return new Response(null, { status: 204 });
    }

    // ── engagement (temps réellement VISIBLE, cumulé, monotone côté SQL)
    if (body.t === "eng") {
      if (!UUID_RE.test(body.eid ?? "")) return new Response(null, { status: 204 });
      const ms = capEngagement(typeof body.ms === "number" ? body.ms : 0);
      if (ms <= 0) return new Response(null, { status: 204 });
      await rpcEngagement({ eventId: body.eid as string, engagedMs: ms, fingerprint });
      return new Response(null, { status: 204 });
    }

    return new Response(null, { status: 204 });
  } catch {
    // Toute l'analytics est à l'épreuve des échecs : réponse silencieuse.
    return new Response(null, { status: 204 });
  }
}