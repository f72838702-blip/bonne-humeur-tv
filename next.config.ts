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
      "frame-src https://www.youtube-nocookie.com https://challenges.cloudflare.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  },
  { key: "X-Frame-Options", value: "DENY" },
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
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;