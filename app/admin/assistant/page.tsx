import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { ForbiddenScreen, UnconfiguredScreen } from "@/components/admin/AccessDenied";
import AiAssistant, { type ConversationInfo } from "@/components/admin/AiAssistant";
import { listConversations } from "@/lib/data/ai-conversations";

export const metadata = { title: "Assistant IA — Rédaction" };

/**
 * Assistant IA PRIVÉ de rédaction AVEC mémoire conversationnelle (0033).
 * Garde serveur requireRole (admin/editor) — l'entrée est aussi masquée
 * dans la Sidebar, mais la page revérifie toujours.
 * Liste des conversations chargée CÔTÉ SERVEUR (client session sous RLS,
 * identité session) et PROPRIÉTÉ de la dernière conversation :
 * sa restauration automatique au montage n'expose rien à un autre compte.
 */
export default async function AdminAssistantPage() {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) {
    if (guard.denied === "unauthenticated") redirect("/admin/login");
    if (guard.denied === "unconfigured") return <UnconfiguredScreen />;
    return <ForbiddenScreen />;
  }

  const rows = await listConversations(guard.session.userId);
  const conversations: ConversationInfo[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    updated_at: r.updated_at,
  }));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold sm:text-3xl">
          Assistant IA — Rédaction
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-neutral-500 dark:text-neutral-400">
          Aide à la rédaction journalistique : rédaction d’articles, communiqué
          → article, titres multiples, résumés, corrections, reformulations,
          publications Facebook, descriptions YouTube, questions d’interview et
          idées de sujets. L’assistant NE PUBLIE JAMAIS : tout texte généré doit
          être relu et enregistré en brouillon avant publication par la rédaction.
          Vos conversations sont conservées sur votre compte (privées),
          avec une mémoire de vos décisions et préférences de travail.
        </p>
      </header>
      <AiAssistant
        initialConversations={conversations}
        initialConversationId={conversations[0]?.id ?? null}
      />
    </div>
  );
}
