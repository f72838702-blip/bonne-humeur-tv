"use client";

import { useActionState, useMemo, useState } from "react";
import type { ActionState } from "@/lib/actions/helpers";
import { publishSimpleAdAction, uploadAdImageAction } from "@/lib/actions/ads";
import {
  DEFAULT_DURATION_KEY,
  compatiblePlacements,
  type SimpleAdFormat,
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
 * UNE PUBLICITÉ = 4 ÉTAPES = PUBLIER.
 * 1. Que veux-tu publier ?  2. Ajouter la publicité (entreprise + contenu)
 * 3. Où et combien de temps ?  4. Aperçu + PUBLIER MA PUBLICITÉ.
 * Aucun terme technique : campagne, création, UUID, payload n'apparaissent
 * JAMAIS. Le serveur (publishSimpleAdAction) fait tout le reste — mêmes
 * validations dures, RLS intacte, jamais service_role.
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

  // Étape 1 — format
  const [format, setFormat] = useState<SimpleAdFormat>("banner");
  // Étape 2 — entreprise + contenu
  const [advMode, setAdvMode] = useState<"existing" | "new">(advertisers.length > 0 ? "existing" : "new");
  const [advId, setAdvId] = useState<string>(advertisers[0]?.id ?? "");
  const [advName, setAdvName] = useState<string>("");
  const [imageUrl, setImageUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [titleValue, setTitleValue] = useState("");
  const [textValue, setTextValue] = useState("");
  const [messageValue, setMessageValue] = useState("");
  const [bgColor, setBgColor] = useState("");
  const [ctaValue, setCtaValue] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  // Étape 3 — où et combien de temps
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [placementsTouched, setPlacementsTouched] = useState(false);
  const [durationKey, setDurationKey] = useState<string>(DEFAULT_DURATION_KEY);

  const isCampaign = format !== "partner";
  const compatible = useMemo(
    () => compatiblePlacements(format, placements).map((p) => p.code),
    [format, placements]
  );
  const effective = placementsTouched
    ? Array.from(chosen).filter((c) => compatible.includes(c))
    : compatible;
  const noCompatiblePlacement = isCampaign && compatible.length === 0;
  const entreprise = advMode === "new" ? (advName || "Votre entreprise") : (advertisers.find((a) => a.id === advId)?.name ?? "—");

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
      <input type="hidden" name="advertiser_mode" value={advMode} />
      <input type="hidden" name="format" value={format} />

      {/* ═══ ÉTAPE 1 — QUE VEUX-TU PUBLIER ? ═══ */}
      <Step n={1} title="Que veux-tu publier ?">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {formats.map((f) => (
            <button
              type="button"
              key={f.key}
              onClick={() => { setFormat(f.key); setPlacementsTouched(false); }}
              aria-pressed={format === f.key}
              className={`rounded-2xl border-2 p-4 text-left transition-all ${
                format === f.key
                  ? "border-guinea-red bg-guinea-red/5 shadow-md"
                  : "border-neutral-200 hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-sm dark:border-white/10 dark:hover:border-white/25"
              }`}
            >
              <FormatIcon format={f.key} />
              <p className="mt-2 text-sm font-extrabold">{f.label}</p>
              <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{f.hint}</p>
            </button>
          ))}
        </div>
      </Step>

      {/* ═══ ÉTAPE 2 — AJOUTER LA PUBLICITÉ ═══ */}
      <Step n={2} title="Ajouter la publicité">
        {/* Entreprise ou annonceur — champ simple, jamais d'identifiant */}
        <fieldset className="rounded-xl border border-neutral-200 p-4 dark:border-white/10">
          <legend className="px-1 text-sm font-extrabold">Entreprise ou annonceur</legend>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setAdvMode("existing")}
              aria-pressed={advMode === "existing"}
              className={`rounded-xl border-2 px-4 py-2.5 text-sm font-bold ${advMode === "existing" ? "border-guinea-red bg-guinea-red/5" : "border-neutral-200 dark:border-white/10"}`}
            >
              Une entreprise déjà enregistrée
            </button>
            <button
              type="button"
              onClick={() => setAdvMode("new")}
              aria-pressed={advMode === "new"}
              className={`rounded-xl border-2 px-4 py-2.5 text-sm font-bold ${advMode === "new" ? "border-guinea-red bg-guinea-red/5" : "border-neutral-200 dark:border-white/10"}`}
            >
              Une nouvelle entreprise
            </button>
          </div>
          {advMode === "existing" ? (
            <div className="mt-3">
              <label className={labelClass} htmlFor="np-adv">Choisissez :</label>
              <select
                id="np-adv"
                name="advertiser_id"
                value={advId}
                onChange={(e) => setAdvId(e.target.value)}
                required
                className={inputClass}
              >
                <option value="">— Choisir l&apos;entreprise —</option>
                {advertisers.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}{a.is_active ? "" : " (inactive)"}
                  </option>
                ))}
              </select>
              <FieldError errors={state.fieldErrors} name="advertiser_id" />
            </div>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="np-adv-name">Nom de l&apos;entreprise *</label>
                <input id="np-adv-name" name="new_advertiser_name" maxLength={120} value={advName} onChange={(e) => setAdvName(e.target.value)} className={inputClass} />
                <FieldError errors={state.fieldErrors} name="new_advertiser_name" />
                <p className="mt-1 text-xs text-neutral-500">
                  Si cette entreprise existe déjà, sa fiche est réutilisée automatiquement — jamais de doublon.
                </p>
              </div>
              <div>
                <label className={labelClass} htmlFor="np-adv-phone">Téléphone (facultatif)</label>
                <input id="np-adv-phone" name="new_advertiser_contact_phone" maxLength={40} className={inputClass} />
              </div>
            </div>
          )}
        </fieldset>

        {/* Contenu — SEULS les champs du format choisi */}
        {format === "banner" && (
          <div className="grid gap-3">
            <ImageField label="Ajouter une image *" url={imageUrl} uploading={uploading === "image"} onFile={(f) => uploadImage(f, "image")} onClear={() => setImageUrl("")} name="image_url" hint="Grande image horizontale (ex. 1200×300). Elle est compressée automatiquement." />
            <div>
              <label className={labelClass} htmlFor="np-alt">Texte alternatif (lisible par les lecteurs d&apos;écran) *</label>
              <input id="np-alt" name="image_alt" maxLength={200} className={inputClass} />
              <FieldError errors={state.fieldErrors} name="image_alt" />
            </div>
            <TextInput name="title" label="Titre (facultatif)" max={150} value={titleValue} onChange={setTitleValue} errors={state.fieldErrors} />
            <TextInput name="cta_text" label="Texte du bouton (facultatif, ex. « Découvrir »)" max={40} value={ctaValue} onChange={setCtaValue} errors={state.fieldErrors} />
          </div>
        )}
        {format === "card" && (
          <div className="grid gap-3">
            <ImageField label="Ajouter une image (facultative)" url={imageUrl} uploading={uploading === "image"} onFile={(f) => uploadImage(f, "image")} onClear={() => setImageUrl("")} name="image_url" />
            <TextInput name="title" label="Titre *" max={120} value={titleValue} onChange={setTitleValue} errors={state.fieldErrors} />
            <div>
              <label className={labelClass} htmlFor="np-c-text">Description courte *</label>
              <textarea id="np-c-text" name="text" maxLength={300} rows={2} value={textValue} onChange={(e) => setTextValue(e.target.value)} className={inputClass} />
              <FieldError errors={state.fieldErrors} name="text" />
            </div>
            <TextInput name="cta_text" label="Texte du bouton (facultatif)" max={40} value={ctaValue} onChange={setCtaValue} errors={state.fieldErrors} />
          </div>
        )}
        {format === "video" && (
          <div className="grid gap-3">
            <div>
              <label className={labelClass} htmlFor="np-yt">Coller le lien de la vidéo YouTube *</label>
              <input id="np-yt" name="youtube_url" maxLength={500} placeholder="https://www.youtube.com/watch?v=…" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} className={inputClass} />
              <FieldError errors={state.fieldErrors} name="youtube_url" />
              <p className="mt-1 text-xs text-neutral-500">Formes acceptées : youtube.com/watch, youtu.be, Shorts.</p>
            </div>
            <TextInput name="title" label="Titre *" max={120} value={titleValue} onChange={setTitleValue} errors={state.fieldErrors} />
            <TextInput name="description" label="Description (facultative)" max={300} errors={state.fieldErrors} area />
          </div>
        )}
        {format === "sponsor_article" && (
          <div className="grid gap-3">
            <div>
              <label className={labelClass} htmlFor="np-article">Choisir l&apos;article à mettre en avant *</label>
              <select id="np-article" name="article_id" className={inputClass} defaultValue="">
                <option value="">— Choisir un article déjà publié —</option>
                {articles.map((a) => (
                  <option key={a.id} value={a.id}>{a.title}</option>
                ))}
              </select>
              <FieldError errors={state.fieldErrors} name="article_id" />
              <p className="mt-1 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:bg-amber-400/10 dark:text-amber-200">
                L&apos;article sera affiché avec la mention « Sponsorisé » — obligation légale, automatique.
              </p>
            </div>
          </div>
        )}
        {format === "promo_strip" && (
          <div className="grid gap-3">
            <div>
              <label className={labelClass} htmlFor="np-msg">Écrire le message *</label>
              <input id="np-msg" name="message" maxLength={200} value={messageValue} onChange={(e) => setMessageValue(e.target.value)} className={inputClass} />
              <FieldError errors={state.fieldErrors} name="message" />
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className={labelClass} htmlFor="np-bg">Couleur de fond (facultative)</label>
                <input id="np-bg" name="bg_color" type="color" value={bgColor || "#b91c1c"} onChange={(e) => setBgColor(e.target.value)} className="h-10 w-20 rounded-lg border border-neutral-300 bg-transparent dark:border-white/15" />
              </div>
              <div className="flex-1"><TextInput name="cta_text" label="Texte du lien (facultatif)" max={40} value={ctaValue} onChange={setCtaValue} errors={state.fieldErrors} /></div>
            </div>
          </div>
        )}
        {format === "partner" && (
          <div className="grid gap-3">
            <ImageField label="Ajouter le logo *" url={logoUrl} uploading={uploading === "logo"} onFile={(f) => uploadImage(f, "logo")} onClear={() => setLogoUrl("")} name="logo_url" hint="Le nom affiché est celui de l'entreprise choisie ci-dessus." />
            <div>
              <label className={labelClass} htmlFor="np-p-alt">Description du logo (facultative — accessibilité)</label>
              <input id="np-p-alt" name="image_alt" maxLength={200} className={inputClass} />
            </div>
          </div>
        )}
        {/* Lien de destination — partagé, jamais pour article sponsorisé */}
        {format !== "sponsor_article" && (
          <div>
            <label className={labelClass} htmlFor="np-link">Lien quand on clique (facultatif)</label>
            <input id="np-link" name="link_url" type="url" maxLength={2000} placeholder="https://…" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} className={inputClass} />
            <FieldError errors={state.fieldErrors} name="link_url" />
          </div>
        )}
        {uploadError && <p className="text-sm font-semibold text-guinea-red">{uploadError}</p>}
      </Step>

      {/* ═══ ÉTAPE 3 — OÙ ET COMBIEN DE TEMPS ? ═══ */}
      <Step n={3} title="Où et combien de temps ?">
        {isCampaign && (
          <div className="grid gap-3">
            <p className="text-sm font-extrabold">Où afficher cette publicité ?</p>
            {effective.map((code) => (
              <input key={code} type="hidden" name="placements" value={code} />
            ))}
            {noCompatiblePlacement ? (
              <p className="rounded-xl border border-amber-400/50 bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-400/10 dark:text-amber-200">
                Ce format n&apos;a pas encore d&apos;endroit prévu sur le site. Choisissez un autre
                format, ou demandez à l&apos;administrateur technique d&apos;ajouter un emplacement.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {compatible.map((code) => {
                  const p = placements.find((x) => x.code === code)!;
                  return (
                    <label key={code} className="flex min-h-[52px] items-center gap-3 rounded-xl border-2 border-neutral-200 px-4 py-3 text-sm font-semibold has-checked:border-guinea-red hover:bg-neutral-50 dark:border-white/10 dark:has-checked:border-guinea-red dark:hover:bg-white/5">
                      <input type="checkbox" checked={effective.includes(code)} onChange={() => togglePlacement(code)} className="h-5 w-5" />
                      {p.label}
                    </label>
                  );
                })}
              </div>
            )}
            {!noCompatiblePlacement && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Tout est précoché : décochez ce que vous ne voulez pas.</p>
            )}
          </div>
        )}
        <div className="grid gap-3">
          <p className="text-sm font-extrabold">Pendant combien de temps ?</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {durations.map((d) => (
              <label key={d.key} className={`flex min-h-[52px] cursor-pointer items-center justify-center rounded-xl border-2 px-3 py-3 text-sm font-extrabold ${
                durationKey === d.key
                  ? "border-guinea-red bg-guinea-red/5 text-guinea-red"
                  : "border-neutral-200 dark:border-white/10"
              }`}>
                <input type="radio" name="duration_key" value={d.key} checked={durationKey === d.key} onChange={() => setDurationKey(d.key)} className="sr-only" />
                {d.label}
              </label>
            ))}
          </div>
          {durationKey === "libre" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="np-cs">Commence le *</label>
                <input id="np-cs" name="custom_start_at" type="datetime-local" className={inputClass} />
                <FieldError errors={state.fieldErrors} name="custom_start_at" />
              </div>
              <div>
                <label className={labelClass} htmlFor="np-ce">Finit le (après le début) *</label>
                <input id="np-ce" name="custom_end_at" type="datetime-local" className={inputClass} />
                <FieldError errors={state.fieldErrors} name="custom_end_at" />
              </div>
            </div>
          ) : (
            <div>
              <label className={labelClass} htmlFor="np-future">Commencer plus tard (facultatif)</label>
              <input id="np-future" name="custom_start_at" type="datetime-local" className={inputClass} />
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Laissez vide pour commencer tout de suite (heure de Conakry). La fin est calculée toute seule.
              </p>
            </div>
          )}
        </div>
      </Step>

      {/* ═══ ÉTAPE 4 — APERÇU ET PUBLIER ═══ */}
      <Step n={4} title="Vérifiez, puis publiez">
        <Preview format={format} entreprise={entreprise} imageUrl={imageUrl} logoUrl={logoUrl} title={titleValue} text={textValue} message={messageValue} bgColor={bgColor} cta={ctaValue} youtubeUrl={youtubeUrl} />
        <div className="flex flex-col gap-3">
          <button
            type="submit"
            name="submit_mode"
            value="publish"
            disabled={noCompatiblePlacement}
            className="w-full rounded-2xl bg-guinea-red px-8 py-5 text-lg font-extrabold text-white shadow-lg hover:bg-guinea-red/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            PUBLIER MA PUBLICITÉ
          </button>
          <button
            type="submit"
            name="submit_mode"
            value="draft"
            className="text-center text-sm font-semibold text-neutral-500 underline hover:text-neutral-700 dark:text-neutral-400"
          >
            Plutôt garder en brouillon (invisible sur le site)
          </button>
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {role === "admin"
            ? "À la publication, tout est créé automatiquement : l'entreprise, la diffusion, le visuel, les emplacements. Votre publicité devient visible pendant la durée choisie (2 min max de délai)."
            : "À la publication, un administrateur confirme votre visuel une seule fois — sans cette confirmation, rien n'est affiché."}
        </p>
        <FormMessage state={state} />
      </Step>
    </form>
  );
}

