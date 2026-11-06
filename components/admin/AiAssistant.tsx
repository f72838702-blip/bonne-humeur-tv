"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bot,
  Copy,
  Loader2,
  Pencil,
  Plus,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { AI_ADMIN_TASKS } from "@/lib/ai/prompts";
import { parseStructuredArticle } from "@/lib/ai/parse-article";
import { saveArticle } from "@/lib/actions/content";
import {
  deleteConversationAction,
  getConversationMessagesAction,
  renameConversationAction,
} from "@/lib/ai/actions";

/**
 * Assistant IA de rédaction AVEC mémoire conversationnelle persistante
 * (direction §M — 06/11/2026).
 *
 * • Conversations stockées SERVEUR (0033) : liste latérale, restauration
 *   automatique de la dernière session, messages rechargés à l'identique
 *   après actualisation/fermeture/reconnexion/redéploiement. La persistance
 *   est gérée par /api/ai/admin (identité session — jamais de user_id
 *   envoyé par le client) ; le client ne propose jamais d'identité.
 * • Le texte généré reste TOUJOURS relu avant usage : « Enregistrer comme
 *   brouillon » passe par saveArticle EXISTANTE (statique « brouillon »
 *   uniquement — l'IA ne publie jamais).
 */

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ConversationInfo {
  id: string;
  title: string;
  updated_at: string;
}

interface Props {
  /** Conversations récentes du connecté (chargées côté serveur). */
  initialConversations: ConversationInfo[];
  /** Conversation à restaurer automatiquement (la plus récente). */
  initialConversationId: string | null;
}

