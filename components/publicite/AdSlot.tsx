import { getAdZone, getSponsoredArticle } from "@/lib/data/ads-public";
import { type AdPlacementCode } from "@/lib/ads/ads-core";
import type { AdPublicCreative } from "@/lib/types";
import AdImpressionTracker from "./AdImpressionTracker";
import {
  AdBanner,
  AdCard,
  AdVideo,
  PromoStrip,
} from "./AdVisuals";
import SponsoredArticleCard from "./SponsoredArticleCard";

/**
 * Zone publicitaire — composant SERVEUR (aucun polling, rendu ISR) :
 *   1. lit la zone par son code stable via get_public_ad_zone (SECURITY
 *      DEFINER — les liens sortants ne quittent JAMAIS la base) ;
 *   2. applique la rotation déterministe (fenêtre de 5 min) ;
 *   3. rend chaque création selon son format, entourée de son traceur
 *      d'impression et de sa mention « Publicité » (§12).
 * Zone vide / emplacement inactif : ne rend RIEN (jamais un bloc vide).
 */

interface Props {
  code: AdPlacementCode;
  className?: string;
}

export default async function AdSlot({ code, className }: Props) {
  const zone = await getAdZone(code);
  if (!zone || zone.creatives.length === 0) return null;

  return (
    <div className={className ?? "my-6"}>
      {zone.creatives.map((creative) => (
        <AdImpressionTracker key={creative.id} creativeId={creative.id} placement={code}>
          <CreativeRenderer creative={creative} placement={code} />
        </AdImpressionTracker>
      ))}
    </div>
  );
}

async function CreativeRenderer({ creative, placement }: { creative: AdPublicCreative; placement: string }) {
  if (creative.format === "sponsor_article") {
    return <SponsoredArticleCard creative={creative} placement={placement} />;
  }
  if (creative.format === "banner") {
    return <AdBanner creative={creative} placement={placement} />;
  }
  if (creative.format === "card") {
    return <AdCard creative={creative} placement={placement} />;
  }
  if (creative.format === "video") {
    return <AdVideo creative={creative} placement={placement} />;
  }
  if (creative.format === "promo_strip") {
    return <PromoStrip creative={creative} placement={placement} />;
  }
  return null;
}