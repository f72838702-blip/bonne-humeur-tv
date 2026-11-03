import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * Configuration Cloudflare Workers — Bonne Humeur TV.
 * Branche : deploy/cloudflare-staging — fusion UNIQUEMENT après validation.
 *
 * Config minimale (sans cache R2 — l'offre Free n'expose pas de bucket persistant
 * sans configuration additionnelle) : les rendus ISR sont recalculés par le Worker.
 */
export default defineCloudflareConfig();