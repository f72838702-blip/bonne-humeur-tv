"use client";

import { useActionState, useState } from "react";
import type { ActionState } from "@/lib/actions/helpers";
import {
  saveAdvertiserAction,
  saveCampaignAction,
  saveCreativeAction,
  updatePlacementAction,
  savePartnerAction,
  recordPaymentAction,
  changeCampaignStatusAction,
  decideCreativeAction,
  extendCampaignAction,
} from "@/lib/actions/ads";
import {
  AD_DEVICES,
  AD_FORMATS,
  AD_FORMAT_LABELS,
  AD_PLACEMENT_CODES,
  AD_PLACEMENT_LABELS,
  AD_STATE_LABELS,
  allowedTransitions,
  type AdDevice,
  type AdFormat,
  type AdPlacementCode,
  type AdStoredStatus,
} from "@/lib/ads/ads-core";
import type { Advertiser, AdCampaign, AdCreative, AdPartner, AdPlacement } from "@/lib/types";
import {
  FieldError,
  FormMessage,
  SubmitButton,
  idleActionState,
  inputClass,
  labelClass,
} from "./form-ui";

/**
 * Formulaires de la régie publicitaire (client). Aucune décision
 * d'autorisation ici : chaque action serveur revalide rôle, payload,
 * machine à états — l'UI ne propose que des boutons cohérents.
 */

// ─── Utilitaires ─────────────────────────────────────────────────────
function dv(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

/** Timestamptz ISO → valeur datetime-local (Conakry = UTC+0 constant). */
function toDateTimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 16);
}

