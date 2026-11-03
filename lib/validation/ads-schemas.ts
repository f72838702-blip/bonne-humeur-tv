import { z } from "zod";
import { isSafeAdUrl, AD_FORMATS, AD_STORED_STATUSES, PAYMENT_METHODS } from "@/lib/ads/ads-core";

/** Tableau mutable pour z.enum (zod 4 : tuple lisible obligatoire). */
const PAYMENT_METHODS_ZOD = ["espèces", "mobile_money", "virement", "chèque", "autre"] as const;

/** URL publicitaire acceptée : http/https uniquement (ads-core). */
const safeAdUrl = z
  .string()
  .trim()
  .min(1)
  .max(2000)
  .refine((v) => isSafeAdUrl(v), "URL invalide (http/https uniquement)");

/** Couleur d'arrière-plan facultative : #rrggbb ou #rgb. */
const bgColor = z
  .union([z.literal(""), z.string().trim().regex(/^(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6})$/, "Couleur invalide")])
  .optional();

/** Texte court optionnel (champ vide = absent). */
const optText = (max: number) => z.string().trim().max(max).optional();

// ─── Payloads PAR FORMAT (validés avant insertion en jsonb) ──────────

export const bannerPayloadSchema = z.object({
  image_url: safeAdUrl,
  image_alt: z.string().trim().min(1, "Texte alternatif obligatoire").max(200),
  title: optText(150),
  description: optText(300),
  cta_text: optText(40),
});

export const cardPayloadSchema = z.object({
  image_url: optSafeAdUrl(),
  image_alt: optText(200),
  logo_url: optSafeAdUrl(),
  title: z.string().trim().min(1, "Titre obligatoire").max(120),
  text: z.string().trim().min(1, "Texte court obligatoire").max(300),
  cta_text: optText(40),
});

function optSafeAdUrl() {
  return z
    .union([z.literal(""), safeAdUrl])
    .optional()
    .transform((v) => (v ? v : undefined));
}

export const videoPayloadSchema = z.object({
  youtube_url: z.string().trim().min(1, "URL YouTube obligatoire").max(500),
  title: z.string().trim().min(1, "Titre obligatoire").max(120),
  description: optText(300),
});

export const promoStripPayloadSchema = z.object({
  message: z.string().trim().min(1, "Message obligatoire").max(200),
  bg_color: bgColor,
  cta_text: optText(40),
});

export const sponsorArticlePayloadSchema = z.object({}).strict();

export const AD_PAYLOAD_SCHEMAS = {
  banner: bannerPayloadSchema,
  card: cardPayloadSchema,
  video: videoPayloadSchema,
  promo_strip: promoStripPayloadSchema,
  sponsor_article: sponsorArticlePayloadSchema,
} as const;

// ─── Annonceurs ──────────────────────────────────────────────────────
export const advertiserSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Nom du annonceur obligatoire (2 caractères minimum)").max(120),
  legal_name: optText(160),
  logo_url: z.union([z.literal(""), safeAdUrl]).optional(),
  sector: optText(80),
  contact_name: optText(120),
  contact_phone: z.string().trim().max(40).regex(/^[0-9+ ()\-.]*$/, "Téléphone invalide").optional(),
  contact_email: z.union([z.literal(""), z.email("E-mail invalide")]).optional(),
  website: z.union([z.literal(""), safeAdUrl]).optional(),
  location: optText(200),
  notes: optText(2000),
  is_active: z.boolean().default(true),
});

/** Recherche annonceurs/campagnes (fiches listes). */
export const adSearchSchema = z.object({
  q: optText(80),
  status: z.union([z.literal(""), z.enum(AD_STORED_STATUSES, { message: "Statut invalide" })]).optional(),
});

// ─── Campagnes ───────────────────────────────────────────────────────
/** Dates saisies datetime-local, interprétées en Conakry (UTC+0 constant). */
const conakryDateTime = (label: string) =>
  z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, `${label} invalide`)]);

export const adCampaignSchema = z.object({
  id: z.string().uuid().optional(),
  advertiser_id: z.string().uuid("Annonceur obligatoire"),
  name: z.string().trim().min(2, "Nom de campagne obligatoire").max(140),
  reference: optText(60),
  description: optText(1500),
  start_at: conakryDateTime("Date de début"),
  end_at: conakryDateTime("Date de fin"),
  billing_type: z.enum(["forfait", "forfait_plus_production"]).default("forfait"),
  amount: z.number().min(0).max(999_999_999_999).nullable().optional(),
  currency: z.string().regex(/^[A-Z]{3}$/, "Devise : 3 lettres").default("GNF"),
  priority: z.number().int().min(0).max(100).default(50),
  commercial_manager: optText(120),
  notes: optText(2000),
  contract_ref: optText(60),
  contract_signed_at: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide")]),
  contract_start_at: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide")]),
  contract_end_at: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide")]),
  contract_terms: optText(2000),
  placements: z.array(z.string().min(2).max(40)).max(12).default([]),
});

// ─── Créations ───────────────────────────────────────────────────────
export const adCreativeSchema = z.object({
  id: z.string().uuid().optional(),
  campaign_id: z.string().uuid("Campagne obligatoire"),
  format: z.enum(AD_FORMATS, { message: "Format publicitaire invalide" }),
  name: z.string().trim().min(2, "Nom de la création obligatoire").max(120),
  weight: z.number().int().min(1).max(20).default(1),
  article_id: z.union([z.literal(""), z.string().uuid()]).optional(),
});

export const adCreativeDecisionSchema = z.object({
  id: z.string().uuid(),
  decision: z.enum(["approved", "refused", "draft"]),
});

// ─── Emplacements ────────────────────────────────────────────────────
export const adPlacementUpdateSchema = z.object({
  code: z.string().min(2).max(60),
  label: z.string().trim().min(2).max(80),
  is_active: z.boolean(),
  max_items: z.number().int().min(1).max(12),
  allowed_formats: z.array(z.enum(["banner", "sponsor_article", "video", "card", "promo_strip"])).min(1, "Au moins un format"),
  devices: z.array(z.enum(["desktop", "mobile"])).min(1, "Au moins un support"),
  sort_order: z.number().int().min(0).max(10000),
});

// ─── Partenaires ─────────────────────────────────────────────────────
export const adPartnerSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Nom du partenaire obligatoire").max(120),
  logo_url: safeAdUrl,
  alt_text: optText(200),
  link_url: z.union([z.literal(""), safeAdUrl]).optional(),
  sort_order: z.number().int().min(0).max(10000).default(100),
  visible_from: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide")]),
  visible_to: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide")]),
  is_active: z.boolean().default(true),
});

// ─── Règlements (ADMIN exclusivement) ────────────────────────────────
export const adPaymentSchema = z.object({
  campaign_id: z.string().uuid("Campagne obligatoire"),
  amount: z.number().min(0.01, "Montant obligatoire").max(999_999_999_999),
  currency: z.string().regex(/^[A-Z]{3}$/, "Devise : 3 lettres").default("GNF"),
  paid_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date de règlement invalide"),
  method: z.enum(PAYMENT_METHODS_ZOD, { message: "Mode de règlement invalide" }),
  transaction_reference: optText(120),
  note: optText(500),
});