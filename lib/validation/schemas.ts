import { z } from "zod";
import { isAllowedDuration } from "@/lib/flash/flash-core";

/**
 * Schémas de validation — Zod 4 (>= 4.6.6, corrige GHSA-mrhx-c7xc-m3w5).
 * Utilisés UNIQUEMENT côté serveur (Server Actions) : la validation
 * client n'est jamais considérée comme un contrôle de sécurité.
 */

const trimmed = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, `${label} : ${min} caractères minimum`)
    .max(max, `${label} : ${max} caractères maximum`);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined));

const uuid = z.string().uuid("Identifiant invalide");
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?/, "Date invalide (format attendu : AAAA-MM-JJ)")
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : undefined));

/** Durée de diffusion du menu déroulant — REFUSÉE si absente de la liste
 *  autorisée (une valeur fabriquée dans la requête ne passe jamais). */
const durationMinutes = z
  .number()
  .int("Durée invalide")
  .refine((n) => isAllowedDuration(n), "Durée de diffusion non autorisée");

// ─────────────────────────────────────────────────────────────
// Formulaires publics
// ─────────────────────────────────────────────────────────────
export const contactSchema = z.object({
  name: trimmed(2, 100, "Nom"),
  email: z.email("Adresse email invalide"),
  phone: optionalText(30),
  subject: trimmed(3, 150, "Sujet"),
  message: trimmed(10, 5000, "Message"),
  consent: z.boolean().refine((v) => v === true, {
    message: "Vous devez accepter le traitement de vos données",
  }),
  /** Honeypot anti-spam : doit rester VIDE (rempli par les bots). */
  website: z.string().max(0, "Rejeté").optional().or(z.literal("")),
});

export const partnershipSchema = z.object({
  contact_name: trimmed(2, 100, "Nom du contact"),
  organisation: trimmed(2, 150, "Organisation"),
  fonction: optionalText(100),
  email: z.email("Adresse email invalide"),
  phone: optionalText(30),
  service: z.enum(["couverture", "interview", "production", "digitale", "autre"], {
    message: "Choisissez une prestation",
  }),
  message: trimmed(10, 5000, "Description"),
  budget: z
    .enum(["lt5m", "5-15m", "15-50m", "gt50m", "unknown"])
    .optional()
    .or(z.literal("")),
  timeline: optionalText(100),
  consent: z.boolean().refine((v) => v === true, {
    message: "Vous devez accepter le traitement de vos données",
  }),
  website: z.string().max(0, "Rejeté").optional().or(z.literal("")),
});

// ─────────────────────────────────────────────────────────────
// Authentification
// ─────────────────────────────────────────────────────────────
export const loginSchema = z.object({
  email: z.email("Adresse email invalide"),
  password: trimmed(8, 128, "Mot de passe"),
});

// ─────────────────────────────────────────────────────────────
// CMS : articles
// ─────────────────────────────────────────────────────────────
export const ARTICLE_STATUSES = ["draft", "review", "scheduled", "published", "archived"] as const;

export const articleSchema = z.object({
  id: uuid.optional(),
  title: trimmed(5, 200, "Titre"),
  slug: optionalText(96),
  excerpt: optionalText(400),
  content: trimmed(1, 100_000, "Contenu"),
  featured_image: optionalText(500),
  featured_image_alt: optionalText(300),
  category_id: uuid.optional().or(z.literal("").transform(() => undefined)),
  status: z.enum(ARTICLE_STATUSES, { message: "Statut invalide" }),
  scheduled_at: isoDate,
  meta_title: optionalText(200),
  meta_description: optionalText(300),
  is_featured: z.boolean().default(false),
  tags: z.array(trimmed(2, 40, "Tag")).max(10, "10 tags maximum").default([]),
});

export const deleteArticleSchema = z.object({ id: uuid });

// ─────────────────────────────────────────────────────────────
// CMS : vidéos — YouTube UNIQUEMENT (directive §1) : l'identifiant
// provient soit d'une URL YouTube validée strictement (watch/youtu.be/
// embed/live), soit d'un ID brut sur 11 caractères. Toute autre source
// est refusée. Aucune vidéo n'est jamais hébergée sur nos serveurs.
// ─────────────────────────────────────────────────────────────
export const VIDEO_STATUSES = ["draft", "published", "archived"] as const;

export const videoSchema = z.object({
  id: uuid.optional(),
  title: trimmed(3, 200, "Titre"),
  slug: optionalText(96),
  description: optionalText(2000),
  /** ID brut (11 caractères) OU URL YouTube complète — l'action extrait
   *  et valide l'identifiant ; une source externe arbitraire est refusée.
   *  Défense en profondeur : si un ID brut est fourni, il doit déjà être
   *  au format exact YouTube (11 caractères alphanumériques/_/-). */
  youtube_id: optionalText(11).refine(
    (v) => v === undefined || /^[A-Za-z0-9_-]{11}$/.test(v),
    "ID YouTube invalide (11 caractères attendus)"
  ),
  youtube_url: optionalText(300),
  thumbnail_url: optionalText(500),
  category_id: uuid.optional().or(z.literal("").transform(() => undefined)),
  duration: optionalText(10),
  published_at: isoDate,
  status: z.enum(VIDEO_STATUSES, { message: "Statut invalide" }),
  is_featured: z.boolean().default(false),
  /** Un direct doit être RÉELLEMENT vérifié par la rédaction avant activation. */
  is_live: z.boolean().default(false),
  /** Position d'épinglage sur l'accueil (0 = ordre chronologique). */
  position: z.coerce.number().int().min(0).max(999).default(0),
});