// ─── Aperçu fidèle (ce que verra le visiteur) ───────────────────────
function Preview(p: {
  format: SimpleAdFormat; entreprise: string; imageUrl: string; logoUrl: string;
  title: string; text: string; message: string; bgColor: string; cta: string; youtubeUrl: string;
}) {
  const cta = p.cta || (p.format === "partner" ? "" : "En savoir plus");
  if (p.format === "partner") {
    return (
      <div className="rounded-2xl border-2 border-dashed border-neutral-300 p-5 dark:border-white/15">
        <p className="mb-3 text-[10px] font-extrabold uppercase tracking-wider text-neutral-400">Aperçu — espace partenaires</p>
        {p.logoUrl
          ? // eslint-disable-next-line @next/next/no-img-element
            <img src={p.logoUrl} alt="" className="h-16 w-auto max-w-[200px] object-contain" />
          : <div className="flex h-16 w-32 items-center justify-center rounded-xl bg-neutral-100 text-xs text-neutral-400 dark:bg-white/5">Logo</div>}
        <p className="mt-2 text-sm font-bold">{p.entreprise}</p>
      </div>
    );
  }
  if (p.format === "promo_strip") {
    return (
      <div className="rounded-2xl border-2 border-dashed border-neutral-300 p-5 dark:border-white/15">
        <p className="mb-3 text-[10px] font-extrabold uppercase tracking-wider text-neutral-400">Aperçu — bandeau sur l&apos;accueil</p>
        <div className="flex items-center gap-3 rounded-xl px-4 py-3 text-white" style={{ backgroundColor: p.bgColor || "#b91c1c" }}>
          <span className="flex-1 text-sm font-bold">{p.message || "Votre message ici"}</span>
          {cta && <span className="rounded-lg bg-white/20 px-3 py-1.5 text-xs font-extrabold">{cta}</span>}
        </div>
      </div>
    );
  }
  if (p.format === "video") {
    const m = /[?&]v=([\w-]{11})|youtu\.be\/([\w-]{11})/.exec(p.youtubeUrl);
    const thumb = m ? `https://i.ytimg.com/vi/${m[1] ?? m[2]}/mqdefault.jpg` : null;
    return (
      <div className="rounded-2xl border-2 border-dashed border-neutral-300 p-5 dark:border-white/15">
        <p className="mb-3 text-[10px] font-extrabold uppercase tracking-wider text-neutral-400">Aperçu — vidéo publicitaire</p>
        <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-white/10">
          {thumb
            ? // eslint-disable-next-line @next/next/no-img-element
              <img src={thumb} alt="" className="h-40 w-full object-cover" />
            : <div className="flex h-40 items-center justify-center bg-neutral-100 text-sm text-neutral-400 dark:bg-white/5">Coller un lien YouTube pour voir l&apos;aperçu</div>}
          <p className="px-4 py-3 text-sm font-bold">{p.title || "Titre de la vidéo"}</p>
        </div>
      </div>
    );
  }
  if (p.format === "sponsor_article") {
    return (
      <div className="rounded-2xl border-2 border-dashed border-neutral-300 p-5 dark:border-white/15">
        <p className="mb-3 text-[10px] font-extrabold uppercase tracking-wider text-neutral-400">Aperçu — article sponsorisé dans les listes</p>
        <div className="rounded-xl border border-neutral-200 p-4 dark:border-white/10">
          <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-amber-700 dark:text-amber-300">Sponsorisé</span>
          <p className="mt-2 text-sm font-bold text-neutral-700 dark:text-neutral-200">{p.entreprise}</p>
        </div>
      </div>
    );
  }
  // banner / card
  return (
    <div className="rounded-2xl border-2 border-dashed border-neutral-300 p-5 dark:border-white/15">
      <p className="mb-3 text-[10px] font-extrabold uppercase tracking-wider text-neutral-400">Aperçu — {p.format === "banner" ? "bannière" : "carte"}</p>
      <div className={`overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-white/10 dark:bg-white/5 ${p.format === "banner" ? "" : "max-w-sm"}`}>
        {p.imageUrl
          ? // eslint-disable-next-line @next/next/no-img-element
            <img src={p.imageUrl} alt="" className={p.format === "banner" ? "h-24 w-full object-cover" : "h-40 w-full object-cover"} />
          : <div className={`flex items-center justify-center bg-neutral-100 text-xs text-neutral-400 dark:bg-white/5 ${p.format === "banner" ? "h-24" : "h-40"}`}>L&apos;image apparaîtra ici</div>}
        <div className="p-3">
          {p.title && <p className="text-sm font-extrabold">{p.title}</p>}
          {p.text && <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">{p.text}</p>}
          {cta && <span className="mt-2 inline-block rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-extrabold text-white dark:bg-white dark:text-neutral-900">{cta}</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Petits blocs réutilisables ─────────────────────────────────────
function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-white/10 dark:bg-night-800">
      <h2 className="mb-4 flex items-center gap-3 font-display text-lg font-extrabold">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-guinea-red text-sm font-extrabold text-white">{n}</span>
        {title}
      </h2>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

function TextInput({ name, label, max, area, value, onChange, errors }: { name: string; label: string; max: number; area?: boolean; value?: string; onChange?: (v: string) => void; errors?: Record<string, string> }) {
  return (
    <div>
      <label className={labelClass} htmlFor={`np-${name}`}>{label}</label>
      {area ? (
        <textarea id={`np-${name}`} name={name} maxLength={max} rows={2} value={value} onChange={(e) => onChange?.(e.target.value)} className={inputClass} />
      ) : (
        <input id={`np-${name}`} name={name} maxLength={max} value={value} onChange={(e) => onChange?.(e.target.value)} className={inputClass} />
      )}
      <FieldError errors={errors} name={name} />
    </div>
  );
}

function ImageField({
  label, url, uploading, onFile, onClear, name, hint,
}: {
  label: string;
  url: string;
  uploading: boolean;
  onFile: (file: File) => void;
  onClear: () => void;
  name: string;
  hint?: string;
}) {
  const [hasFile, setHasFile] = useState(false);
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
            setHasFile(true);
            onFile(f);
          }}
        />
        {uploading && <span className="text-xs font-semibold text-neutral-500">Compression et envoi…</span>}
      </div>
      {(url || hasFile) && (
        <div className="mt-2 flex items-center gap-3">
          {url
            ? <span className="rounded-lg bg-guinea-green/10 px-2 py-1 text-xs font-bold text-guinea-green">Image ajoutée ✔</span>
            : <span className="rounded-lg bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">Envoi en cours…</span>}
          <button type="button" onClick={() => { onClear(); setHasFile(false); }} className="text-xs font-semibold text-neutral-500 underline">
            Changer d&apos;image
          </button>
        </div>
      )}
      {hint && <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{hint}</p>}
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
  return <span aria-hidden className="text-2xl">{glyphs[format]}</span>;
}