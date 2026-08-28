"use client";

import { useState } from "react";
import { Check, Facebook, Link2, MessageCircle } from "lucide-react";

export default function ShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard indisponible */
    }
  };

  const base =
    "flex h-10 w-10 items-center justify-center rounded-full border border-neutral-300 transition-all hover:scale-105 dark:border-white/20";

  return (
    <div className="flex items-center gap-2.5">
      <a
        href={`https://wa.me/?text=${encodeURIComponent(`${title} — ${url}`)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Partager sur WhatsApp"
        className={`${base} hover:border-guinea-green hover:text-guinea-green`}
      >
        <MessageCircle className="h-4.5 w-4.5" />
      </a>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Partager sur Facebook"
        className={`${base} hover:border-sky-500 hover:text-sky-500`}
      >
        <Facebook className="h-4.5 w-4.5" />
      </a>
      <button
        onClick={copy}
        aria-label="Copier le lien"
        className={`${base} ${copied ? "border-guinea-green text-guinea-green" : "hover:border-guinea-red hover:text-guinea-red"}`}
      >
        {copied ? <Check className="h-4.5 w-4.5" /> : <Link2 className="h-4.5 w-4.5" />}
      </button>
    </div>
  );
}
