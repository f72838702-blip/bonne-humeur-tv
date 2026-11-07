import FlashTicker, { type FlashTickerItem } from "@/components/home/FlashTicker";
import { classifyFlash } from "@/lib/flash/flash-core";
import { getActiveBreakingNews } from "@/lib/data/breaking-news";

/**
 * Bandeau de flash-infos — wrapper SERVEUR (§8) :
 *  • données RÉELLES uniquement (table breaking_news) ;
 *  • RLS publique : seuls les flashs ACTIFS et DANS LEUR PÉRIODE
 *    (start_at <= now <= end_at) sortent de la base — re-vérifié ici par
 *    classFlash de défense (le rendu est re-calculé à chaque requête) ;
 *  • un flash programmé n'apparaît PAS avant son début ; un flash expiré
 *    disparaît dès la requête suivante ; le client (FlashTicker) retire
 *    chaque flash à son heure exacte sans rechargement.
 *  • aucun flash → aucun bandeau (aucun état vide décoratif).
 *
 * headerBehavior (facultatif, fourni par le layout) : rend le bandeau
 * COLLANT au défilement (demande direction 07/11) — collé SOUS un
 * en-tête sticky/compact (top = var(--bhtv-header-h), z-40 sous z-50),
 * ou top 0 si l'en-tête est statique (relative). Le Header et
 * FlashTicker ne sont pas réécrits : les classes de position passent
 * simplement en prop (le comportement des flashs est inchangé).
 */
export default async function BreakingNews({
  headerBehavior,
}: {
  headerBehavior?: string | null;
}) {
  const nowIso = new Date().toISOString();
  const items = (await getActiveBreakingNews()).filter((item) => {
    const state = classifyFlash(nowIso, item.is_active, item.start_at, item.end_at);
    return state === "active" || state === "active_no_expiry";
  });
  if (items.length === 0) return null;

  const tickerItems: FlashTickerItem[] = items.map((item) => ({
    id: item.id,
    content: item.content,
    link: item.link,
    end_at: item.end_at,
    level: item.level,
  }));

  const stickyClass =
    headerBehavior === "static"
      ? "sticky top-0 z-40"
      : "sticky top-[var(--bhtv-header-h)] z-40";

  return <FlashTicker items={tickerItems} stickyClass={stickyClass} />;
}