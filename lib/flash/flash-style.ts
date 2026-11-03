/**
 * Apparences du bandeau public par NIVEAU (flash-infos) — source unique
 * partagée par la prévisualisation admin et le bandeau public.
 */
import type { FlashLevel } from "@/lib/flash/flash-core";

export interface BannerStyle {
  /** Classes du bandeau (fond + texte). */
  band: string;
  /** Libellé affiché dans le CMS. */
  label: string;
  /** Puce colorée du CMS. */
  dot: string;
}

export const FLASH_BANNER_STYLES: Record<FlashLevel, BannerStyle> = {
  normal: {
    band: "bg-night-900 text-white",
    label: "Normal",
    dot: "bg-neutral-400",
  },
  important: {
    band: "bg-guinea-yellow text-black",
    label: "Important",
    dot: "bg-guinea-yellow",
  },
  urgent: {
    band: "bg-guinea-red text-white",
    label: "Urgent",
    dot: "bg-guinea-red",
  },
};