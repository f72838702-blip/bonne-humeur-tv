"use client";

import { useActionState, useMemo, useState } from "react";
import type { ActionState } from "@/lib/actions/helpers";
import { publishSimpleAdAction, uploadAdImageAction } from "@/lib/actions/ads";
import {
  DEFAULT_DURATION_KEY,
  compatiblePlacements,
  type SimpleAdFormat,
  type SimpleDuration,
} from "@/lib/ads/simple-ad";
import { compressForPurpose } from "@/lib/media/compress";
import {
  FieldError,
  FormMessage,
  SubmitButton,
  idleActionState,
  inputClass,
  labelClass,
} from "./form-ui";

/**
 * Formulaire UNIQUE de création d'une publicité (étapes 1→6, un seul
 * submit « Publier » ou « Brouillon »). Aucune décision d'autorisation
 * ici : le serveur rejoue TOUTES les validations (rôle, annonceur,
 * format, payload par format, période, emplacements compatibles, RLS).
 * Les liens passent TOUJOURS par la validation http/https + la route
 * interne /ads/click.
 */

interface PlacementLite {
  code: string;
  label: string;
  allowed_formats: string[];
  is_active: boolean;
}

interface Props {
  role: "admin" | "editor";
  advertisers: { id: string; name: string; is_active: boolean }[];
  placements: PlacementLite[];
  articles: { id: string; title: string }[];
  formats: { key: SimpleAdFormat; label: string; hint: string }[];
  durations: { key: string; label: string }[];
}

