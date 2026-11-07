"use server";

import { revalidatePath } from "next/cache";
import { PURPOSE_VARIANTS, type MediaVariant } from "@/lib/media/variants";
import { uploadMediaVariants } from "@/lib/data/media";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import {
  AD_FORMATS,
  AD_PLACEMENT_CODES,
  canTransition,
  isSafeAdUrl,
  campaignPeriodError,
  toCampaignRow,
  type AdStoredStatus,
} from "@/lib/ads/ads-core";
import {
  SIMPLE_FORMAT_LABELS,
  autoPubliciteName,
  compatiblePlacements,
  computeAdPeriod,
  extendPeriod,
  matchAdvertiserByNormalized,
  resolvePlacements,
  type SimpleAdFormat,
} from "@/lib/ads/simple-ad";
import { parseConakryInput } from "@/lib/flash/flash-core";
import { extractYouTubeId } from "@/lib/youtube/url";
import {
  AD_PAYLOAD_SCHEMAS,
  adCampaignSchema,
  adCreativeDecisionSchema,
  adCreativeSchema,
  adPartnerSchema,
  adPaymentSchema,
  adPlacementUpdateSchema,
  advertiserSchema,
  simpleAdSchema,
} from "@/lib/validation/ads-schemas";
import {
  ActionState,
  errorState,
  formDataBool,
  successState,
  zodFieldErrors,
} from "./helpers";

/**
 * Server Actions de la RÉGIE PUBLICITAIRE.
 * Garde serveur requireRole() AVANT toute écriture ; la RLS (0026) est
 * la dernière barrière. Aucune écriture en service_role ici.
 *
 * Rôles — annonceurs/campagnes/créations/emplacements/partenaires :
 *   admin + editor  ;  paiements : ADMIN exclusivement (0026 en base) ;
 *   validation « approved » d'une créative : ADMIN (RLS + action).
 * Reporter : AUCUN accès à la régie.
 */

const DENIED_MESSAGES: Record<string, string> = {
  unauthenticated: "Connectez-vous pour effectuer cette action.",
  forbidden: "Votre rôle ne permet pas cette action.",
  unconfigured: "Le back-office n'est pas configuré (voir supabase/README-CONFIGURATION.md).",
};

function deniedState(denied: string): ActionState {
  return errorState(DENIED_MESSAGES[denied] ?? "Action refusée.");
}

function num(formData: FormData, key: string): number | null {
  const raw = formData.get(key);
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const n = Number(raw.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

const AD_PATHS = [
  "/admin/publicites",
  "/admin/publicites/nouvelle",
  "/admin/publicites/annonceurs",
  "/admin/publicites/campagnes",
  "/admin/publicites/emplacements",
  "/admin/publicites/partenaires",
  "/admin/publicites/statistiques",
  "/admin/publicites/paiements",
];
function revalidateAds() {
  for (const path of AD_PATHS) revalidatePath(path);
}

function stringOrNull(formData: FormData, key: string): string | undefined {
  const raw = formData.get(key);
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed === "" ? undefined : trimmed;
}

// ═══════════════════════════════════════════════════════════
// ANNONCEURS
// ═══════════════════════════════════════════════════════════

export async function saveAdvertiserAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) return deniedState(guard.denied);

  const parsed = advertiserSchema.safeParse({
    id: stringOrNull(formData, "id"),
    name: formData.get("name"),
    legal_name: stringOrNull(formData, "legal_name"),
    logo_url: stringOrNull(formData, "logo_url"),
    sector: stringOrNull(formData, "sector"),
    contact_name: stringOrNull(formData, "contact_name"),
    contact_phone: stringOrNull(formData, "contact_phone"),
    contact_email: stringOrNull(formData, "contact_email"),
    website: stringOrNull(formData, "website"),
    location: stringOrNull(formData, "location"),
    notes: stringOrNull(formData, "notes"),
    is_active: formDataBool(formData, "is_active"),
  });
  if (!parsed.success) return errorState("Formulaire incomplet.", zodFieldErrors(parsed.error));

  const { data: row, error } = parsed.data.id
    ? await (await getSupabaseServerClient())!
        .from("advertisers")
        .update({ ...stripId(parsed.data), updated_at: new Date().toISOString() })
        .eq("id", parsed.data.id)
        .select("id")
        .single()
    : await (await getSupabaseServerClient())!
        .from("advertisers")
        .insert(stripId(parsed.data))
        .select("id")
        .single();

  if (error) {
    console.error("[actions/ads] saveAdvertiserAction :", error.message);
    return errorState("Enregistrement impossible (vérifiez les champs).");
  }

  revalidateAds();
  return successState(
    parsed.data.id ? "Annonceur modifié." : `Annonceur créé (${row.id.slice(0, 8)}…).`
  );
}

function stripId<T extends { id?: string }>(obj: T): Omit<T, "id"> {
  const clone = { ...obj };
  delete clone.id;
  return clone;
}

export async function deleteAdvertiserAction(formData: FormData): Promise<ActionState> {
  const guard = await requireRole(["admin"]);
  if ("denied" in guard) return deniedState(guard.denied);

  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return errorState("Annonceur introuvable.");

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase!.from("advertisers").delete().eq("id", id);
  if (error) {
    console.error("[actions/ads] deleteAdvertiserAction :", error.message);
    return errorState(
      "Suppression impossible : cet annonceur possède peut-être des campagnes. Désactivez-le plutôt."
    );
  }
  revalidateAds();
  return successState("Annonceur supprimé.");
}

