"use client";

import { useState } from "react";
import { MessageCircleQuestion, Send, X } from "lucide-react";

/**
 * Chatbot PUBLIC « Assistant Bonne Humeur TV » (demande direction §4).
 *
 * • Bouton flottant discret CÔTÉ GAUCHE (le WhatsApp reste en bas à droite
 *   — aucun chevauchement) ; panneau mobile-first (pleine largeur sur
 *   mobile, boîte fixe sur écran large).
 * • Aucune donnée personnelle : pas de nom, pas de stockage local — la
 *   conversation vit dans l'état du composant et disparaît au rechargement.
 * • L'assistant répond uniquement sur Bonne Humeur TV ; hors périmètre le
 *   serveur renvoie le message de recadrage exact — l'UI affiche ce que le
 *   serveur décide (jamais de réponse simulée client).
 */

interface ChatLine {
  role: "user" | "assistant";
  content: string;
}

const INITIAL: ChatLine[] = [
  {
    role: "assistant",
    content:
      "Bonjour ! Je suis l'Assistant Bonne Humeur TV. Posez-moi vos questions sur la chaîne, ses articles, ses vidéos ou un partenariat.",
  },
];

export default function AiChatWidget() {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<ChatLine[]>(INITIAL);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const message = input.trim();
    if (!message || busy) return;
    setBusy(true);
    setLines((l) => [...l, { role: "user", content: message }]);
    setInput("");
    try {
      const res = await fetch("/api/ai/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      // DÉCODAGE (correction diagnostic 06/11) : le serveur renvoie le succès
      // dans `reply` ({ok:true, reply, fallback?:bool}) et les erreurs
      // utilisateur dans `message` (403 bots / 413 trop long / 429 quota).
      // Lire `message` d'abord montrait TOUJOURS le recadrage au lieu de la
      // vraie réponse — « reply » en succès, « message » en erreur.
      const json = (await res.json()) as {
        ok?: boolean;
        reply?: string;
        message?: string;
      };
      const reply =
        json.ok === true && typeof json.reply === "string" && json.reply.length > 0
          ? json.reply
          : typeof json.message === "string" && json.message.length > 0
            ? json.message
            : "Je ne dispose pas actuellement de cette information sur Bonne Humeur TV. Vous pouvez contacter notre équipe pour en savoir davantage.";
      setLines((l) => [...l, { role: "assistant", content: reply }]);
    } catch {
      setLines((l) => [
        ...l,
        {
          role: "assistant",
          content:
            "Je ne dispose pas actuellement de cette information sur Bonne Humeur TV. Vous pouvez contacter notre équipe pour en savoir davantage.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Bouton flottant — bas gauche (WhatsApp déjà en bas droite). */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Fermer l'assistant Bonne Humeur TV" : "Ouvrir l'assistant Bonne Humeur TV"}
        aria-expanded={open}
        className="fixed bottom-5 left-5 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-night-700 text-white shadow-lg transition-transform hover:scale-110 dark:bg-night-600 sm:h-12 sm:w-12"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircleQuestion className="h-5 w-5" />}
      </button>

      {open && (
        <div
          className="fixed inset-x-0 bottom-[4.75rem] z-40 flex flex-col overflow-hidden rounded-t-2xl border border-neutral-200 bg-white shadow-2xl dark:border-white/10 dark:bg-night-800 sm:inset-x-auto sm:bottom-[4.75rem] sm:left-5 sm:h-[26rem] sm:w-[22rem] sm:rounded-2xl"
          role="dialog"
          aria-label="Assistant Bonne Humeur TV"
        >
          <header className="flex items-center gap-2 border-b border-neutral-200 bg-guinea-red px-4 py-3 text-white dark:border-white/10">
            <MessageCircleQuestion className="h-4 w-4" />
            <p className="font-display text-sm font-bold">Assistant Bonne Humeur TV</p>
          </header>

          <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-3 min-h-0 max-h-[45vh] sm:max-h-none">
            {lines.map((l, i) => (
              <div
                key={i}
                className={
                  l.role === "user"
                    ? "ml-6 self-end rounded-2xl rounded-br-sm bg-guinea-red px-3 py-2 text-sm text-white"
                    : "mr-4 self-start rounded-2xl rounded-bl-sm bg-neutral-100 px-3 py-2 text-sm dark:bg-night-900"
                }
              >
                {l.content}
              </div>
            ))}
            {busy && (
              <div className="mr-4 self-start rounded-2xl rounded-bl-sm bg-neutral-100 px-3 py-2 text-xs text-neutral-500 dark:bg-night-900 dark:text-neutral-400">
                Réponse en cours…
              </div>
            )}
          </div>

          <form onSubmit={send} className="flex gap-2 border-t border-neutral-200 p-2.5 dark:border-white/10">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={2000}
              placeholder="Votre question sur Bonne Humeur TV…"
              aria-label="Votre message à l'assistant"
              className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-guinea-red/40 dark:border-white/10 dark:bg-night-900"
            />
            <button
              type="submit"
              disabled={busy || input.trim().length === 0}
              aria-label="Envoyer"
              className="flex items-center justify-center rounded-xl bg-guinea-red px-3 py-2 text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