export default function NouvellePubliciteForm({ role, advertisers, placements, articles, formats, durations }: Props) {
  const [state, formAction] = useActionState(publishSimpleAdAction, idleActionState);

  // Étape 1 — annonceur
  const [advMode, setAdvMode] = useState<"existing" | "new">(advertisers.length > 0 ? "existing" : "new");
  const [advId, setAdvId] = useState<string>(advertisers[0]?.id ?? "");
  // Étape 2 — format
  const [format, setFormat] = useState<SimpleAdFormat>("banner");
  // Étape 3 — contenu
  const [imageUrl, setImageUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  // Étape 4 — emplacements (compatibles seulement, précochés)
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [placementsTouched, setPlacementsTouched] = useState(false);
  // Étape 5 — durée
  const [durationKey, setDurationKey] = useState<string>(DEFAULT_DURATION_KEY);

  const isCampaign = format !== "partner";
  const compatible = useMemo(
    () => compatiblePlacements(format, placements).map((p) => p.code),
    [format, placements]
  );
  // Sélection effectivement envoyée : ce que l'utilisateur a coché, sinon
  // TOUS les emplacements compatibles (sélection par défaut raisonnable).
  const effective = placementsTouched
    ? Array.from(chosen).filter((c) => compatible.includes(c))
    : compatible;
  const noCompatiblePlacement = isCampaign && compatible.length === 0;

  const [uploading, setUploading] = useState<"" | "image" | "logo">("");
  const [uploadError, setUploadError] = useState("");

  async function uploadImage(file: File, target: "image" | "logo") {
    setUploadError("");
    setUploading(target);
    try {
      const compressed = await compressForPurpose(file, "advertising");
      if (!compressed) {
        setUploadError("Image illisible : essayez une autre photo (JPG, PNG ou WebP).");
        return;
      }
      const fd = new FormData();
      for (const v of compressed) fd.set(`file_${v.variant}`, v.file);
      const result = await uploadAdImageAction(fd);
      if (result.status !== "success" || !result.data?.url) {
        setUploadError(result.message || "Téléversement impossible.");
        return;
      }
      if (target === "image") setImageUrl(result.data.url);
      else setLogoUrl(result.data.url);
    } catch {
      setUploadError("Téléversement impossible (connexion ?). Réessayez.");
    } finally {
      setUploading("");
    }
  }

  function togglePlacement(code: string) {
    setPlacementsTouched(true);
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }
  return (
    <form action={formAction} className="flex flex-col gap-6">
      {/* ─── ÉTAPE 1 — Entreprise ou annonceur ─── */}
      <Section n={1} title="Entreprise ou annonceur">
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="radio" name="advertiser_mode" value="existing" checked={advMode === "existing"} onChange={() => setAdvMode("existing")} className="h-4 w-4" />
            Une entreprise déjà enregistrée
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="radio" name="advertiser_mode" value="new" checked={advMode === "new"} onChange={() => setAdvMode("new")} className="h-4 w-4" />
            Une nouvelle entreprise
          </label>
        </div>
        {advMode === "existing" ? (
          <div>
            <label className={labelClass} htmlFor="np-adv">Entreprise *</label>
            <select
              id="np-adv"
              name="advertiser_id"
              value={advId}
              onChange={(e) => setAdvId(e.target.value)}
              required
              className={inputClass}
            >
              <option value="">— Choisir dans la liste —</option>
              {advertisers.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}{a.is_active ? "" : " (inactif)"}
                </option>
              ))}
            </select>
            <FieldError errors={state.fieldErrors} name="advertiser_id" />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="np-adv-name">Nom de l&apos;entreprise *</label>
              <input id="np-adv-name" name="new_advertiser_name" maxLength={120} className={inputClass} />
              <FieldError errors={state.fieldErrors} name="new_advertiser_name" />
              <p className="mt-1 text-xs text-neutral-500">
                Si l&apos;entreprise existe déjà (même nom), sa fiche est réutilisée — jamais de doublon.
              </p>
            </div>
            <div>
              <label className={labelClass} htmlFor="np-adv-sector">Secteur (facultatif)</label>
              <input id="np-adv-sector" name="new_advertiser_sector" maxLength={80} className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="np-adv-contact">Contact — nom (facultatif)</label>
              <input id="np-adv-contact" name="new_advertiser_contact_name" maxLength={120} className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="np-adv-phone">Téléphone (facultatif)</label>
              <input id="np-adv-phone" name="new_advertiser_contact_phone" maxLength={40} className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="np-adv-email">E-mail (facultatif)</label>
              <input id="np-adv-email" name="new_advertiser_contact_email" type="email" className={inputClass} />
            </div>
          </div>
        )}
      </Section>

      {/* ─── ÉTAPE 2 — Format publicitaire ─── */}
      <Section n={2} title="Format de la publicité">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {formats.map((f) => (
            <button
              type="button"
              key={f.key}
              onClick={() => { setFormat(f.key); setPlacementsTouched(false); }}
              aria-pressed={format === f.key}
              className={`rounded-2xl border-2 p-4 text-left transition-colors ${
                format === f.key
                  ? "border-guinea-red bg-guinea-red/5"
                  : "border-neutral-200 hover:border-neutral-300 dark:border-white/10 dark:hover:border-white/25"
              }`}
            >
              <FormatIcon format={f.key} />
              <p className="mt-2 text-sm font-extrabold">{f.label}</p>
              <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{f.hint}</p>
            </button>
          ))}
        </div>
        <input type="hidden" name="format" value={format} />
      </Section>

      {/* ─── ÉTAPE 3 — Contenu (s'adapte au format) ─── */}
      <Section n={3} title="Contenu de la publicité">
        {format === "banner" && (
          <div className="grid gap-3">
            <ImageField label="Image de la bannière *" required url={imageUrl} uploading={uploading === "image"} onFile={(f) => uploadImage(f, "image")} onClear={() => setImageUrl("")} name="image_url" hint="Grande image horizontale (ex. 1200×300). Compressée automatiquement." />
            <div>
              <label className={labelClass} htmlFor="np-alt">Texte alternatif (obligatoire — accessibilité) *</label>
              <input id="np-alt" name="image_alt" maxLength={200} className={inputClass} />
              <FieldError errors={state.fieldErrors} name="image_alt" />
            </div>
            <div><TextInput name="title" label="Titre (facultatif)" max={150} /></div>
            <div><TextInput name="cta_text" label="Texte du bouton (facultatif, ex. « Découvrir »)" max={40} /></div>
          </div>
        )}
        {format === "card" && (
          <div className="grid gap-3">
            <ImageField label="Image (facultative)" url={imageUrl} uploading={uploading === "image"} onFile={(f) => uploadImage(f, "image")} onClear={() => setImageUrl("")} name="image_url" />
            <div>
              <label className={labelClass} htmlFor="np-c-title">Titre *</label>
              <input id="np-c-title" name="title" maxLength={120} className={inputClass} />
              <FieldError errors={state.fieldErrors} name="title" />
            </div>
            <div>
              <label className={labelClass} htmlFor="np-c-text">Description courte *</label>
              <textarea id="np-c-text" name="text" maxLength={300} rows={2} className={inputClass} />
              <FieldError errors={state.fieldErrors} name="text" />
            </div>
            <div><TextInput name="cta_text" label="Texte du bouton (facultatif)" max={40} /></div>
          </div>
        )}
        {format === "video" && (
          <div className="grid gap-3">
            <div>
              <label className={labelClass} htmlFor="np-yt">Lien de la vidéo YouTube *</label>
              <input id="np-yt" name="youtube_url" maxLength={500} placeholder="https://www.youtube.com/watch?v=…" className={inputClass} />
              <FieldError errors={state.fieldErrors} name="youtube_url" />
              <p className="mt-1 text-xs text-neutral-500">youtube.com/watch, youtu.be ou Shorts uniquement.</p>
            </div>
            <div>
              <label className={labelClass} htmlFor="np-yt-title">Titre *</label>
              <input id="np-yt-title" name="title" maxLength={120} className={inputClass} />
              <FieldError errors={state.fieldErrors} name="title" />
            </div>
            <div><TextInput name="description" label="Description (facultative)" max={300} area /></div>
          </div>
        )}
        {format === "sponsor_article" && (
          <div className="grid gap-3">
            <div>
              <label className={labelClass} htmlFor="np-article">Article à mettre en avant *</label>
              <select id="np-article" name="article_id" className={inputClass} defaultValue="">
                <option value="">— Choisir un article publié —</option>
                {articles.map((a) => (
                  <option key={a.id} value={a.id}>{a.title}</option>
                ))}
              </select>
              <FieldError errors={state.fieldErrors} name="article_id" />
              <p className="mt-1 text-xs text-neutral-500">
                L&apos;article apparaîtra dans les listes avec la mention « Sponsorisé » (automatique). Les emplacements ne s&apos;appliquent pas à ce format.
              </p>
            </div>
          </div>
        )}
        {format === "promo_strip" && (
          <div className="grid gap-3">
            <div>
              <label className={labelClass} htmlFor="np-msg">Message court *</label>
              <input id="np-msg" name="message" maxLength={200} className={inputClass} />
              <FieldError errors={state.fieldErrors} name="message" />
            </div>
            <div className="flex items-end gap-4">
              <div>
                <label className={labelClass} htmlFor="np-bg">Couleur de fond (facultative)</label>
                <input id="np-bg" name="bg_color" type="color" className="h-10 w-20 rounded-lg border border-neutral-300 bg-transparent dark:border-white/15" />
              </div>
              <div className="flex-1"><TextInput name="cta_text" label="Texte du lien (facultatif)" max={40} /></div>
            </div>
          </div>
        )}
        {format === "partner" && (
          <div className="grid gap-3">
            <ImageField label="Logo de l'entreprise *" required url={logoUrl} uploading={uploading === "logo"} onFile={(f) => uploadImage(f, "logo")} onClear={() => setLogoUrl("")} name="logo_url" hint="Le nom de l'entreprise vient de l'étape 1." />
            <div><TextInput name="image_alt" label="Description du logo (accessibilité, facultative)" max={200} /></div>
          </div>
        )}
        {/* Lien de destination — tous les formats cliqueables sauf article sponsorisé */}
        {format !== "sponsor_article" && (
          <div className="mt-1">
            <label className={labelClass} htmlFor="np-link">Lien de destination (facultatif — https://…)</label>
            <input id="np-link" name="link_url" type="url" maxLength={2000} className={inputClass} />
            <FieldError errors={state.fieldErrors} name="link_url" />
            <p className="mt-1 text-xs text-neutral-500">
              Si renseigné, un clic sur la publicité ouvre ce lien — protégé contre la redirection frauduleuse.
            </p>
          </div>
        )}
        {uploadError && <p className="text-sm font-semibold text-guinea-red">{uploadError}</p>}
      </Section>

      {/* ─── ÉTAPE 4 — Emplacement ─── */}
      {isCampaign && (
        <Section n={4} title="Où afficher la publicité">
          {effective.map((code) => (
            <input key={code} type="hidden" name="placements" value={code} />
          ))}
          {noCompatiblePlacement ? (
            <p className="rounded-xl border border-amber-400/50 bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-400/10 dark:text-amber-200">
              Aucun emplacement actif n&apos;accepte ce format aujourd&apos;hui : la publication sera
              refusée. Choisissez un autre format, ou demandez à l&apos;administrateur technique
              d&apos;autoriser ce format sur un emplacement (Réglages emplacements).
            </p>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                {compatible.map((code) => {
                  const p = placements.find((x) => x.code === code)!;
                  return (
                    <label key={code} className="flex min-h-[44px] items-center gap-3 rounded-xl border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50 dark:border-white/10 dark:hover:bg-white/5">
                      <input type="checkbox" checked={effective.includes(code)} onChange={() => togglePlacement(code)} className="h-5 w-5" />
                      {p.label}
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Précochés : tous les emplacements compatibles avec ce format. Décochage possible.
              </p>
            </>
          )}
        </Section>
      )}

      {/* ─── ÉTAPE 5 — Durée de diffusion ─── */}
      <Section n={5} title={format === "partner" ? "Durée d'affichage du logo" : "Durée de diffusion"}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {durations.map((d: { key: string; label: string }) => (
            <label key={d.key} className={`flex min-h-[44px] cursor-pointer items-center justify-center rounded-xl border-2 px-3 py-2 text-sm font-bold ${
              durationKey === d.key
                ? "border-guinea-red bg-guinea-red/5 text-guinea-red"
                : "border-neutral-200 dark:border-white/10"
            }`}>
              <input type="radio" name="duration_key" value={d.key} checked={durationKey === d.key} onChange={() => setDurationKey(d.key)} className="sr-only" />
              {d.label}
            </label>
          ))}
        </div>
        {durationKey === "libre" && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="np-cs">Début *</label>
              <input id="np-cs" name="custom_start_at" type="datetime-local" className={inputClass} />
              <FieldError errors={state.fieldErrors} name="custom_start_at" />
            </div>
            <div>
              <label className={labelClass} htmlFor="np-ce">Fin (après le début) *</label>
              <input id="np-ce" name="custom_end_at" type="datetime-local" className={inputClass} />
              <FieldError errors={state.fieldErrors} name="custom_end_at" />
            </div>
          </div>
        )}
        {durationKey !== "libre" && (
          <div className="mt-3">
            <label className={labelClass} htmlFor="np-future">Commencer plus tard (facultatif)</label>
            <input id="np-future" name="custom_start_at" type="datetime-local" className={inputClass} />
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Laissez vide pour commencer maintenant (heure de Conakry). La fin est calculée automatiquement.
            </p>
          </div>
        )}
      </Section>

      {/* ─── ÉTAPE 6 — Publication ─── */}
      <Section n={6} title="Enregistrer ou publier">
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            name="submit_mode"
            value="publish"
            disabled={noCompatiblePlacement}
            className="flex-1 rounded-2xl bg-guinea-red px-6 py-4 text-base font-extrabold text-white shadow-md hover:bg-guinea-red/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Publier la publicité
          </button>
          <button
            type="submit"
            name="submit_mode"
            value="draft"
            className="flex-1 rounded-2xl border-2 border-neutral-300 px-6 py-4 text-base font-bold hover:bg-neutral-100 dark:border-white/15 dark:hover:bg-white/10"
          >
            Enregistrer comme brouillon
          </button>
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {role === "admin"
            ? "À la publication (admin) : diffusion effective pendant sa durée, si le visuel est validé automatiquement."
            : "À la publication : un administrateur valide votre visuel en un clic — sans cette validation, rien n'est affiché."}
          {" "}Un brouillon reste privé jusqu&apos;à publication depuis la liste.
        </p>
        <FormMessage state={state} />
      </Section>
    </form>
  );
}

// ─── Petits blocs réutilisables ─────────────────────────────────────
function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-white/10 dark:bg-night-800">
      <h2 className="mb-4 flex items-center gap-3 font-display text-base font-bold">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-guinea-red text-sm font-extrabold text-white">{n}</span>
        {title}
      </h2>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

function TextInput({ name, label, max, area }: { name: string; label: string; max: number; area?: boolean }) {
  return (
    <div>
      <label className={labelClass} htmlFor={`np-${name}`}>{label}</label>
      {area ? (
        <textarea id={`np-${name}`} name={name} maxLength={max} rows={2} className={inputClass} />
      ) : (
        <input id={`np-${name}`} name={name} maxLength={max} className={inputClass} />
      )}
    </div>
  );
}

function ImageField({
  label, required = false, url, uploading, onFile, onClear, name, hint,
}: {
  label: string;
  required?: boolean;
  url: string;
  uploading: boolean;
  onFile: (file: File) => void;
  onClear: () => void;
  name: string;
  hint?: string;
}) {
  const [preview, setPreview] = useState<string>("");
  return (
    <div>
      <label className={labelClass} htmlFor={`np-${name}`}>{label}</label>
      <div className="flex flex-wrap items-center gap-3">
        <input
          id={`np-${name}`}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className={inputClass}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setPreview(URL.createObjectURL(f)); // aperçu immédiat local
            onFile(f);
          }}
        />
        {uploading && <span className="text-xs font-semibold text-neutral-500">Compression et envoi…</span>}
      </div>
      {url && (
        <div className="mt-2 flex items-center gap-3">
          <span className="rounded-lg bg-guinea-green/10 px-2 py-1 text-xs font-bold text-guinea-green">Image téléversée ✔</span>
          <button type="button" onClick={() => { onClear(); setPreview(""); }} className="text-xs font-semibold text-neutral-500 underline">
            Changer d&apos;image
          </button>
        </div>
      )}
      {!url && preview && <span className="mt-1 block text-xs text-neutral-400">Aperçu local — l&apos;image se téléverse automatiquement.</span>}
      {hint && <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{hint}</p>}
      {required && !url && (
        <p className="sr-only">Ce champ est obligatoire.</p>
      )}
    </div>
  );
}

function FormatIcon({ format }: { format: SimpleAdFormat }) {
  const glyphs: Record<SimpleAdFormat, string> = {
    banner: "▬",
    card: "▣",
    video: "▶",
    sponsor_article: "✎",
    promo_strip: "▮",
    partner: "✦",
  };
  return <span aria-hidden className="text-xl">{glyphs[format]}</span>;
}