// ═══════════════════════════════════════════════════════════
// CAMPAGNES
// ═══════════════════════════════════════════════════════════

/** Reference auto si vide : BHTV-AAAA-Xxxxxx (contrôle d'unicité SQL final). */
async function ensureUniqueReference(desired: string): Promise<string> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return desired;
  let candidate = desired;
  let suffix = 2;
  while (suffix < 50) {
    const { data } = await supabase
      .from("ad_campaigns")
      .select("id")
      .eq("reference", candidate)
      .limit(1);
    if (!data || data.length === 0) return candidate;
    candidate = `${desired}-${suffix}`;
    suffix += 1;
  }
  return `${desired}-${Date.now()}`;
}

function campaignDates(formData: FormData): { start_at: string | null; end_at: string | null; error?: string; field?: string } {
  const startRaw = String(formData.get("start_at") ?? "");
  const endRaw = String(formData.get("end_at") ?? "");
  if (startRaw.trim() === "" && endRaw.trim() === "") {
    return { start_at: null, end_at: null };
  }
  const startIso = startRaw.trim() === "" ? null : parseConakryInput(startRaw);
  const endIso = endRaw.trim() === "" ? null : parseConakryInput(endRaw);
  if (startRaw.trim() !== "" && !startIso) return { start_at: null, end_at: null, error: "Date de début invalide (format attendu jj/mm/aaaa hh:mm).", field: "start_at" };
  if (endRaw.trim() !== "" && !endIso) return { start_at: null, end_at: null, error: "Date de fin invalide (format attendu jj/mm/aaaa hh:mm).", field: "end_at" };
  const periodError = campaignPeriodError(startIso, endIso);
  if (periodError) return { start_at: null, end_at: null, error: periodError, field: "end_at" };
  return { start_at: startIso, end_at: endIso };
}

