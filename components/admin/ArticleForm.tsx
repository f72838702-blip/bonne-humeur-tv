"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useRouter } from "next/navigation";
import type { ArticleWithRelations, Category, UserRole } from "@/lib/types";
import { saveArticle } from "@/lib/actions/content";
import { FieldError, FormMessage, SubmitButton, idleActionState, inputClass, labelClass } from "./form-ui";

/**
 * Rédaction / édition d'article (markdown, workflow draft→review→…).
 * Les options visibles dépendent du rôle ; le SERVEUR revérifie tout
 * (lib/actions/content.ts + RLS) — ce formulaire ne fait que proposer.
 */

const STATUS_OPTIONS_STAFF = [
  { value: "draft", label: "Brouillon" },
  { value: "review", label: "Soumettre à validation" },
  { value: "scheduled", label: "Publication programmée" },
  { value: "published", label: "Publier" },
  { value: "archived", label: "Archiver" },
];

const STATUS_OPTIONS_REPORTER = [
  { value: "draft", label: "Brouillon" },
  { value: "review", label: "Soumettre à validation" },
];

/** ISO → valeur locale pour <input type="datetime-local">. */
function toLocalInput(iso: string | null): string {
  return iso ? iso.slice(0, 16) : "";
}

export default function ArticleForm({
  categories,
  role,
  article,
}: {
  categories: Pick<Category, "id" | "name" | "slug">[];
  role: UserRole;
  article?: ArticleWithRelations;
}) {
  const [state, formAction] = useActionState(saveArticle, idleActionState);
  const [status, setStatus] = useState(article?.status ?? "draft");
  const [scheduleHint, setScheduleHint] = useState<string | null>(null);
  const router = useRouter();
  const isStaff = role === "admin" || role === "editor";
  const options = isStaff ? STATUS_OPTIONS_STAFF : STATUS_OPTIONS_REPORTER;

  useEffect(() => {
    if (state.status === "success" && state.redirectTo) {
      router.push(state.redirectTo);
      router.refresh();
    }
  }, [state, router]);

  /** Confirmation avant publication (dialogue navigateur, annulable). */
  const confirmPublish = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (!window.confirm("Publier cet article sur le site public ? Il sera visible immédiatement.")) {
      event.preventDefault();
    }
  };

  /** La date est obligatoire : contrôle immédiat + serveur en dernier ressort. */
  const guardSchedule = (event: ReactMouseEvent<HTMLButtonElement>) => {
    const input = document.getElementById("scheduled_at") as HTMLInputElement | null;
    if (!input?.value) {
      event.preventDefault();
      setScheduleHint("Indiquez d'abord la date et l'heure de publication programmée.");
      input?.focus();
      return;
    }
    setScheduleHint(null);
  };

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {article && <input type="hidden" name="id" value={article.id} />}

      <FormMessage state={state} />

      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        {/* ─── Colonne principale ─── */}
        <div className="flex flex-col gap-5">
          <div>
            <label htmlFor="title" className={labelClass}>
              Titre *
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              minLength={5}
              maxLength={200}
              defaultValue={article?.title ?? ""}
              placeholder="Un titre clair et factuel"
              className={inputClass}
            />
            <FieldError errors={state.fieldErrors} name="title" />
          </div>

          <div>
            <label htmlFor="excerpt" className={labelClass}>
              Chapeau / résumé (400 caractères max)
            </label>
            <textarea
              id="excerpt"
              name="excerpt"
              rows={3}
              maxLength={400}
              defaultValue={article?.excerpt ?? ""}
              placeholder="Le résumé affiché dans les listes et les réseaux sociaux"
              className={inputClass}
            />
            <FieldError errors={state.fieldErrors} name="excerpt" />
          </div>

          <div>
            <label htmlFor="content" className={labelClass}>
              Contenu (markdown) *
            </label>
            <textarea
              id="content"
              name="content"
              rows={18}
              required
              defaultValue={article?.content ?? ""}
              placeholder={"## Titre de section\n\nParagraphe de l'article…\n\n- **gras**\n- *italique*\n- listes à puces"}
              className={`${inputClass} font-mono text-[13px] leading-relaxed`}
            />
            <p className="mt-1 text-[11px] text-neutral-400">
              Mise en forme markdown : <code className="rounded bg-neutral-100 px-1 dark:bg-white/10">**gras**</code>,{" "}
              <code className="rounded bg-neutral-100 px-1 dark:bg-white/10">*italique*</code>,{" "}
              <code className="rounded bg-neutral-100 px-1 dark:bg-white/10">## titres</code>,{" "}
              <code className="rounded bg-neutral-100 px-1 dark:bg-white/10">- listes</code>. Les liens et
              contenus dangereux sont neutralisés côté serveur.
            </p>
            <FieldError errors={state.fieldErrors} name="content" />
          </div>
        </div>

        {/* ─── Colonne latérale ─── */}
        <div className="flex flex-col gap-5">
          <div>
            <label htmlFor="status" className={labelClass}>
              Statut *
            </label>
            <select
              id="status"
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as ArticleWithRelations["status"])}
              className={inputClass}
            >
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">
              Les boutons ci-dessous appliquent le statut en un clic
              (brouillon, publier, programmer). Ce menu reste utile pour les
              autres transitions (soumettre à validation, archiver) via
              « Transition avancée ».
            </p>
            {!isStaff && (
              <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">
                En tant que reporter, vos articles sont relus par un éditeur
                avant publication.
              </p>
            )}
            <FieldError errors={state.fieldErrors} name="status" />
          </div>

          {status === "scheduled" && (
            <div>
              <label htmlFor="scheduled_at" className={labelClass}>
                Date et heure de publication *
              </label>
              <input
                id="scheduled_at"
                name="scheduled_at"
                type="datetime-local"
                defaultValue={toLocalInput(article?.scheduled_at ?? null)}
                className={inputClass}
              />
              <p className="mt-1 text-[11px] text-neutral-400">
                L’article passera automatiquement en ligne à cette échéance.
              </p>
              <FieldError errors={state.fieldErrors} name="scheduled_at" />
            </div>
          )}

          <div>
            <label htmlFor="category_id" className={labelClass}>
              Rubrique
            </label>
            <select id="category_id" name="category_id" defaultValue={article?.category_id ?? ""} className={inputClass}>
              <option value="">— Sans rubrique —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <FieldError errors={state.fieldErrors} name="category_id" />
          </div>

          <div>
            <label htmlFor="featured_image" className={labelClass}>
              Image de couverture (URL)
            </label>
            <input
              id="featured_image"
              name="featured_image"
              type="url"
              maxLength={500}
              defaultValue={article?.featured_image ?? ""}
              placeholder="https://…"
              className={inputClass}
            />
            <p className="mt-1 text-[11px] text-neutral-400">
              Téléversez vos visuels dans la{" "}
              <Link href="/admin/medias" className="font-semibold text-guinea-red hover:underline">
                médiathèque
              </Link>{" "}
              puis collez l’URL obtenue.
            </p>
            <FieldError errors={state.fieldErrors} name="featured_image" />
          </div>

          {isStaff && (
            <>
              <div>
                <label htmlFor="tags" className={labelClass}>
                  Tags (séparés par des virgules)
                </label>
                <input
                  id="tags"
                  name="tags"
                  type="text"
                  defaultValue={(article?.tags ?? []).map((t) => t.name).join(", ")}
                  placeholder="Conakry, économie, éducation"
                  className={inputClass}
                />
                <p className="mt-1 text-[11px] text-neutral-400">10 tags maximum, 40 caractères chacun.</p>
                <FieldError errors={state.fieldErrors} name="tags" />
              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-neutral-200 px-4 py-3 text-sm font-semibold dark:border-white/10">
                <input
                  type="checkbox"
                  name="is_featured"
                  defaultChecked={article?.is_featured ?? false}
                  className="h-4 w-4 accent-guinea-red"
                />
                Mettre à la une sur l’accueil
              </label>
            </>
          )}

          <details className="rounded-xl border border-neutral-200 dark:border-white/10">
            <summary className="cursor-pointer list-none px-4 py-3 text-xs font-bold uppercase tracking-wide text-neutral-500">
              Référencement (SEO)
            </summary>
            <div className="flex flex-col gap-4 px-4 pb-4">
              <div>
                <label htmlFor="meta_title" className={labelClass}>
                  Titre SEO (200 max)
                </label>
                <input
                  id="meta_title"
                  name="meta_title"
                  type="text"
                  maxLength={200}
                  defaultValue={article?.meta_title ?? ""}
                  className={inputClass}
                />
                <FieldError errors={state.fieldErrors} name="meta_title" />
              </div>
              <div>
                <label htmlFor="meta_description" className={labelClass}>
                  Description SEO (300 max)
                </label>
                <textarea
                  id="meta_description"
                  name="meta_description"
                  rows={3}
                  maxLength={300}
                  defaultValue={article?.meta_description ?? ""}
                  className={inputClass}
                />
                <FieldError errors={state.fieldErrors} name="meta_description" />
              </div>
            </div>
          </details>

          <div>
            <label htmlFor="slug" className={labelClass}>
              Slug (facultatif — généré depuis le titre)
            </label>
            <input
              id="slug"
              name="slug"
              type="text"
              maxLength={96}
              defaultValue={article?.slug ?? ""}
              placeholder="genere-automatiquement"
              className={inputClass}
            />
            <FieldError errors={state.fieldErrors} name="slug" />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-neutral-200 pt-5 dark:border-white/10">
        {/* Avertissement local pour la publication programmée (date manquante). */}
        {scheduleHint && (
          <p role="alert" className="rounded-xl border border-guinea-red/40 bg-guinea-red/10 px-4 py-3 text-sm font-medium text-guinea-red">
            {scheduleHint}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-end gap-3">
          {/* Enregistrement sans intention : applique le statut du menu (transitions avancées). */}
          <SubmitButton
            label="Transition avancée — statut du menu"
            pendingLabel="Enregistrement…"
            variant="neutral"
          />
          {isStaff && (
            <SubmitButton
              label="Programmer la publication"
              pendingLabel="Programmation…"
              variant="neutral"
              name="intent"
              value="schedule"
              onClick={guardSchedule}
            />
          )}
          {isStaff && (
            <SubmitButton
              label="Publier maintenant"
              pendingLabel="Publication…"
              variant="success"
              name="intent"
              value="publish"
              onClick={confirmPublish}
            />
          )}
          {isStaff ? (
            <SubmitButton
              label="Enregistrer comme brouillon"
              pendingLabel="Enregistrement…"
              name="intent"
              value="draft"
            />
          ) : (
            <>
              <SubmitButton
                label="Soumettre à validation"
                pendingLabel="Envoi…"
                name="intent"
                value="review"
              />
              <SubmitButton
                label="Enregistrer comme brouillon"
                pendingLabel="Enregistrement…"
                name="intent"
                value="draft"
              />
            </>
          )}
        </div>
      </div>
    </form>
  );
}