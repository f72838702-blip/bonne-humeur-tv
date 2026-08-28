"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { supabase } from "@/lib/supabase";

const schema = z.object({
  name: z.string().min(2, "Votre nom est requis"),
  email: z.string().email("Adresse email invalide"),
  message: z.string().min(10, "Votre message est trop court"),
});

type FormValues = z.infer<typeof schema>;

const inputClass =
  "w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition-colors placeholder:text-neutral-400 focus:border-guinea-red focus:ring-2 focus:ring-guinea-red/20 dark:border-white/15 dark:bg-night-900";

export default function ContactForm() {
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
      console.log("[DEMO] Message de contact :", values);
      setSent(true);
      return;
    }
    const { error: sbError } = await supabase.from("contact_messages").insert(values);
    if (sbError) {
      setError("Envoi impossible pour le moment. Réessayez plus tard.");
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-guinea-green/30 bg-guinea-green/5 px-6 py-10 text-center">
        <CheckCircle2 className="h-10 w-10 text-guinea-green" />
        <p className="font-bold">Message bien reçu !</p>
        <p className="text-sm text-neutral-500">Nous vous répondrons très vite.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <input {...register("name")} placeholder="Votre nom *" className={inputClass} />
      {errors.name && <p className="-mt-2 text-xs text-guinea-red">{errors.name.message}</p>}
      <input {...register("email")} type="email" placeholder="Votre email *" className={inputClass} />
      {errors.email && <p className="-mt-2 text-xs text-guinea-red">{errors.email.message}</p>}
      <textarea {...register("message")} rows={5} placeholder="Votre message *" className={inputClass} />
      {errors.message && <p className="-mt-2 text-xs text-guinea-red">{errors.message.message}</p>}
      {error && <p className="text-sm text-guinea-red">{error}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-guinea-red px-7 py-3.5 text-sm font-bold text-white shadow-glow transition-all hover:scale-[1.02] disabled:opacity-60"
      >
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Envoyer
      </button>
    </form>
  );
}