export const deleteVideoSchema = z.object({ id: uuid });

// ─────────────────────────────────────────────────────────────
// CMS : flash-infos, catégories, rôles, demandes
// ─────────────────────────────────────────────────────────────
export const breakingNewsSchema = z.object({
  id: uuid.optional(),
  content: trimmed(5, 200, "Texte"),
  link: optionalText(300),
  is_active: z.boolean().default(true),
  start_at: isoDate,
  end_at: isoDate,
  position: z.number().int().min(0).max(999).default(0),
  /** Niveau éditorial — exige la migration 0024 (colonne level). */
  level: z
    .enum(["normal", "important", "urgent"], { message: "Niveau invalide" })
    .default("normal"),
  /** Minutes de diffusion — figurant DANS la liste autorisée uniquement. */
  duration_minutes: durationMinutes.nullable().optional(),
});

export const deleteBreakingNewsSchema = z.object({ id: uuid });

/** Prolongation / réactivation d'un flash (§7) : durée de la liste
 *  autorisée uniquement, mode contrôlé côté serveur. */
export const flashRenewSchema = z.object({
  id: uuid,
  mode: z.enum(["extend", "reactivate"], { message: "Action invalide" }),
  duration_minutes: durationMinutes,
});
export type FlashRenewInput = z.infer<typeof flashRenewSchema>;

export const categorySchema = z.object({
  id: uuid.optional(),
  name: trimmed(2, 60, "Nom"),
  slug: optionalText(60),
  description: optionalText(200),
});

export const deleteCategorySchema = z.object({ id: uuid });

export const permissionsList = z
  .array(z.enum(["articles", "articles_publier", "articles_tous", "videos", "flash", "directs", "publicite", "publicite_approuver", "consultation"]))
  .max(9)
  .default([]);

/**
 * Rôles attribuables par l'application : éditeur/reporter SEULEMENT.
 * Le rôle super_admin est UNIQUE et n'est jamais créable depuis
 * l'interface (le compte admin historique conserve son usage interne).
 * Aucun Super Administrateur supplémentaire ne peut être créé.
 */
export const assignableRole = z.enum(["editor", "reporter"], { message: "Rôle invalide" });

export const roleChangeSchema = z.object({
  profile_id: uuid,
  role: assignableRole,
});

export const inviteUserSchema = z.object({
  email: z.email("Adresse email invalide"),
  full_name: trimmed(2, 100, "Nom complet"),
  role: assignableRole,
});

// ─────────────────────────────────────────────────────────────
// CRÉATION DIRECTE D'UN GESTIONNAIRE (Super Administrateur) :
// email facultatif (si vide → identifiant@gestion.bonnehumeur.info
// généré côté serveur — lib/auth/manager-account) ; le mot de passe
// provisoire ne quitte jamais le serveur (jamais stocké, jamais logué).
// ─────────────────────────────────────────────────────────────
export const createManagerSchema = z
  .object({
    full_name: trimmed(2, 100, "Nom complet"),
    identifiant: z.string().trim().max(64).optional(),
    email: z.union([z.email("Adresse email invalide"), z.literal("")]).optional(),
    password: trimmed(10, 128, "Mot de passe"),
    password_confirm: trimmed(10, 128, "Confirmation"),
  })
  .refine((d) => d.password === d.password_confirm, {
    message: "Les deux mots de passe ne concordent pas.",
    path: ["password_confirm"],
  });

export const requestStatusSchema = z.object({
  type: z.enum(["partnership", "contact"]),
  id: uuid,
  status: z.enum(["new", "processing", "treated"]),
  admin_note: optionalText(1000),
});

/** Suppression d'une demande/message — ADMIN UNIQUEMENT (côté action). */
export const requestDeleteSchema = z.object({
  type: z.enum(["partnership", "contact"]),
  id: uuid,
});

/**
 * Envoyer une réponse à une demande/message — ADMIN UNIQUEMENT (côté action).
 * Le destinataire n'est PAS dans le schéma : il est lu depuis la base côté
 * serveur — impossible d'envoyer à une adresse arbitraire via le formulaire.
 */
export const sendReplySchema = z.object({
  type: z.enum(["partnership", "contact"]),
  id: uuid,
  body: trimmed(2, 10000, "Réponse"),
});

export type ContactInput = z.infer<typeof contactSchema>;
export type PartnershipInput = z.infer<typeof partnershipSchema>;
export type ArticleInput = z.infer<typeof articleSchema>;
export type VideoInput = z.infer<typeof videoSchema>;
export type BreakingNewsInput = z.infer<typeof breakingNewsSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;