export async function saveCampaignAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) return deniedState(guard.denied);

  const placements = formData
    .getAll("placements")
    .map(String)
    .filter((code) => (AD_PLACEMENT_CODES as readonly string[]).includes(code));

  const dates = campaignDates(formData);
  if (dates.error) return errorState(dates.error, { [dates.field ?? "end_at"]: dates.error });

  const parsed = adCampaignSchema.safeParse({
    id: stringOrNull(formData, "id"),
    advertiser_id: formData.get("advertiser_id"),
    name: formData.get("name"),
    reference: stringOrNull(formData, "reference"),
    description: stringOrNull(formData, "description"),
    start_at: dates.start_at ? String(dates.start_at).replace("Z", "").slice(0, 16) : "",
    end_at: dates.end_at ? String(dates.end_at).replace("Z", "").slice(0, 16) : "",
    billing_type: formData.get("billing_type") ?? "forfait",
    amount: num(formData, "amount"),
    currency: String(formData.get("currency") ?? "GNF").toUpperCase(),
    priority: num(formData, "priority") ?? 50,
    commercial_manager: stringOrNull(formData, "commercial_manager"),
    notes: stringOrNull(formData, "notes"),
    contract_ref: stringOrNull(formData, "contract_ref"),
    contract_signed_at: stringOrNull(formData, "contract_signed_at") ?? "",
    contract_start_at: stringOrNull(formData, "contract_start_at") ?? "",
    contract_end_at: stringOrNull(formData, "contract_end_at") ?? "",
    contract_terms: stringOrNull(formData, "contract_terms"),
    placements,
  });
  if (!parsed.success) return errorState("Formulaire incomplet.", zodFieldErrors(parsed.error));

  const values = stripId(parsed.data);
  // Colonne fantôme prévue par le CORRECTIF : `placements` du schéma n'est
  // PAS une colonne de ad_campaigns (table de liaison séparée) — passer par
  // la liste blanche toCampaignRow. Les 3 dates de contrat ne sont pas dans
  // le formulaire : à la MODIFICATION, on ne les touche que si le formulaire
  // en apporte — jamais écraser à null un contrat existant par des champs absents.
  const patch: Record<string, unknown> = { ...values };
  for (const key of ["contract_signed_at", "contract_start_at", "contract_end_at"] as const) {
    if (!patch[key]) delete patch[key];
  }
  const reference = values.reference
    ? await ensureUniqueReference(values.reference)
    : `BHTV-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const row = toCampaignRow({
    ...patch,
    reference,
    start_at: dates.start_at,
    end_at: dates.end_at,
    created_by: guard.session.userId,
  });

  const supabase = await getSupabaseServerClient();
  if (!supabase) return deniedState("unconfigured");

  let campaignId: string;
  if (parsed.data.id) {
    const { data, error } = await supabase
      .from("ad_campaigns")
      .update(row)
      .eq("id", parsed.data.id)
      .select("id")
      .single();
    if (error) {
      console.error("[actions/ads] saveCampaignAction(update) : code =", error.code ?? "?", "message =", error.message);
      return errorState(`Enregistrement de la campagne impossible (erreur ${error.code ?? "inconnue"} — inscrite au journal).`);
    }
    campaignId = data.id;
    // Réécriture des liaisons emplacements (simple et transactionnelle en
    // pratique : la création puis suppression est opérée côté serveur).
    const { error: delErr } = await supabase
      .from("ad_campaign_placements")
      .delete()
      .eq("campaign_id", campaignId);
    if (delErr) {
      console.error("[actions/ads] saveCampaignAction(placements reset) : code =", delErr.code ?? "?", "message =", delErr.message);
      return errorState("Mise à jour des emplacements impossible.");
    }
  } else {
    const { data, error } = await supabase
      .from("ad_campaigns")
      .insert(row)
      .select("id")
      .single();
    if (error) {
      console.error("[actions/ads] saveCampaignAction(insert) : code =", error.code ?? "?", "message =", error.message);
      return errorState(
        error.code === "23503"
          ? "Annonceur introuvable ou inutilisable : vérifiez Annonceurs, il est créé et actif."
          : `Création de la campagne impossible (erreur ${error.code ?? "inconnue"} — inscrite au journal).`
      );
    }
    campaignId = data.id;
  }

  if (placements.length > 0) {
    const links = placements.map((code) => ({ campaign_id: campaignId, placement_code: code }));
    const { error } = await supabase.from("ad_campaign_placements").insert(links);
    if (error) {
      console.error("[actions/ads] saveCampaignAction(placements) : code =", error.code ?? "?", "message =", error.message);
      return errorState("Liaisons d'emplacements impossible.");
    }
  }

  revalidateAds();
  return successState("Campagne enregistrée.");
}

/**
 * Transitions de statut — contrôlées par la machine à états du noyau
 * (canTransition) et la RLS. L'ACTIVATION exige une période complète
 * (début < fin) : une campagne sans dates ne peut jamais diffuser.
 */
export async function changeCampaignStatusAction(formData: FormData): Promise<ActionState> {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) return deniedState(guard.denied);
  const role = guard.session.profile?.role ?? "reporter";

  const id = String(formData.get("id") ?? "");
  const to = String(formData.get("to") ?? "") as AdStoredStatus;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return errorState("Campagne introuvable.");

  const supabase = await getSupabaseServerClient();
  if (!supabase) return deniedState("unconfigured");

  const { data: campaign } = await supabase
    .from("ad_campaigns")
    .select("status, start_at, end_at, name")
    .eq("id", id)
    .maybeSingle();
  if (!campaign) return errorState("Campagne introuvable.");

  if (!canTransition(campaign.status as AdStoredStatus, to, role as "admin" | "editor")) {
    return errorState(`Transition impossible : « ${(campaign.status as string)} » vers « ${to} ».`);
  }

  if (to === "active") {
    if (!campaign.start_at || !campaign.end_at) {
      return errorState("Activez une campagne UNIQUEMENT si début ET fin sont définis.");
    }
    if (Date.parse(campaign.end_at) <= Date.parse(campaign.start_at)) {
      return errorState("Corrigez la période : la fin doit être postérieure au début.");
    }
  }

  const { error } = await supabase
    .from("ad_campaigns")
    .update({ status: to, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("[actions/ads] changeCampaignStatusAction :", error.message);
    return errorState("Changement de statut refusé.");
  }

  revalidateAds();
  revalidatePath("/"); // la diffusion publique se recalcule au prochain rendu
  const labels: Record<AdStoredStatus, string> = {
    draft: "brouillon",
    pending: "en attente de validation",
    active: to === "active" && campaign.start_at && Date.parse(String(campaign.start_at)) > Date.now()
      ? "programmée"
      : "activée",
    suspended: "suspendue",
    completed: "terminée",
    cancelled: "annulée",
    refused: "refusée",
  };
  return successState(
    to === "active"
      ? `Campagne « ${campaign.name} » activée. Diffusion publique : pendant sa période enregistrée (heure serveur).`
      : `Campagne « ${campaign.name} » ${labels[to]}.`
  );
}

export async function deleteCampaignAction(formData: FormData): Promise<ActionState> {
  const guard = await requireRole(["admin"]);
  if ("denied" in guard) return deniedState(guard.denied);

  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return errorState("Campagne introuvable.");

  const { error } = await (await getSupabaseServerClient())!
    .from("ad_campaigns")
    .delete()
    .eq("id", id);
  if (error) {
    console.error("[actions/ads] deleteCampaignAction :", error.message);
    return errorState("Suppression impossible.");
  }
  revalidateAds();
  return successState("Campagne supprimée (avec ses créations, liaisons et règlements).");
}

// ═══════════════════════════════════════════════════════════
// CRÉATIONS PUBLICITAIRES
// ═══════════════════════════════════════════════════════════

/** Payload par format — validation stricte ; le lien passe par ads-core. */
function buildPayload(formData: FormData, format: string): { payload?: Record<string, unknown>; error?: ActionState } {
  if (format === "sponsor_article") {
    return { payload: {} };
  }
  const schema = (AD_PAYLOAD_SCHEMAS as Record<string, (typeof AD_PAYLOAD_SCHEMAS)[keyof typeof AD_PAYLOAD_SCHEMAS]>)[format];
  if (!schema) return { error: errorState("Format inconnu.") };

  const raw: Record<string, string> = {};
  for (const key of ["image_url", "image_alt", "title", "description", "cta_text", "logo_url", "text", "youtube_url", "message", "bg_color"]) {
    const v = formData.get(key);
    if (typeof v === "string") raw[key] = v.trim();
    if (raw[key] === "") raw[key] = key === "message" || key === "text" || key === "title" ? "" : "";
  }

  if (format === "video") {
    const id = extractYouTubeId(String(formData.get("youtube_url") ?? ""));
    if (!id) {
      return { error: errorState("URL YouTube invalide (formes acceptées : youtube.com/watch, youtu.be, shorts, embed).") };
    }
    raw.youtube_url = `https://www.youtube.com/watch?v=${id}`; // forme canonique
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { error: errorState("Création incomplète.", zodFieldErrors(parsed.error)) };
  }
  return { payload: parsed.data as Record<string, unknown> };
}