export default function AiAssistant(props: Props) {
  const [conversations, setConversations] = useState<ConversationInfo[]>(
    props.initialConversations
  );
  const [conversationId, setConversationId] = useState<string | null>(
    props.initialConversationId
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Brouillon à envoyer au CMS (formulaire éditable — relecture obligatoire).
  const [draft, setDraft] = useState(() => ({
    title: "",
    excerpt: "",
    content: "",
    tags: "",
  }));
  const [saveState, setSaveState] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  /** Recharge l'historique complet d'une conversation (restauration fidèle). */
  const loadConversation = useCallback(async (id: string | null) => {
    if (!id) {
      setMessages([]);
      setConversationId(null);
      return;
    }
    setLoadingHistory(true);
    try {
      const rows = await getConversationMessagesAction(id);
      setMessages(rows.map((r) => ({ role: r.role, content: r.content })));
      setConversationId(id);
    } catch {
      setError("Historique indisponible.");
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // Restauration AUTOMATIQUE de la dernière conversation active (montage).
  useEffect(() => {
    if (props.initialConversationId) void loadConversation(props.initialConversationId);
  }, [props.initialConversationId, loadConversation]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

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
        body: JSON.stringify({ message, conversationId: conversationId ?? undefined }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        text?: string;
        message?: string;
        conversationId?: string;
        code?: string;
      };
      if (res.ok && json.ok && json.text) {
        setMessages((m) => [...m, { role: "assistant", content: json.text as string }]);
        if (json.conversationId && json.conversationId !== conversationId) {
          // Conversation créée côté serveur à ce 1er message.
          setConversationId(json.conversationId);
          setConversations((c) => [
            { id: json.conversationId as string, title: message.slice(0, 60), updated_at: new Date().toISOString() },
            ...c,
          ]);
        }
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
      } else if (res.status === 404) {
        // Conversation disparue entre-temps : nouveau départ propre.
        setConversationId(null);
        setError(json.message ?? "Conversation introuvable.");
      } else {
        setError(json.message ?? "L'assistant n'a pas pu répondre.");
      }
    } catch {
      setError("Connexion impossible à l'assistant.");
    } finally {
      setBusy(false);
    }
  }

  async function startNewConversation() {
    setMessages([]);
    setConversationId(null);
    setDraft({ title: "", excerpt: "", content: "", tags: "" });
    setError(null);
    // La conversation sera créée par le serveur au 1er message.
  }

  async function confirmRename(id: string) {
    const title = renameValue.trim();
    if (title.length > 0) {
      const done = await renameConversationAction(id, title);
      if (done) {
        setConversations((c) => c.map((cn) => (cn.id === id ? { ...cn, title } : cn)));
      }
    }
    setRenamingId(null);
  }

  async function confirmDelete(id: string) {
    const done = await deleteConversationAction(id);
    if (done) {
      setConversations((c) => c.filter((cn) => cn.id !== id));
      if (conversationId === id) {
        setMessages([]);
        setConversationId(null);
      }
    } else {
      setError("Suppression impossible (droits ou base indisponible).");
    }
    setDeletingId(null);
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
    const result = await saveArticle({ status: "idle", message: "" }, fd);
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
    <div className="grid gap-4 lg:grid-cols-[16rem_1fr] lg:items-start">
      {/* ─── Colonne latérale : conversations ─── */}
      <aside className="rounded-2xl border border-neutral-200 bg-surface p-3 dark:border-white/10 dark:bg-night-800">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 font-display text-xs font-bold text-neutral-500 dark:text-neutral-300">
            <Sparkles className="h-3.5 w-3.5 text-guinea-red" /> Conversations
          </h2>
          <button
            type="button"
            onClick={() => void startNewConversation()}
            className="flex items-center gap-1 rounded-full bg-guinea-red px-2.5 py-1 text-xs font-bold text-white transition-opacity hover:opacity-90"
          >
            <Plus className="h-3 w-3" /> Nouvelle
          </button>
        </div>
        {conversations.length === 0 ? (
          <p className="py-2 text-xs text-neutral-500 dark:text-neutral-400">
            Aucune conversation — vos échanges seront conservés ici.
          </p>
        ) : (
          <ul className="flex max-h-64 gap-2 overflow-x-auto lg:max-h-[60vh] lg:flex-col lg:overflow-x-visible lg:overflow-y-auto">
            {conversations.map((c) => {
              const active = c.id === conversationId;
              return (
                <li key={c.id} className="min-w-[11rem] shrink-0 lg:min-w-0">
                  {renamingId === c.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void confirmRename(c.id);
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        maxLength={200}
                        className="w-full flex-1 rounded-lg border border-neutral-300 px-2 py-1 text-xs dark:border-white/20 dark:bg-night-900"
                      />
                      <button
                        type="button"
                        onClick={() => void confirmRename(c.id)}
                        className="text-emerald-600"
                        aria-label="Confirmer le renommage"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenamingId(null)}
                        aria-label="Annuler"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div
                      className={
                        "group flex items-center justify-between gap-1 rounded-xl px-2 py-1.5 text-xs " +
                        (active
                          ? "font-semibold text-guinea-red dark:text-guinea-red"
                          : "text-neutral-600 dark:text-neutral-300")
                      }
                    >
                      <button
                        type="button"
                        className="line-clamp-2 flex-1 truncate rounded-lg text-left hover:underline"
                        onClick={() => void loadConversation(c.id)}
                        title={c.title}
                      >
                        {c.title}
                      </button>
                      <span className="flex shrink-0 items-center">
                        {active && <span className="mr-1 text-[10px] font-bold text-emerald-600">enregistrée</span>}
                        <button
                          type="button"
                          onClick={() => {
                            setRenamingId(c.id);
                            setRenameValue(c.title);
                          }}
                          aria-label={`Renommer « ${c.title} »`}
                          className="rounded p-0.5 text-neutral-400 hover:text-guinea-red lg:opacity-0 lg:group-hover:opacity-100"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        {deletingId === c.id ? (
                          <span className="flex items-center">
                            <button
                              type="button"
                              onClick={() => void confirmDelete(c.id)}
                              className="text-xs font-bold text-guinea-red"
                            >
                              Oui
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingId(null)}
                              className="ml-1 text-neutral-500"
                              aria-label="Annuler la suppression"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeletingId(c.id)}
                            aria-label={`Supprimer « ${c.title} »`}
                            className="rounded p-0.5 text-neutral-400 hover:text-guinea-red lg:opacity-0 lg:group-hover:opacity-100"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      <div className="flex min-w-0 flex-col gap-6">
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
        <section className="rounded-2xl border border-neutral-200 bg-surface p-4 dark:border-white/10 dark:bg-night-800">
          <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-bold">
            <Sparkles className="h-4 w-4 text-guinea-red" /> Conversation
            <span className="ml-auto text-xs font-normal text-neutral-500 dark:text-neutral-400">
              {conversationId
                ? busy || loadingHistory
                  ? null
                  : "enregistrée sur le serveur"
                : "démarrez — sauvegardée au 1er message"}
            </span>
          </h2>
          {messages.length === 0 && !loadingHistory && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Cliquez sur une action rapide ou décrivez votre besoin. Rappels :
              l’assistant n’invente pas de faits — les éléments non fournis sont
              marqués « [à vérifier] », et rien n’est publié automatiquement.
            </p>
          )}
          {loadingHistory && (
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Restauration de l’historique…
            </div>
          )}

          <div ref={scrollRef} className="flex flex-col gap-3">
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
              className="w-full rounded-xl border border-neutral-200 bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-guinea-red/40 dark:border-white/10 dark:bg-night-900"
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
          <section className="rounded-2xl border border-guinea-red/30 bg-surface p-5 dark:border-guinea-red/40 dark:bg-night-800">
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
                  className="rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-guinea-red/40 dark:border-white/10 dark:bg-night-900"
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
    </div>
  );
}
