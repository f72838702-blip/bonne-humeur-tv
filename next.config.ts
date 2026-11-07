import type { NextConfig } from "next";

/**
 * En-têtes de sécurité appliqués à toutes les réponses (Phase B).
 *
 * CSP — périmètre réel du site :
 *   • default-src 'self'
 *   • scripts : 'self' + 'unsafe-inline' (scripts d'hydratation Next.js ;
 *     les limitations sont documentées dans le rapport final — pas de
 *     balise script tierce hors Turnstile)
 *   • styles : 'self' 'unsafe-inline' (Tailwind + styles critiques Next)
 *   • images : YouTube (miniatures réelles) + Supabase Storage (médiathèque)
 *   • frames : YouTube no-cookie uniquement (lecteur embarqué)
 *   • Turnstile : challenges.cloudflare.com (captcha optionnel)
 */
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://i.ytimg.com https://img.youtube.com https://*.supabase.co",
      "media-src 'self'",
      "font-src 'self'",
      "connect-src 'self' https://challenges.cloudflare.com https://*.supabase.co",
      "frame-src 'self' https://www.youtube-nocookie.com https://challenges.cloudflare.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      // 'self' requis : l'aperçu du Studio (iframe INTERNE /studio-preview)
      // est une frame de même origine — les sites tiers restent bannis.
      "frame-ancestors 'self'",
    ].join("; "),
  },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  /**
   * Server Actions : le défaut Next.js (1 Mo) est TROP PETIT pour le lot
   * d'une couverture complète (full ≤ 600 Ko + card ≤ 300 Ko + thumb
   * ≤ 200 Ko ≈ 1,1 Mo de FormData) — au-delà, la requête est rejetée
   * AVANT d'atteindre l'action : l'image n'atteint jamais le bucket et
   * la couverture ne peut jamais être liée à l'article. Limite portée à
   * 3 Mo (plafond absolu bucket 2 Mo PAR fichier — aucun dépassement du
   * quota Storage ; aucune ressource payante).
   */
  experimental: {
    serverActions: {
      bodySizeLimit: "3mb",
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "img.youtube.com" },
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // PWA (Phase 5/6) : AUCUN cache — ni navigateur, ni réseau — pour
      // le back-office (pages privées, brouillons, assistant IA) et les
      // API (réponses sensibles/Supabase). Le service worker, lui, ne
      // met déjà RIEN en cache (public/sw.js — réseau seul).
      {
        source: "/admin/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;