export async function saveCreativeAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) return deniedState(guard.denied);

  const parsed = adCreativeSchema.safeParse({
    id: stringOrNull(formData, "id"),
    campaign_id: formData.get("campaign_id"),
    format: formData.get("format"),
    name: formData.get("name"),
    weight: num(formData, "weight") ?? 1,
    article_id: stringOrNull(formData, "article_id"),
  });
  if (!parsed.success) return errorState("Création incomplète.", zodFieldErrors(parsed.error));

  const built = buildPayload(formData, parsed.data.format);
  if (built.error) return built.error;

  if (parsed.data.format === "sponsor_article") {
    if (!parsed.data.article_id) {
      return errorState("Choisissez l'article à associer (format Article sponsorisé).");
    }
    const { data: article } = await (await getSupabaseServerClient())!
      .from("articles")
      .select("id")
      .eq("id", parsed.data.article_id)
      .is("deleted_at", null) // corbeille 0035 : ne pas sponsoriser un article trashed
      .maybeSingle();
    if (!article) return errorState("Article introuvable.");
  }

  const row = {
    ...stripId(parsed.data),
    format: parsed.data.format,
    payload: built.payload ?? {},
    article_id: parsed.data.article_id || null,
    created_by: guard.session.userId,
  };

  const supabase = await getSupabaseServerClient();
  const role = guard.session.profile?.role ?? "reporter";

  let error: { message: string } | null = null;
  let updated: boolean = false;
  if (parsed.data.id) {
    // Un éditeur ne modifie PAS une créative déjà approuvée (RLS 0026
    // identique) ; l'admin peut corriger n'importe quelle créative.
    const updateRow = { ...row, updated_at: new Date().toISOString() };
    let query = supabase!.from("ad_creatives").update(updateRow).eq("id", parsed.data.id);
    if (role !== "admin") query = query.eq("status", "draft");
    const { error: updateError, data } = await query.select("id").maybeSingle();
    error = updateError;
    updated = Boolean(data);
    if (!error && !updated) {
      return errorState(
        role === "admin"
          ? "Création introuvable."
          : "Création déjà approuvée : seul un administrateur peut la modifier. Proposez une nouvelle création."
      );
    }
  } else {
    const { error: insertError } = await supabase!.from("ad_creatives").insert(row);
    error = insertError;
  }

  if (error) {
    console.error("[actions/ads] saveCreativeAction :", error.message);
    return errorState("Enregistrement de la création impossible.");
  }

  revalidateAds();
  return successState(parsed.data.id && updated ? "Création modifiée." : "Création créée (brouillon).");
}

/** Validation administrative : approved (admin) / refused / retour brouillon. */
export async function decideCreativeAction(formData: FormData): Promise<ActionState> {
  const guard = await requireRole(["admin"]);
  if ("denied" in guard) return deniedState(guard.denied);

  const parsed = adCreativeDecisionSchema.safeParse({
    id: formData.get("id"),
    decision: formData.get("decision"),
  });
  if (!parsed.success) return errorState("Décision invalide.");

  const update =
    parsed.data.decision === "approved"
      ? { status: "approved" as const, approved_by: guard.session.userId, approved_at: new Date().toISOString() }
      : { status: parsed.data.decision, approved_by: null, approved_at: null };

  const { error } = await (await getSupabaseServerClient())!
    .from("ad_creatives")
    .update(update)
    .eq("id", parsed.data.id);
  if (error) {
    console.error("[actions/ads] decideCreativeAction :", error.message);
    return errorState("Décision refusée.");
  }
  revalidateAds();
  revalidatePath("/");
  return successState(
    parsed.data.decision === "approved"
      ? "Création approuvée : dès activation de la campagne et pendant sa période, elle peut être diffusée."
      : parsed.data.decision === "refused"
        ? "Création refusée."
        : "Création remise en brouillon."
  );
}

// ═══════════════════════════════════════════════════════════
// PUBLICITÉ SIMPLIFIÉE — UN FORMULAIRE = UNE PUBLICATION
// Une SEULE action traduit le formulaire simple en opérations réelles
// (annonceur [existant ou nouveau, sans doublon] → campagne → création
// → liaisons emplacements → approbation/activation). Le payload, la
// période, la machine à états et les validations par format restent
// EXACTEMENT celles du module complet : rien n'est assoupli.
// ═══════════════════════════════════════════════════════════

