import Image from "next/image";
import { extractYouTubeId, youtubeThumbnailUrl } from "@/lib/youtube/url";
import type { AdPublicCreative } from "@/lib/types";

/**
 * Mention OBLIGATOIRE sur toute création (§12 — publicité responsable) :
 * baliage visuel « Publicité » / « Sponsorisé » jamais masquable,
 * hors flux éditorial (couleurs et bordure distinctes).
 */
export function AdBadge({ label = "Publicité" }: { label?: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full border border-guinea-yellow/60 bg-guinea-yellow/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-guinea-yellow dark:border-guinea-yellow/40 dark:bg-guinea-yellow/10"
    >
      {label}
    </span>
  );
}

/** Lien de clic — TOUJOURS la route interne /ads/click (§10). */
export function adClickHref(creativeId: string, placement: string): string {
  return `/ads/click/${creativeId}?p=${placement}`;
}

/** Chargeur d'image de bannière strict : http/https seulement. */
export function isRenderableUrl(url: unknown): url is string {
  return typeof url === "string" && /^https?:\/\//i.test(url);
}

// ─── Bannière ────────────────────────────────────────────────────────
export interface BannerPayloadShape {
  image_url?: string;
  image_alt?: string;
  title?: string;
  description?: string;
  cta_text?: string;
}

export function AdBanner({ creative, placement, href }: { creative: AdPublicCreative; placement: string; href?: string }) {
  const payload = (creative.payload ?? {}) as BannerPayloadShape;
  if (!isRenderableUrl(payload.image_url)) return null; // rien à montrer : silence honnête
  const alt = payload.image_alt || payload.title || String(creative.name);

  return (
    <a
      href={href ?? adClickHref(creative.id, placement)}
      rel="sponsored noopener noreferrer"
      className="block overflow-visible"
    >
      <span className="mb-1 block"><AdBadge /></span>
      <Image
        src={payload.image_url}
        alt={alt}
        width={1200}
        height={220}
        loading="lazy"
        unoptimized
        className="w-full rounded-2xl border border-neutral-200 object-cover dark:border-white/10"
      />
      {(payload.cta_text || payload.title) && (
        <span className="mt-1.5 block text-xs font-semibold text-neutral-500 dark:text-neutral-400">
          {payload.title} {payload.cta_text ? `· ${payload.cta_text}` : ""}
        </span>
      )}
    </a>
  );
}

// ─── Carte ───────────────────────────────────────────────────────────
export interface CardPayloadShape {
  image_url?: string;
  logo_url?: string;
  title?: string;
  text?: string;
  cta_text?: string;
}

export function AdCard({ creative, placement, href }: { creative: AdPublicCreative; placement: string; href?: string }) {
  const payload = (creative.payload ?? {}) as CardPayloadShape;
  if (!payload.title) return null;

  return (
    <a
      href={href ?? adClickHref(creative.id, placement)}
      rel="sponsored noopener noreferrer"
      className="group flex items-center gap-4 rounded-2xl border border-dashed border-guinea-yellow/50 bg-white p-4 transition-colors hover:border-guinea-yellow dark:border-guinea-yellow/40 dark:bg-night-800"
    >
      <AdBadge />
      {isRenderableUrl(payload.logo_url || payload.image_url) ? (
        <Image
          src={(payload.logo_url || payload.image_url)!}
          alt={payload.title}
          width={96}
          height={96}
          loading="lazy"
          unoptimized
          className="h-16 w-16 shrink-0 rounded-xl object-cover"
        />
      ) : null}
      <div className="min-w-0">
        <p className="line-clamp-1 font-display text-sm font-bold">{payload.title}</p>
        {payload.text && (
          <p className="mt-0.5 line-clamp-2 text-xs text-neutral-500 dark:text-neutral-400">{payload.text}</p>
        )}
        {payload.cta_text && (
          <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-guinea-red">
            {payload.cta_text}
          </p>
        )}
      </div>
    </a>
  );
}

// ─── Vidéo YouTube (seul hébergeur — pas d'iframe libre, §5) ─────────
export interface VideoPayloadShape {
  youtube_url?: string;
  title?: string;
  description?: string;
}

export function AdVideo({ creative, placement, href }: { creative: AdPublicCreative; placement: string; href?: string }) {
  const payload = (creative.payload ?? {}) as VideoPayloadShape;
  const id = extractYouTubeId(String(payload.youtube_url ?? ""));
  if (!id) return null;

  return (
    <div className="rounded-2xl border border-neutral-200 p-3 dark:border-white/10">
      <div className="flex items-center justify-between">
        <AdBadge />
        {payload.title && (
          <span className="line-clamp-1 text-xs font-semibold dark:text-neutral-300">{payload.title}</span>
        )}
      </div>
      <a
        href={href ?? adClickHref(creative.id, placement)}
        rel="sponsored noopener noreferrer"
        className="mt-2 block"
        aria-label={payload.title || `Vidéo publicitaire : ${creative.name}`}
      >
        <div className="relative aspect-video w-full overflow-hidden rounded-xl">
          <Image
            src={youtubeThumbnailUrl(id, "hq")}
            alt={payload.title || "Miniature de la vidéo publicitaire"}
            fill
            unoptimized
            loading="lazy"
            className="object-cover"
          />
        </div>
        <span className="mt-1.5 block text-[11px] font-bold uppercase tracking-widest text-neutral-400">
          Vidéo sponsorisée — YouTube
        </span>
      </a>
    </div>
  );
}

// ─── Bandeau promotionnel ────────────────────────────────────────────
export interface PromoPayloadShape {
  message?: string;
  bg_color?: string;
  cta_text?: string;
}

const HEX_OK = /^#[0-9a-fA-F]{3}$|#[0-9a-fA-F]{6}$/;

export function PromoStrip({ creative, placement, href }: { creative: AdPublicCreative; placement: string; href?: string }) {
  const payload = (creative.payload ?? {}) as PromoPayloadShape;
  const message = payload.message ? String(payload.message) : "";
  if (!message) return null;
  const inline = payload.bg_color && HEX_OK.test(payload.bg_color) ? { backgroundColor: payload.bg_color } : undefined;

  const inner = (
    <>
      <AdBadge />
      <p className="min-w-0 flex-1 truncate text-sm font-bold text-neutral-900 dark:text-white">{message}</p>
      {payload.cta_text && (
        <span className="rounded-full bg-black/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:bg-white/10 dark:text-white">
          {payload.cta_text}
        </span>
      )}
    </>
  );

  return (
    <div
      className="flex items-center gap-3 rounded-2xl border border-guinea-yellow/50 px-4 py-2.5 dark:border-guinea-yellow/40"
      style={inline}
    >
      {payload.cta_text ? (
        <a href={href ?? adClickHref(creative.id, placement)} rel="sponsored noopener noreferrer" className="flex w-full items-center gap-3">
          {inner}
        </a>
      ) : (
        inner
      )}
    </div>
  );
}

// ─── Article sponsorisé (raccourci vers l'article RÉEL, jamais un faux) ──
export function SponsoredArticleBadge() {
  return <AdBadge label="Sponsorisé" />;
}