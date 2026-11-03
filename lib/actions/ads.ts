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
  type AdStoredStatus,
} from "@/lib/ads/ads-core";
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

function campaignDates(formData: FormData): { start_at: string | null; end_at: string | null; error?: string } {
  const startRaw = String(formData.get("start_at") ?? "");
  const endRaw = String(formData.get("end_at") ?? "");
  if (startRaw.trim() === "" && endRaw.trim() === "") {
    return { start_at: null, end_at: null };
  }
  const startIso = startRaw.trim() === "" ? null : parseConakryInput(startRaw);
  const endIso = endRaw.trim() === "" ? null : parseConakryInput(endRaw);
  if (startRaw.trim() !== "" && !startIso) return { start_at: null, end_at: null, error: "Date de début invalide" };
  if (endRaw.trim() !== "" && !endIso) return { start_at: null, end_at: null, error: "Date de fin invalide" };
  if (startIso && endIso && Date.parse(endIso) <= Date.parse(startIso)) {
    return { start_at: null, end_at: null, error: "La date de fin doit être postérieure à la date de début" };
  }
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
  if (dates.error) return errorState(dates.error, { start_at: dates.error });

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
  const reference = values.reference
    ? await ensureUniqueReference(values.reference)
    : `BHTV-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const row = {
    ...values,
    reference,
    start_at: dates.start_at,
    end_at: dates.end_at,
    contract_signed_at: values.contract_signed_at || null,
    contract_start_at: values.contract_start_at || null,
    contract_end_at: values.contract_end_at || null,
    created_by: guard.session.userId,
  };

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
      console.error("[actions/ads] saveCampaignAction(update) :", error.message);
      return errorState("Enregistrement impossible.");
    }
    campaignId = data.id;
    // Réécriture des liaisons emplacements (simple et transactionnelle en
    // pratique : la création puis suppression est opérée côté serveur).
    const { error: delErr } = await supabase
      .from("ad_campaign_placements")
      .delete()
      .eq("campaign_id", campaignId);
    if (delErr) {
      console.error("[actions/ads] saveCampaignAction(placements reset) :", delErr.message);
      return errorState("Mise à jour des emplacements impossible.");
    }
  } else {
    const { data, error } = await supabase
      .from("ad_campaigns")
      .insert(row)
      .select("id")
      .single();
    if (error) {
      console.error("[actions/ads] saveCampaignAction(insert) :", error.message);
      return errorState("Création impossible (annonceur invalide ?).");
    }
    campaignId = data.id;
  }

  if (placements.length > 0) {
    const links = placements.map((code) => ({ campaign_id: campaignId, placement_code: code }));
    const { error } = await supabase.from("ad_campaign_placements").insert(links);
    if (error) {
      console.error("[actions/ads] saveCampaignAction(placements) :", error.message);
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