export async function publishSimpleAdAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) return deniedState(guard.denied);
  const role = guard.session.profile?.role ?? "reporter";
  const supabase = await getSupabaseServerClient();
  if (!supabase) return deniedState("unconfigured");

  const parsed = simpleAdSchema.safeParse({
    submit_mode: String(formData.get("submit_mode") ?? ""),
    advertiser_mode: String(formData.get("advertiser_mode") ?? "existing"),
    advertiser_id: stringOrNull(formData, "advertiser_id") ?? "",
    new_advertiser_name: stringOrNull(formData, "new_advertiser_name"),
    new_advertiser_sector: stringOrNull(formData, "new_advertiser_sector"),
    new_advertiser_contact_name: stringOrNull(formData, "new_advertiser_contact_name"),
    new_advertiser_contact_phone: stringOrNull(formData, "new_advertiser_contact_phone"),
    new_advertiser_contact_email: stringOrNull(formData, "new_advertiser_contact_email"),
    format: String(formData.get("format") ?? ""),
    name: stringOrNull(formData, "name"),
    link_url: stringOrNull(formData, "link_url"),
    placements: formData
      .getAll("placements")
      .map(String)
      .filter((code) => (AD_PLACEMENT_CODES as readonly string[]).includes(code)),
    duration_key: String(formData.get("duration_key") ?? "7j"),
    custom_start_at: stringOrNull(formData, "custom_start_at"),
    custom_end_at: stringOrNull(formData, "custom_end_at"),
    image_url: stringOrNull(formData, "image_url") ?? undefined,
    image_alt: stringOrNull(formData, "image_alt"),
    title: stringOrNull(formData, "title"),
    text: stringOrNull(formData, "text"),
    description: stringOrNull(formData, "description"),
    cta_text: stringOrNull(formData, "cta_text"),
    message: stringOrNull(formData, "message"),
    bg_color: stringOrNull(formData, "bg_color"),
    youtube_url: stringOrNull(formData, "youtube_url"),
    article_id: stringOrNull(formData, "article_id"),
    logo_url: stringOrNull(formData, "logo_url") ?? undefined,
  });
  if (!parsed.success) return errorState("Formulaire incomplet.", zodFieldErrors(parsed.error));
  const form = parsed.data;
  const format = form.format as SimpleAdFormat;

  // ─── Date de destination du lien (http/https revalidé au clic) ───
  const linkUrl = form.link_url && form.link_url !== "" ? form.link_url : null;
  if (linkUrl && !isSafeAdUrl(linkUrl)) {
    return errorState("Lien de destination invalide (http/https uniquement).", { link_url: "URL invalide" });
  }

  // ─── Étape 5 : période depuis la DURÉE (fin calculée SERVEUR) ────
  const customStart = parseConakryInput(form.custom_start_at ?? "");
  const customEnd = parseConakryInput(form.custom_end_at ?? "");
  if (form.custom_start_at && !customStart) {
    return errorState("Date de début personnalisée invalide.", { custom_start_at: "Date invalide" });
  }
  if (form.custom_end_at && !customEnd) {
    return errorState("Date de fin personnalisée invalide.", { custom_end_at: "Date invalide" });
  }
  const nowIso = new Date().toISOString();
  const period = computeAdPeriod(form.duration_key, customStart, customEnd, nowIso);
  if ("error" in period) return errorState(period.error);

  // ─── Étape 1 : annonceur EXISTANT ou NOUVEAU (jamais de doublon) ──
  let advertiserId = form.advertiser_id ?? "";
  let advertiserName = "";
  if (form.advertiser_mode === "new") {
    if (!form.new_advertiser_name || form.new_advertiser_name.trim().length < 2) {
      return errorState("Indiquez le nom de l'entreprise.", { new_advertiser_name: "Nom obligatoire" });
    }
    const existing = await supabase.from("advertisers").select("id, name").limit(200);
    const match = matchAdvertiserByNormalized(
      form.new_advertiser_name,
      (existing.data ?? []) as unknown as { id: string; name: string }[]
    );
    if (match) {
      advertiserId = match.id; // fiche EXISTANTE réutilisée — 0 doublon
      advertiserName = match.name;
    } else {
      const created = await supabase
        .from("advertisers")
        .insert({
          name: form.new_advertiser_name.trim(),
          sector: form.new_advertiser_sector || null,
          contact_name: form.new_advertiser_contact_name || null,
          contact_phone: form.new_advertiser_contact_phone || null,
          contact_email: form.new_advertiser_contact_email || null,
          is_active: true,
        })
        .select("id, name")
        .single();
      if (created.error || !created.data) {
        console.error("[actions/ads] publishSimpleAd(advertiser) :", created.error?.code ?? "?", created.error?.message ?? "");
        return errorState("Création de l'annonceur impossible (erreur inscrite au journal).");
      }
      advertiserId = created.data.id;
      advertiserName = created.data.name;
    }
  } else {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(advertiserId)) {
      return errorState("Choisissez l'entreprise (liste) ou cochez « Nouvel annonceur ».", { advertiser_id: "Obligatoire" });
    }
    const { data } = await supabase.from("advertisers").select("id, name").eq("id", advertiserId).maybeSingle();
    if (!data) {
      return errorState("Annonceur introuvable : choisissez-le dans la liste.", { advertiser_id: "Introuvable" });
    }
    advertiserName = data.name;
  }

  // ─── Carte 6 : logo Partenaire → table ad_partners DÉDIÉE ─────────
  if (format === "partner") {
    const partnerName = form.name?.trim() || advertiserName;
    if (form.logo_url && form.logo_url !== "" && !isSafeAdUrl(form.logo_url)) {
      return errorState("URL du logo invalide (http/https uniquement).", { logo_url: "URL invalide" });
    }
    if (!form.logo_url || form.logo_url === "") {
      return errorState("Le logo est obligatoire (carte « Logo partenaire »).", { logo_url: "Logo obligatoire" });
    }
    if (partnerName.trim().length < 2) return errorState("Nom de l'entreprise obligatoire.");
    const { error } = await supabase.from("ad_partners").insert({
      name: partnerName.trim(),
      logo_url: form.logo_url,
      alt_text: form.image_alt?.trim() || partnerName.trim(),
      link_url: linkUrl,
      sort_order: 100,
      visible_from: period.start_at.slice(0, 10),
      visible_to: period.end_at.slice(0, 10),
      is_active: true,
    });
    if (error) {
      console.error("[actions/ads] publishSimpleAd(partner) :", error.code ?? "?", error.message);
      return errorState(`Ajout du partenaire impossible (erreur ${error.code ?? "inconnue"} — inscrite au journal).`);
    }
    revalidateAds();
    revalidatePath("/");
    return successState(
      form.submit_mode === "publish"
        ? "Partenaire ajouté : son logo apparaît dans l'espace partenaires (≤ 2 min)."
        : "Partenaire enregistré en brouillon : désactivez-le pour le cacher jusqu'à publication."
    );
  }

  // ─── Étape 3 : contenu — validation PAR FORMAT (exacte) ───────────
  if (format === "sponsor_article" && !form.article_id) {
    return errorState("Choisissez l'article à sponsoriser.", { article_id: "Article obligatoire" });
  }
  if (format === "sponsor_article" && form.article_id) {
    const { data: article } = await supabase
      .from("articles")
      .select("id")
      .eq("id", form.article_id)
      .is("deleted_at", null) // corbeille 0035 : ne pas sponsoriser un article trashed
      .maybeSingle();
    if (!article) return errorState("Article introuvable : choisissez-le dans la liste.", { article_id: "Introuvable" });
  }
  const built = buildPayload(formData, format);
  if (built.error) return built.error;
  const payload: Record<string, unknown> = { ...(built.payload ?? {}) };
  if (linkUrl) payload.link_url = linkUrl; // relu en base au clic — jamais rendu dans le DOM

  // ─── Étape 4 : emplacements RÉELLEMENT compatibles (base) ────────
  // Exception : « Article sponsorisé » n'a PAS besoin d'emplacement — il
  // est rendu dans les listes d'actualités avec sa mention (routage
  // indépendant des zones). Les autres formats exigent ≥ 1 emplacement.
  const allPlacements = ((await supabase
    .from("ad_placements")
    .select("code, allowed_formats, is_active")
    .eq("is_active", true)).data ?? []) as unknown as { code: string; allowed_formats: string[]; is_active: boolean }[];

  let chosenPlacements: string[] = [];
  if (format !== "sponsor_article") {
    const compatible = compatiblePlacements(format, allPlacements);
    if (compatible.length === 0) {
      return errorState(
        `Aucun emplacement actif n'autorise aujourd'hui le format « ${SIMPLE_FORMAT_LABELS[format]} » : choisissez un autre format (l'espace partenaire reste disponible) ou faites ajouter l'emplacement par l'administrateur technique.`
      );
    }
    chosenPlacements = resolvePlacements(format, form.placements, allPlacements);
  }

  // ─── Écritures réelles (campagne → création → liaisons) ───────────
  const publicName = form.name?.trim() || autoPubliciteName(advertiserName, format);
  const publishing = form.submit_mode === "publish";
  const reference = `BHTV-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  const campaignRow = toCampaignRow({
    advertiser_id: advertiserId,
    name: publicName,
    reference,
    start_at: period.start_at,
    end_at: period.end_at,
    billing_type: "forfait",
    currency: "GNF",
    priority: 50,
    status: publishing ? "active" : "draft",
    created_by: guard.session.userId,
  });
  const { data: campaign, error: campaignError } = await supabase
    .from("ad_campaigns")
    .insert(campaignRow)
    .select("id")
    .single();
  if (campaignError || !campaign) {
    console.error("[actions/ads] publishSimpleAd(insert campaign) :", campaignError?.code ?? "?", campaignError?.message ?? "");
    return errorState(
      `Création de la campagne impossible (erreur ${campaignError?.code ?? "inconnue"} — inscrite au journal).`
    );
  }
  const campaignId = campaign.id;
  let failed = false;
  let failStep = "";

  const creativeRow: Record<string, unknown> = {
    campaign_id: campaignId,
    format,
    name: publicName,
    payload,
    article_id: form.article_id || null,
    weight: 1,
    created_by: guard.session.userId,
    // Publiée par un ADMIN → créative approuvée immédiatement (contrainte
    // SQL : approved exige approved_by) ; un ÉDITEUR ne peut PAS approuver
    // (RLS 0026) → brouillon, un admin valide le visuel en 1 clic.
    status: publishing && role === "admin" ? "approved" : "draft",
    ...(publishing && role === "admin"
      ? { approved_by: guard.session.userId, approved_at: new Date().toISOString() }
      : {}),
  };
  const { error: creativeError } = await supabase.from("ad_creatives").insert(creativeRow);
  if (creativeError) {
    console.error("[actions/ads] publishSimpleAd(insert creative) :", creativeError.code ?? "?", creativeError.message);
    failed = true;
    failStep = "l'enregistrement du visuel";
  } else if (chosenPlacements.length > 0) {
    const { error: linksError } = await supabase.from("ad_campaign_placements").insert(
      chosenPlacements.map((code) => ({ campaign_id: campaignId, placement_code: code }))
    );
    if (linksError) {
      console.error("[actions/ads] publishSimpleAd(insert links) :", linksError.code ?? "?", linksError.message);
      failed = true;
      failStep = "l'association aux emplacements";
    }
  }

  if (failed) {
    // AUCUNE campagne orpheline : compensation immédiate. L'éditeur ne
    // peut PAS supprimer une campagne (RLS) → le message le dit.
    const { error: cleanupError } = await supabase.from("ad_campaigns").delete().eq("id", campaignId);
    if (cleanupError) {
      console.error("[actions/ads] publishSimpleAd(cleanup) :", cleanupError.code ?? "?", cleanupError.message);
      return errorState(
        `${failStep.charAt(0).toUpperCase() + failStep.slice(1)} a échoué : la campagne n'a PAS été créée en partie exploitable — supprimez « ${publicName} » dans Campagnes puis rejouez le formulaire (erreur inscrite au journal).`
      );
    }
    return errorState(`Publication interrompue (${failStep}) : rien n'a été créé — rejouez le formulaire (erreur inscrite au journal).`);
  }

  revalidateAds();
  revalidatePath("/");
  if (!publishing) {
    return successState("Brouillon enregistré : publiez-le d'un clic depuis la liste des publicités.");
  }
  if (period.start_at !== nowIso && Date.parse(period.start_at) > Date.parse(nowIso)) {
    return successState("Publicité programmée : elle apparaîtra sur le site à partir de sa date de début (≤ 2 min après).");
  }
  if (role !== "admin") {
    return successState(
      "Publicité créée et programmée : un administrateur doit valider votre visuel une fois pour la diffusion (bouton dans la liste)."
    );
  }
  return successState(`Publicité publiée : « ${publicName} » est visible sur le site pendant sa période (≤ 2 min de cache).`);
}