// ─── Annonceurs ──────────────────────────────────────────────────────
export function AdvertiserForm({ item }: { item?: Advertiser }) {
  const [state, formAction] = useActionState(saveAdvertiserAction, idleActionState);
  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      {item && <input type="hidden" name="id" value={item.id} />}
      <div>
        <label className={labelClass} htmlFor="adv-name">Nom commercial *</label>
        <input id="adv-name" name="name" defaultValue={dv(item?.name)} maxLength={120} required className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="adv-legal">Raison sociale</label>
        <input id="adv-legal" name="legal_name" defaultValue={dv(item?.legal_name)} maxLength={160} className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="adv-logo">Logo (URL)</label>
        <input id="adv-logo" name="logo_url" defaultValue={dv(item?.logo_url)} className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="adv-sector">Secteur</label>
        <input id="adv-sector" name="sector" defaultValue={dv(item?.sector)} maxLength={80} className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="adv-contact">Contact (nom)</label>
        <input id="adv-contact" name="contact_name" defaultValue={dv(item?.contact_name)} maxLength={120} className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="adv-phone">Téléphone</label>
        <input id="adv-phone" name="contact_phone" defaultValue={dv(item?.contact_phone)} maxLength={40} className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="adv-email">E-mail</label>
        <input id="adv-email" name="contact_email" type="email" defaultValue={dv(item?.contact_email)} className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="adv-website">Site web</label>
        <input id="adv-website" name="website" defaultValue={dv(item?.website)} className={inputClass} />
      </div>
      <div className="sm:col-span-2">
        <label className={labelClass} htmlFor="adv-location">Localisation / adresse</label>
        <input id="adv-location" name="location" defaultValue={dv(item?.location)} maxLength={200} className={inputClass} />
      </div>
      <div className="sm:col-span-2">
        <label className={labelClass} htmlFor="adv-notes">Notes internes</label>
        <textarea id="adv-notes" name="notes" defaultValue={dv(item?.notes)} maxLength={2000} rows={3} className={inputClass} />
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" name="is_active" defaultChecked={item ? item.is_active : true} className="h-4 w-4" />
        Annonceur actif
      </label>
      <div className="sm:col-span-2 flex flex-col gap-3">
        <div>
          <SubmitButton label={item ? "Enregistrer l'annonceur" : "Créer l'annonceur"} />
        </div>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

// ─── Campagnes ───────────────────────────────────────────────────────
export function CampaignForm({
  advertisers,
  item,
  selectedPlacements = [],
}: {
  advertisers: Pick<Advertiser, "id" | "name" | "is_active">[];
  item?: AdCampaign;
  selectedPlacements?: string[];
}) {
  const [state, formAction] = useActionState(saveCampaignAction, idleActionState);
  // Garde CLIENT : la fin ne peut pas précéder le début (attribut min du
  // sélecteur) — la validation UNIQUE reste campaignPeriodError côté serveur.
  const [startValue, setStartValue] = useState<string>(toDateTimeLocal(item?.start_at));
  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      {item && <input type="hidden" name="id" value={item.id} />}
      <div>
        <label className={labelClass} htmlFor="camp-adv">Annonceur *</label>
        <select id="camp-adv" name="advertiser_id" defaultValue={dv(item?.advertiser_id)} required className={inputClass}>
          <option value="">— Choisir —</option>
          {advertisers.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}{a.is_active ? "" : " (inactif)"}
            </option>
          ))}
        </select>
        <FieldError errors={state.fieldErrors} name="advertiser_id" />
      </div>
      <div>
        <label className={labelClass} htmlFor="camp-name">Nom de la campagne *</label>
        <input id="camp-name" name="name" defaultValue={dv(item?.name)} maxLength={140} required className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="camp-ref">Référence (auto si vide)</label>
        <input id="camp-ref" name="reference" defaultValue={dv(item?.reference)} maxLength={60} className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="camp-priority">Priorité (0-100, 50 par défaut)</label>
        <input id="camp-priority" name="priority" type="number" min={0} max={100} defaultValue={dv(item?.priority ?? 50)} className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="camp-start">Début de diffusion (Conakry, optionnel)</label>
        <input
          id="camp-start"
          name="start_at"
          type="datetime-local"
          defaultValue={startValue}
          onChange={(e) => setStartValue(e.target.value)}
          className={inputClass}
        />
        <FieldError errors={state.fieldErrors} name="start_at" />
      </div>
      <div>
        <label className={labelClass} htmlFor="camp-end">Fin de diffusion (Conakry, optionnelle)</label>
        <input
          id="camp-end"
          name="end_at"
          type="datetime-local"
          defaultValue={toDateTimeLocal(item?.end_at)}
          min={startValue || undefined}
          className={inputClass}
        />
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Doit être postérieure au début — vérifiez l&#39;HEURE, pas seulement le jour.
        </p>
        <FieldError errors={state.fieldErrors} name="end_at" />
      </div>
      <div>
        <label className={labelClass} htmlFor="camp-billing">Facturation</label>
        <select id="camp-billing" name="billing_type" defaultValue={dv(item?.billing_type) || "forfait"} className={inputClass}>
          <option value="forfait">Forfait</option>
          <option value="forfait_plus_production">Forfait + production</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass} htmlFor="camp-amount">Montant</label>
          <input id="camp-amount" name="amount" type="number" min={0} step={0.01} defaultValue={dv(item?.amount)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="camp-currency">Devise</label>
          <input id="camp-currency" name="currency" defaultValue={dv(item?.currency) || "GNF"} maxLength={3} className={inputClass} />
        </div>
      </div>
      <div>
        <label className={labelClass} htmlFor="camp-manager">Responsable commercial</label>
        <input id="camp-manager" name="commercial_manager" defaultValue={dv(item?.commercial_manager)} maxLength={120} className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="camp-notes">Notes internes</label>
        <input id="camp-notes" name="notes" defaultValue={dv(item?.notes)} maxLength={2000} className={inputClass} />
      </div>

      <fieldset className="sm:col-span-2 rounded-2xl border border-neutral-200 p-4 dark:border-white/10">
        <legend className={labelClass}>Emplacements de diffusion</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {AD_PLACEMENT_CODES.map((code) => (
            <label key={code} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="placements"
                value={code}
                defaultChecked={selectedPlacements.includes(code)}
                className="h-4 w-4"
              />
              {AD_PLACEMENT_LABELS[code as AdPlacementCode]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="sm:col-span-2 flex flex-col gap-3">
        <div>
          <SubmitButton label={item ? "Enregistrer la campagne" : "Créer la campagne"} />
        </div>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

// ─── Créations ───────────────────────────────────────────────────────
const FORMAT_OPTIONS: AdFormat[] = [...AD_FORMATS];

export function CreativeForm({
  campaignId,
  articleOptions = [],
  item,
}: {
  campaignId: string;
  articleOptions: { id: string; title: string }[];
  item?: AdCreative;
}) {
  const [state, formAction] = useActionState(saveCreativeAction, idleActionState);
  const format = (item?.format ?? "banner") as AdFormat;
  const p = (item?.payload ?? {}) as Record<string, unknown>;
  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      {item && <input type="hidden" name="id" value={item.id} />}
      <input type="hidden" name="campaign_id" value={campaignId} />
      <div>
        <label className={labelClass} htmlFor="cr-name">Nom de la création *</label>
        <input id="cr-name" name="name" defaultValue={dv(item?.name)} maxLength={120} required className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="cr-format">Format *</label>
        <select id="cr-format" name="format" defaultValue={format} required className={inputClass}>
          {FORMAT_OPTIONS.map((f) => (
            <option key={f} value={f}>{AD_FORMAT_LABELS[f]}</option>
          ))}
        </select>
      </div>

      <div className="sm:col-span-2">
        <label className={labelClass} htmlFor="cr-image">Image (URL — via Médiathèque, dossier Publicités)</label>
        <input
          id="cr-image" name="image_url"
          defaultValue={dv(p.image_url)}
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="cr-alt">Texte alternatif obligatoire (bannière)</label>
        <input id="cr-alt" name="image_alt" defaultValue={dv(p.image_alt)} maxLength={200} className={inputClass} />
        <FieldError errors={state.fieldErrors} name="image_alt" />
      </div>
      <div>
        <label className={labelClass} htmlFor="cr-title">Titre</label>
        <input id="cr-title" name="title" defaultValue={dv(p.title)} maxLength={150} className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="cr-text">Texte (carte)</label>
        <input id="cr-text" name="text" defaultValue={dv(p.text)} maxLength={300} className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="cr-cta">Texte du bouton</label>
        <input id="cr-cta" name="cta_text" defaultValue={dv(p.cta_text)} maxLength={40} className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="cr-message">Message (bandeau promotionnel)</label>
        <input id="cr-message" name="message" defaultValue={dv(p.message)} maxLength={200} className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="cr-bg">Couleur de fond (#RRGGBB)</label>
        <input id="cr-bg" name="bg_color" defaultValue={dv(p.bg_color)} maxLength={7} className={inputClass} />
      </div>

      <div className="sm:col-span-2">
        <label className={labelClass} htmlFor="cr-youtube">
          URL de la vidéo YouTube (SEULE source acceptée — youtube.com/watch, youtu.be, shorts)
        </label>
        <input id="cr-youtube" name="youtube_url" defaultValue={dv(p.youtube_url)} maxLength={500} className={inputClass} />
        <FieldError errors={state.fieldErrors} name="youtube_url" />
      </div>

      <div>
        <label className={labelClass} htmlFor="cr-article">Article à sponsoriser (format « Article sponsorisé »)</label>
        <select id="cr-article" name="article_id" defaultValue={dv(item?.article_id)} className={inputClass}>
          <option value="">— Aucun —</option>
          {articleOptions.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass} htmlFor="cr-weight">Poids dans la rotation (1-20)</label>
        <input id="cr-weight" name="weight" type="number" min={1} max={20} defaultValue={dv(item?.weight ?? 1)} className={inputClass} />
      </div>

      <div className="sm:col-span-2 flex flex-col gap-3">
        <div>
          <SubmitButton label={item ? "Enregistrer la création" : "Créer la création (brouillon)"} />
        </div>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

/** Décision d'approbation — boutons proposés UNIQUEMENT aux admins (RLS aussi). */
async function decisionWrapper(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return decideCreativeAction(formData);
}

export function CreativeDecisionButtons({ creativeId }: { creativeId: string }) {
  const [state, formAction] = useActionState(decisionWrapper, idleActionState);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={formAction}>
        <input type="hidden" name="id" value={creativeId} />
        <input type="hidden" name="decision" value="approved" />
        <SubmitButton label="Approuver" pendingLabel="Validation…" variant="success" />
      </form>
      <form action={formAction}>
        <input type="hidden" name="id" value={creativeId} />
        <input type="hidden" name="decision" value="refused" />
        <SubmitButton label="Refuser" pendingLabel="Application…" variant="danger" />
      </form>
      {state.status !== "idle" && <FormMessage state={state} />}
    </div>
  );
}

/** Boutons de transition de statut (machine à états côté serveur). */
export function StatusActions({
  campaignId,
  status,
  role,
}: {
  campaignId: string;
  status: AdStoredStatus;
  role: "admin" | "editor";
}) {
  const [state, formAction] = useActionState(
    async (_prev: ActionState, formData: FormData) => changeCampaignStatusAction(formData),
    idleActionState
  );
  const targets = allowedTransitions(status, role);
  return (
    <div className="flex flex-wrap items-center gap-3">
      {targets.map((to) => (
        <form key={to} action={formAction}>
          <input type="hidden" name="id" value={campaignId} />
          <input type="hidden" name="to" value={to} />
          <SubmitButton
            label={TRANSITION_LABELS[to]}
            pendingLabel="Application…"
            variant={to === "active" ? "success" : to === "cancelled" || to === "refused" ? "danger" : "neutral"}
          />
        </form>
      ))}
      {state.status !== "idle" && <FormMessage state={state} />}
    </div>
  );
}

const TRANSITION_LABELS: Record<AdStoredStatus, string> = {
  draft: "Revenir en brouillon",
  pending: "Proposer (en attente)",
  active: "ACTIVER (diffusion possible)",
  suspended: "Suspendre",
  completed: "Marquer terminée",
  cancelled: "Annuler la campagne",
  refused: "Refuser",
};

// ─── Liste simplifiée : actions directes d'une ligne ─────────────────
/** Suspendre ou Reprendre d'un clic (même action durcie, même machine à états). */
export function SimpleStatusButton({ adId, to, label }: { adId: string; to: "active" | "suspended"; label: string }) {
  const [state, formAction] = useActionState(
    async (_prev: ActionState, formData: FormData) => changeCampaignStatusAction(formData),
    idleActionState
  );
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={adId} />
      <input type="hidden" name="to" value={to} />
      <SubmitButton label={label} pendingLabel="Application…" />
      {state.status === "error" && <span className="ml-2 text-xs font-semibold text-guinea-red">{state.message}</span>}
    </form>
  );
}

/** Prolonger d'un clic : durée choisie dans la liste (fin = max(maintenant, fin) + N jours). */
export function ExtendControl({ adId }: { adId: string }) {
  const [state, formAction] = useActionState(
    async (_prev: ActionState, formData: FormData) => extendCampaignAction(formData),
    idleActionState
  );
  return (
    <form action={formAction} className="flex items-center gap-1.5">
      <input type="hidden" name="id" value={adId} />
      <select name="days" defaultValue="7" aria-label="Durée de prolongation" className="rounded-lg border border-neutral-300 bg-transparent px-2 py-1.5 text-xs dark:border-white/15">
        {DURATION_DAYS.map((d) => (
          <option key={d} value={d}>{d} j</option>
        ))}
      </select>
      <SubmitButton label="Prolonger" pendingLabel="…" />
      {state.status === "error" && <span className="text-xs font-semibold text-guinea-red">{state.message}</span>}
    </form>
  );
}

const DURATION_DAYS = [1, 3, 7, 15, 30, 60, 90];

// ─── Emplacements ────────────────────────────────────────────────────
export function PlacementForm({ item }: { item: AdPlacement }) {
  const [state, formAction] = useActionState(updatePlacementAction, idleActionState);
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="code" value={item.code} />
      <div>
        <label className={labelClass} htmlFor={`pl-label-${item.code}`}>Libellé</label>
        <input id={`pl-label-${item.code}`} name="label" defaultValue={item.label} maxLength={80} className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass} htmlFor={`pl-max-${item.code}`}>Créations max</label>
          <input id={`pl-max-${item.code}`} name="max_items" type="number" min={1} max={12} defaultValue={item.max_items} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor={`pl-order-${item.code}`}>Ordre d&#39;affichage</label>
          <input id={`pl-order-${item.code}`} name="sort_order" type="number" min={0} max={10000} defaultValue={item.sort_order} className={inputClass} />
        </div>
      </div>
      <fieldset className="sm:col-span-2">
        <legend className={labelClass}>Formats autorisés</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {FORMAT_OPTIONS.map((f) => (
            <label key={f} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                name="allowed_formats"
                value={f}
                defaultChecked={item.allowed_formats.includes(f)}
                className="h-3.5 w-3.5"
              />
              {AD_FORMAT_LABELS[f]}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="sm:col-span-2">
        <legend className={labelClass}>Supports cibles</legend>
        <div className="flex gap-5">
          {AD_DEVICES.map((d: AdDevice) => (
            <label key={d} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                name="devices"
                value={d}
                defaultChecked={item.devices.includes(d)}
                className="h-3.5 w-3.5"
              />
              {d === "desktop" ? "Ordinateur" : "Mobile"}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" name="is_active" defaultChecked={item.is_active} className="h-4 w-4" />
        Emplacement actif
      </label>
      <div className="sm:col-span-2 flex flex-col gap-2">
        <div><SubmitButton label="Enregistrer" pendingLabel="Enregistre…" /></div>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

// ─── Partenaires ─────────────────────────────────────────────────────
export function PartnerForm({ item }: { item?: AdPartner }) {
  const [state, formAction] = useActionState(savePartnerAction, idleActionState);
  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      {item && <input type="hidden" name="id" value={item.id} />}
      <div>
        <label className={labelClass} htmlFor="pt-name">Nom *</label>
        <input id="pt-name" name="name" defaultValue={dv(item?.name)} maxLength={120} required className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="pt-logo">URL du logo *</label>
        <input id="pt-logo" name="logo_url" defaultValue={dv(item?.logo_url)} required className={inputClass} />
        <FieldError errors={state.fieldErrors} name="logo_url" />
      </div>
      <div>
        <label className={labelClass} htmlFor="pt-alt">Texte alternatif</label>
        <input id="pt-alt" name="alt_text" defaultValue={dv(item?.alt_text)} maxLength={200} className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="pt-link">Lien (http/https, optionnel)</label>
        <input id="pt-link" name="link_url" defaultValue={dv(item?.link_url)} className={inputClass} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass} htmlFor="pt-order">Ordre</label>
          <input id="pt-order" name="sort_order" type="number" min={0} max={10000} defaultValue={dv(item?.sort_order ?? 100)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="pt-from">Visible dès</label>
          <input id="pt-from" name="visible_from" type="date" defaultValue={dv(item?.visible_from)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="pt-to">Visible jusqu&#39;au</label>
          <input id="pt-to" name="visible_to" type="date" defaultValue={dv(item?.visible_to)} className={inputClass} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" name="is_active" defaultChecked={item ? item.is_active : true} className="h-4 w-4" />
        Partenaire actif
      </label>
      <div className="sm:col-span-2 flex flex-col gap-3">
        <div><SubmitButton label={item ? "Enregistrer" : "Ajouter"} /></div>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

// ─── Règlements (ADMIN) ──────────────────────────────────────────────
export function PaymentForm({ campaignId }: { campaignId: string }) {
  const [state, formAction] = useActionState(recordPaymentAction, idleActionState);
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="campaign_id" value={campaignId} />
      <div>
        <label className={labelClass} htmlFor="pay-amount">Montant reçu *</label>
        <input id="pay-amount" name="amount" type="number" min={0.01} step={0.01} required className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="pay-currency">Devise</label>
        <input id="pay-currency" name="currency" defaultValue="GNF" maxLength={3} className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="pay-date">Encaissé le *</label>
        <input id="pay-date" name="paid_on" type="date" required className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="pay-method">Mode *</label>
        <select id="pay-method" name="method" required className={inputClass}>
          <option value="espèces">Espèces</option>
          <option value="mobile_money">Mobile Money</option>
          <option value="virement">Virement</option>
          <option value="chèque">Chèque</option>
          <option value="autre">Autre</option>
        </select>
      </div>
      <div>
        <label className={labelClass} htmlFor="pay-ref">Référence transaction</label>
        <input id="pay-ref" name="transaction_reference" maxLength={120} className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="pay-note">Note</label>
        <input id="pay-note" name="note" maxLength={500} className={inputClass} />
      </div>
      <div className="sm:col-span-2 flex flex-col gap-2">
        <div><SubmitButton label="Enregistrer le règlement" /></div>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function StatusLabel({ status }: { status: string }) {
  const label = (AD_STATE_LABELS as Record<string, string>)[status] ?? status;
  return (
    <span className="inline-flex rounded-full bg-neutral-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase text-neutral-500">
      {label}
    </span>
  );
}