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
 */
export default async function BreakingNews() {
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

  return <FlashTicker items={tickerItems} />;
}