/** Prolongation d'un clic : la fin recule de N jours (expirée → repart de maintenant). */
export async function extendCampaignAction(formData: FormData): Promise<ActionState> {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) return deniedState(guard.denied);

  const id = String(formData.get("id") ?? "");
  const days = Number(formData.get("days"));
  if (!/^[0-9a-f-]{36}$/i.test(id)) return errorState("Publicité introuvable.");
  if (!Number.isInteger(days) || days < 1 || days > 365) return errorState("Durée de prolongation invalide.");

  const supabase = await getSupabaseServerClient();
  if (!supabase) return deniedState("unconfigured");
  const { data: campaign } = await supabase
    .from("ad_campaigns")
    .select("status, start_at, end_at, name")
    .eq("id", id)
    .maybeSingle();
  if (!campaign) return errorState("Publicité introuvable.");

  const updated = extendPeriod(
    { start_at: campaign.start_at, end_at: campaign.end_at },
    days,
    new Date().toISOString()
  );
  const { error } = await supabase
    .from("ad_campaigns")
    .update({ start_at: updated.start_at, end_at: updated.end_at, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("[actions/ads] extendCampaignAction :", error.code ?? "?", error.message);
    return errorState("Prolongation refusée (erreur inscrite au journal).");
  }
  revalidateAds();
  revalidatePath("/");
  return successState(`Publicité « ${campaign.name} » prolongée : diffusera jusqu'au ${updated.end_at.slice(0, 10)}.`);
}


