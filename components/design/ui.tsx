"use client";

/**
 * PETIT JEU D'INTERFACE DU STUDIO — champs bornés uniquement :
 * listes de choix fermées, cases à cocher, textes courts. Aucun champ
 * libre ne peut produire du HTML/CSS/JS : les valeurs non reconnues
 * retombent sur null (= valeur du socle).
 */
import { cn } from "@/lib/utils";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="mt-1 block text-[11px] text-neutral-400">{hint}</span>}
    </label>
  );
}

export function SelectField<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint?: string;
  /** null = valeur du socle (défaut). */
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (v: T | null) => void;
}) {
  return (
    <Field label={label} hint={hint}>
      <select
        value={value ?? ""}
        onChange={(e) => onChange((e.target.value === "" ? null : e.target.value) as T | null)}
        className="w-full rounded-xl border border-neutral-200 bg-surface px-3 py-2 text-sm text-neutral-900 outline-none focus:border-guinea-red dark:border-white/10 dark:bg-night-900 dark:text-neutral-100"
      >
        <option value="">— Défaut (socle) —</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function ToggleField({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-guinea-red"
      />
      <span>
        <span className="block text-sm font-semibold text-neutral-800 dark:text-neutral-200">{label}</span>
        {hint && <span className="block text-[11px] text-neutral-400">{hint}</span>}
      </span>
    </label>
  );
}

/** Champ couleur : sélecteur natif + hex saisi à la main — tout autre
 *  texte est refusé visuellement (bordure rouge) plutôt que propageé. */
export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const valid = value === null || /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(value);
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        aria-label={`${label} — sélecteur`}
        value={value ?? "#ce1126"}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-8 shrink-0 cursor-pointer rounded-md border border-neutral-200 bg-transparent dark:border-white/10"
      />
      <input
        type="text"
        aria-label={`${label} — code hexadécimal`}
        placeholder="#... (défault)"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value.trim() === "" ? null : e.target.value.trim())}
        className={cn(
          "w-full min-w-0 rounded-lg border bg-surface px-2 py-1.5 font-mono text-xs text-neutral-900 outline-none dark:bg-night-900 dark:text-neutral-100",
          valid
            ? "border-neutral-200 focus:border-guinea-red dark:border-white/10"
            : "border-guinea-red",
        )}
      />
      <button
        type="button"
        onClick={() => onChange(null)}
        title="Revenir à la valeur par défaut"
        className="shrink-0 rounded-md px-1.5 py-1 text-xs text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-white/5 dark:hover:text-neutral-200"
      >
        ✕
      </button>
    </div>
  );
}

export function ColorGroup({
  title,
  set,
  labels,
  onChange,
}: {
  title: string;
  set: Record<string, string | null>;
  labels: Record<string, string>;
  onChange: (key: string, v: string | null) => void;
}) {
  return (
    <fieldset className="rounded-2xl border border-neutral-200 p-4 dark:border-white/10 dark:bg-night-900">
      <legend className="px-2 text-xs font-bold uppercase tracking-widest text-neutral-600 dark:text-neutral-300">
        {title}
      </legend>
      <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
        {Object.keys(labels).map((key) => (
          <div key={key}>
            <span className="mb-1 block text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
              {labels[key]}
            </span>
            <ColorField
              label={labels[key]}
              value={set[key]}
              onChange={(v) => onChange(key, v)}
            />
          </div>
        ))}
      </div>
    </fieldset>
  );
}
