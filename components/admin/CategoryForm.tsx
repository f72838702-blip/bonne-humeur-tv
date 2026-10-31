"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { Category } from "@/lib/types";
import { saveCategory } from "@/lib/actions/content";
import { FieldError, FormMessage, SubmitButton, idleActionState, inputClass, labelClass } from "./form-ui";

/**
 * Rubrique éditoriale — création ou édition (structure du site,
 * jamais de contenu fictif : une rubrique vide reste vide).
 */
export default function CategoryForm({ category }: { category?: Category }) {
  const [state, formAction] = useActionState(saveCategory, idleActionState);
  const router = useRouter();

  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [state, router]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {category && <input type="hidden" name="id" value={category.id} />}

      <FormMessage state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`cat-name-${category?.id ?? "new"}`} className={labelClass}>
            Nom de la rubrique *
          </label>
          <input
            id={`cat-name-${category?.id ?? "new"}`}
            name="name"
            type="text"
            required
            minLength={2}
            maxLength={60}
            defaultValue={category?.name ?? ""}
            placeholder="Ex : Société"
            className={inputClass}
          />
          <FieldError errors={state.fieldErrors} name="name" />
        </div>
        <div>
          <label htmlFor={`cat-slug-${category?.id ?? "new"}`} className={labelClass}>
            Slug (facultatif — généré depuis le nom)
          </label>
          <input
            id={`cat-slug-${category?.id ?? "new"}`}
            name="slug"
            type="text"
            maxLength={60}
            defaultValue={category?.slug ?? ""}
            placeholder="societe"
            className={inputClass}
          />
          <FieldError errors={state.fieldErrors} name="slug" />
        </div>
      </div>

      <div>
        <label htmlFor={`cat-desc-${category?.id ?? "new"}`} className={labelClass}>
          Description (200 max)
        </label>
        <input
          id={`cat-desc-${category?.id ?? "new"}`}
          name="description"
          type="text"
          maxLength={200}
          defaultValue={category?.description ?? ""}
          placeholder="Ce que couvre cette rubrique"
          className={inputClass}
        />
        <FieldError errors={state.fieldErrors} name="description" />
      </div>

      <SubmitButton
        label={category ? "Enregistrer la rubrique" : "Créer la rubrique"}
        pendingLabel="Enregistrement…"
      />
    </form>
  );
}