// ═══════════════════════════════════════════════════════════
// EMPLACEMENTS
// ═══════════════════════════════════════════════════════════

export async function updatePlacementAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) return deniedState(guard.denied);

  const parsed = adPlacementUpdateSchema.safeParse({
    code: formData.get("code"),
    label: formData.get("label"),
    is_active: formDataBool(formData, "is_active"),
    max_items: num(formData, "max_items") ?? 1,
    allowed_formats: formData.getAll("allowed_formats").map(String).filter((f) => (AD_FORMATS as readonly string[]).includes(f)),
    devices: formData.getAll("devices").map(String).filter((d) => ["desktop", "mobile"].includes(d)),
    sort_order: num(formData, "sort_order") ?? 100,
  });
  if (!parsed.success) return errorState("Configuration invalide.", zodFieldErrors(parsed.error));

  const { code, ...updates } = parsed.data;
  const { error } = await (await getSupabaseServerClient())!
    .from("ad_placements")
    .update(updates)
    .eq("code", code);
  if (error) {
    console.error("[actions/ads] updatePlacementAction :", error.message);
    return errorState("Configuration refusée.");
  }
  revalidateAds();
  return successState("Emplacement configuré.");
}

// ═══════════════════════════════════════════════════════════
// PARTENAIRES
// ═══════════════════════════════════════════════════════════

