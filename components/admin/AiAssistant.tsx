"use client";

import { useRef, useState } from "react";
import { Bot, Copy, Loader2, Send, Sparkles } from "lucide-react";
import { AI_ADMIN_TASKS } from "@/lib/ai/prompts";
import { parseStructuredArticle } from "@/lib/ai/parse-article";
import { saveArticle } from "@/lib/actions/content";

/**
 * Assistant IA de rédaction (demande direction §3).
 *
 * • Le texte généré est TOUJOURS relu avant usage : « Enregistrer comme
 *   brouillon » remplit un formulaire ÉDITABLE et passe par l'action
 *   saveArticle EXISTANTE (statique « brouillon » uniquement — l'IA ne
 *   publie jamais, ne contourne aucune permission : la RLS et requireRole
 *   de l'action s'appliquent comme pour tout article).
 * • Aucune donnée d'entrée/sortie n'est stockée côté navigateur : l'histoire
 *   vit dans l'état du composant (perdue au rechargement — conversations
 *   privées de la rédaction non exposées).
 */

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function AiAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Brouillon à envoyer au CMS (formulaire éditable — relecture obligatoire).
  const [draft, setDraft] = useState(() => ({
    title: "",
    excerpt: "",
    content: "",
    tags: "",
  }));
  const [saveState, setSaveState] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function send(userMessage: string) {
    const message = userMessage.trim();
    if (!message || busy) return;
    setBusy(true);
    setError(null);
    setSaveState(null);
    setMessages((m) => [...m, { role: "user", content: message.slice(0, 6000) }]);
    setInput("");
    try {
      const res = await fetch("/api/ai/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          history: messages.slice(-4).map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const json = (await res.json()) as { ok?: boolean; text?: string; message?: string };
      if (res.ok && json.ok && json.text) {
        setMessages((m) => [...m, { role: "assistant", content: json.text as string }]);
        const struct = parseStructuredArticle(json.text);
        if (struct.title && struct.content) {
          setDraft({
            title: struct.title,
            excerpt: struct.excerpt ?? "",
            content: struct.content.trim(),
            tags: struct.tags ?? "",
          });
        }
      } else if (res.status === 429) {
        setError(json.message ?? "Quota atteint.");
      } else if (res.status === 403) {
        setError("Votre rôle ne permet pas d'utiliser l'assistant.");
      } else {
        setError(json.message ?? "L'assistant n'a pas pu répondre.");
      }
    } catch {
      setError("Connexion impossible à l'assistant.");
    } finally {
      setBusy(false);
    }
  }

  function copy(text: string, id: string) {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  async function submitDraft(e: React.FormEvent) {
    e.preventDefault();
    if (!formRef.current) return;
    setSaveState(null);
    const fd = new FormData(formRef.current);
    // Statique VERROUILLÉ : brouillon — jamais publié depuis l'assistant.
    fd.set("status", "draft");
    fd.set("intent", "draft");
    const result = await saveArticle(
      { status: "idle", message: "" },
      fd
    );
    setSaveState(
      result.status === "success"
        ? "Brouillon enregistré — à relire dans Articles avant toute publication."
        : result.message || "Échec de l'enregistrement."
    );
    if (result.status === "success") {
      setMessages((m) => [...m, { role: "assistant", content: "Brouillon enregistré dans le CMS. Relisez-le dans Articles avant publication." }]);
      setDraft({ title: "", excerpt: "", content: "", tags: "" });
    }
  }

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");

  return (
    <div className="flex flex-col gap-6">
      {/* Actions rapides */}
      <section className="flex flex-wrap gap-2">
        {AI_ADMIN_TASKS.map((task) => (
          <button
            key={task.id}
            type="button"
            disabled={busy}
            onClick={() => setInput(task.template)}
            className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-600 transition-colors hover:border-guinea-red/50 hover:text-guinea-red disabled:opacity-50 dark:border-white/10 dark:text-neutral-300 dark:hover:border-guinea-red/60 dark:hover:text-guinea-red"
          >
            {task.label}
          </button>
        ))}
      </section>

      {/* Conversation */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-night-800">
        <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-bold">
          <Sparkles className="h-4 w-4 text-guinea-red" /> Conversation
        </h2>
        {messages.length === 0 && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Cliquez sur une action rapide ou décrivez votre besoin. Rappels :
            l’assistant n’invente pas de faits — les éléments non fournis sont
            marqués « [à vérifier] », et rien n’est publié automatiquement.
          </p>
        )}
        <div className="flex flex-col gap-3">
          {messages.map((m, i) => (
            <div
              key={i}
              className={
                m.role === "user"
                  ? "self-end max-w-2xl rounded-2xl rounded-br-sm bg-guinea-red px-4 py-2.5 text-sm text-white"
                  : "max-w-3xl self-start rounded-2xl rounded-bl-sm bg-neutral-100 px-4 py-2.5 text-sm whitespace-pre-wrap dark:bg-night-900"
              }
            >
              {m.role === "assistant" && (
                <div className="mb-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => copy(m.content, `msg-${i}`)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-guinea-red dark:text-neutral-400"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {copied === `msg-${i}` ? "Copié" : "Copier"}
                  </button>
                </div>
              )}
              {m.content}
            </div>
          ))}
          {busy && (
            <div className="flex items-center gap-2 self-start text-sm text-neutral-500 dark:text-neutral-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Réflexion en cours…
            </div>
          )}
        </div>
        {error && (
          <p className="mt-3 rounded-xl bg-guinea-red/10 px-3 py-2 text-sm font-semibold text-guinea-red">
            {error}
          </p>
        )}

        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            rows={3}
            maxLength={6000}
            placeholder="Votre demande (article, correction, idées…)"
            className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-guinea-red/40 dark:border-white/10 dark:bg-night-900"
          />
          <button
            type="submit"
            disabled={busy || input.trim().length === 0}
            className="flex items-center justify-center gap-2 rounded-xl bg-guinea-red px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50 sm:self-end"
          >
            <Send className="h-4 w-4" /> Envoyer
          </button>
        </form>
      </section>

      {/* Envoi vers le CMS — formulaire ÉDITABLE, relecture obligatoire */}
      {lastAssistant && draft.title && (
        <section className="rounded-2xl border border-guinea-red/30 bg-white p-5 dark:border-guinea-red/40 dark:bg-night-800">
          <h2 className="mb-2 flex items-center gap-2 font-display text-sm font-bold">
            <Bot className="h-4 w-4 text-guinea-red" /> Envoyer vers le CMS
          </h2>
          <p className="mb-4 text-xs font-semibold text-guinea-red">
            Relisez et corrigez chaque champ avant d’enregistrer. Le brouillon
            est créé dans « Articles » — il ne sera publié qu’après votre
            approbation dans le CMS.
          </p>
          <form ref={formRef} onSubmit={submitDraft} className="grid gap-3">
            <label className="grid gap-1 text-xs font-semibold">
              Titre
              <input
                name="title"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                maxLength={200}
                required
                className="rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-guinea-red/40 dark:border-white/10 dark:bg-night-900"
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold">
              Résumé
              <textarea
                name="excerpt"
                value={draft.excerpt}
                onChange={(e) => setDraft({ ...draft, excerpt: e.target.value })}
                rows={2}
                maxLength={400}
                className="rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-guinea-red/40 dark:border-white/10 dark:bg-night-900"
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold">
              Contenu (texte brut — mise en forme dans le CMS)
              <textarea
                name="content"
                value={draft.content}
                onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                rows={12}
                required
                className="rounded-lg border border-neutral-200 px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-guinea-red/40 dark:border-white/10 dark:bg-night-900"
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold">
              Mots-clés (séparés par des virgules)
              <input
                name="tags"
                value={draft.tags}
                onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
                maxLength={600}
                className="rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-guinea-red/40 dark:border-white/10 dark:bg-night-900"
              />
            </label>
            {/* Champs requis par l'action existante — statique verrouillé */}
            <input type="hidden" name="status" value="draft" />
            <input type="hidden" name="intent" value="draft" />
            <button
              type="submit"
              disabled={busy}
              className="justify-self-start rounded-xl bg-guinea-red px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Enregistrer comme brouillon
            </button>
            {saveState && (
              <p
                className={
                  saveState.startsWith("Brouillon enregistré")
                    ? "text-xs font-semibold text-emerald-600"
                    : "text-xs font-semibold text-guinea-red"
                }
              >
                {saveState}
              </p>
            )}
          </form>
        </section>
      )}
    </div>
  );
}
