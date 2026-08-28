"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { supabase } from "@/lib/supabase";

const schema = z.object({
  organisation: z.string().min(2, "Nom de l'organisation requis"),
  contactName: z.string().min(2, "Nom du contact requis"),
  email: z.string().email("Adresse email invalide"),
  phone: z.string().min(8, "Numéro invalide").optional().or(z.literal("")),
  service: z.enum(["couverture", "interview", "production", "digitale"], {
    errorMap: () => ({ message: "Choisissez une prestation" }),
  }),
  budget: z.string().optional(),
  message: z.string().min(10, "Décrivez brièvement votre projet (10 caractères min.)"),
});

type FormValues = z.infer<typeof schema>;

const inputClass =
  "w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition-colors placeholder:text-neutral-400 focus:border-guinea-red focus:ring-2 focus:ring-guinea-red/20 dark:border-white/15 dark:bg-night-900 dark:focus:border-guinea-red";

export default function PartnershipForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setError(null);
    if (!supabase) {
      // Mode démo : Supabase pas encore configuré
      console.log("[DEMO] Demande de partenariat :", values);
      setSent(true);
      return;
    }
    const { error: sbError } = await supabase
      .from("partnership_requests")
      .insert({
        organisation: values.organisation,
        contact_name: values.contactName,
        email: values.email,
        phone: values.phone || null,
        service: values.service,
        budget: values.budget || null,
        message: values.message,
      });
    if (sbError) {
      setError("Une erreur est survenue. Réessayez ou contactez-nous directement.");
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-guinea-green/30 bg-guinea-green/5 px-6 py-12 text-center">
        <CheckCircle2 className="h-12 w-12 text-guinea-green" />
        <h3 className="font-display text-xl font-bold">Demande envoyée !</h3>
        <p className="max-w-md text-sm text-neutral-500 dark:text-neutral-400">
          Merci pour votre intérêt. Notre équipe commerciale vous recontacte sous
          48 h ouvrées pour étudier votre projet.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="grid gap-4 rounded-2xl border border-neutral-200 bg-white p-6 dark:border-white/10 dark:bg-night-800 sm:p-8"
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">
            Organisation / Entreprise *
          </label>
          <input {...register("organisation")} placeholder="Ex. Ministère de…, SARL…" className={inputClass} />
          {errors.organisation && (
            <p className="mt-1 text-xs text-guinea-red">{errors.organisation.message}</p>
          )}
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">
            Nom du contact *
          </label>
          <input {...register("contactName")} placeholder="Votre nom complet" className={inputClass} />
          {errors.contactName && (
            <p className="mt-1 text-xs text-guinea-red">{errors.contactName.message}</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">
            Email professionnel *
          </label>
          <input {...register("email")} type="email" placeholder="vous@organisation.gn" className={inputClass} />
          {errors.email && <p className="mt-1 text-xs text-guinea-red">{errors.email.message}</p>}
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">
            Téléphone / WhatsApp
          </label>
          <input {...register("phone")} type="tel" placeholder="+224 …" className={inputClass} />
          {errors.phone && <p className="mt-1 text-xs text-guinea-red">{errors.phone.message}</p>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">
            Prestation souhaitée *
          </label>
          <select {...register("service")} className={inputClass} defaultValue="">
            <option value="" disabled>
              Sélectionnez…
            </option>
            <option value="couverture">Couverture médiatique</option>
            <option value="interview">Interview / Portrait</option>
            <option value="production">Production audiovisuelle</option>
            <option value="digitale">Communication digitale</option>
          </select>
          {errors.service && <p className="mt-1 text-xs text-guinea-red">{errors.service.message}</p>}
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">
            Budget estimé (GNF)
          </label>
          <select {...register("budget")} className={inputClass} defaultValue="">
            <option value="">À discuter</option>
            <option value="<5M">Moins de 5 millions</option>
            <option value="5-15M">5 à 15 millions</option>
            <option value="15-50M">15 à 50 millions</option>
            <option value=">50M">Plus de 50 millions</option>
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">
          Votre projet *
        </label>
        <textarea
          {...register("message")}
          rows={4}
          placeholder="Décrivez votre besoin : contexte, objectifs, calendrier…"
          className={inputClass}
        />
        {errors.message && <p className="mt-1 text-xs text-guinea-red">{errors.message.message}</p>}
      </div>

      {error && (
        <p className="rounded-xl bg-guinea-red/10 px-4 py-3 text-sm font-medium text-guinea-red">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-guinea-red px-8 py-4 text-sm font-bold text-white shadow-glow transition-all hover:scale-[1.02] disabled:opacity-60"
      >
        {isSubmitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        {isSubmitting ? "Envoi en cours…" : "Envoyer ma demande de devis"}
      </button>
    </form>
  );
}