export async function savePartnerAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) return deniedState(guard.denied);

  const parsed = adPartnerSchema.safeParse({
    id: stringOrNull(formData, "id"),
    name: formData.get("name"),
    logo_url: formData.get("logo_url"),
    alt_text: stringOrNull(formData, "alt_text"),
    link_url: stringOrNull(formData, "link_url"),
    sort_order: num(formData, "sort_order") ?? 100,
    visible_from: stringOrNull(formData, "visible_from") ?? "",
    visible_to: stringOrNull(formData, "visible_to") ?? "",
    is_active: formDataBool(formData, "is_active"),
  });
  if (!parsed.success) return errorState("Formulaire incomplet.", zodFieldErrors(parsed.error));

  const row = {
    ...stripId(parsed.data),
    visible_from: parsed.data.visible_from || null,
    visible_to: parsed.data.visible_to || null,
  };

  const { error } = parsed.data.id
    ? await (await getSupabaseServerClient())!
        .from("ad_partners")
        .update({ ...row, updated_at: new Date().toISOString() })
        .eq("id", parsed.data.id)
        .select("id")
        .single()
    : await (await getSupabaseServerClient())!
        .from("ad_partners")
        .insert(row)
        .select("id")
        .single();

  if (error) {
    console.error("[actions/ads] savePartnerAction :", error.message);
    return errorState("Enregistrement impossible.");
  }
  revalidateAds();
  return successState(parsed.data.id ? "Partenaire modifié." : "Partenaire ajouté.");
}

export async function deletePartnerAction(formData: FormData): Promise<ActionState> {
  const guard = await requireRole(["admin"]);
  if ("denied" in guard) return deniedState(guard.denied);

  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return errorState("Partenaire introuvable.");
  const { error } = await (await getSupabaseServerClient())!.from("ad_partners").delete().eq("id", id);
  if (error) {
    console.error("[actions/ads] deletePartnerAction :", error.message);
    return errorState("Suppression impossible.");
  }
  revalidateAds();
  return successState("Partenaire supprimé.");
}

// ═══════════════════════════════════════════════════════════
// RÈGLEMENTS MANUELS (ADMIN exclusivement — §9/§11)
// ═══════════════════════════════════════════════════════════

export async function recordPaymentAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const guard = await requireRole(["admin"]);
  if ("denied" in guard) return deniedState(guard.denied);

  const parsed = adPaymentSchema.safeParse({
    campaign_id: formData.get("campaign_id"),
    amount: num(formData, "amount"),
    currency: String(formData.get("currency") ?? "GNF").toUpperCase(),
    paid_on: formData.get("paid_on"),
    method: formData.get("method"),
    transaction_reference: stringOrNull(formData, "transaction_reference"),
    note: stringOrNull(formData, "note"),
  });
  if (!parsed.success) return errorState("Règlement incomplet.", zodFieldErrors(parsed.error));

  const { error } = await (await getSupabaseServerClient())!
    .from("ad_payments")
    .insert({ ...parsed.data, recorded_by: guard.session.userId });
  if (error) {
    console.error("[actions/ads] recordPaymentAction :", error.message);
    return errorState("Enregistrement du règlement impossible.");
  }
  revalidateAds();
  return successState("Règlement enregistré.");
}

export async function deletePaymentAction(formData: FormData): Promise<ActionState> {
  const guard = await requireRole(["admin"]);
  if ("denied" in guard) return deniedState(guard.denied);

  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return errorState("Règlement introuvable.");
  const { error } = await (await getSupabaseServerClient())!.from("ad_payments").delete().eq("id", id);
  if (error) {
    console.error("[actions/ads] deletePaymentAction :", error.message);
    return errorState("Suppression impossible.");
  }
  revalidateAds();
  return successState("Règlement supprimé.");
}

// ═══════════════════════════════════════════════════════════
// IMAGE PUBLICITAIRE — même pipeline médiathèque, dossier « advertising »
// (admin/editor ; compression navigateur + validation signature serveur)
// ═══════════════════════════════════════════════════════════

export async function uploadAdImageAction(formData: FormData): Promise<ActionState> {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) return deniedState(guard.denied);

  const variants: { variant: MediaVariant; file: File }[] = [];
  for (const v of PURPOSE_VARIANTS.advertising) {
    const entry = formData.get(`file_${v}`);
    if (entry instanceof File && entry.size > 0) variants.push({ variant: v, file: entry });
  }
  if (variants.length === 0) {
    return errorState("Aucune image compressée à téléverser.");
  }

  const result = await uploadMediaVariants("advertising", variants);
  if (!result.ok) {
    console.error("[actions/ads] uploadAdImage :", result.error);
    return errorState(
      result.error === "storage_not_configured"
        ? "Le stockage n'est pas configuré (SUPABASE_SERVICE_ROLE_KEY)."
        : `Téléversement refusé : ${result.error}`
    );
  }
  return {
    status: "success",
    message: "Image publicitaire téléversée.",
    data: { url: result.url ?? null, variants: result.variants?.join(" ") ?? null },
  };
}