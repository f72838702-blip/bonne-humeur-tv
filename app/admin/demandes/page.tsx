import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, Inbox, Mail, MessageSquare, Reply } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import {
  getContactMessages,
  getPartnershipRequests,
  markContactMessagesRead,
  markPartnershipRequestsSeen,
} from "@/lib/data/requests";
import { getReplyHistory } from "@/lib/data/replies";
import { formatDateTime } from "@/lib/utils";
import { groupRepliesByRequest, isRequestAnswered, replyGroupKey } from "@/lib/replies-core";
import type { RequestReply } from "@/lib/types";
import StatusBadge from "@/components/admin/StatusBadge";
import RequestStatusForm from "@/components/admin/RequestStatusForm";
import DeleteActionForm from "@/components/admin/DeleteActionForm";
import ReplyForm from "@/components/admin/ReplyForm";
import RefreshButton from "@/components/admin/RefreshButton";
import { ForbiddenScreen, NotFoundScreen, UnconfiguredScreen } from "@/components/admin/AccessDenied";
import { deleteRequestAction } from "@/lib/actions/admin";
import { countUnseenPartnerships, countUnreadContacts } from "@/lib/requests-core";

export const metadata = { title: "Demandes" };

const SERVICE_LABELS: Record<string, string> = {
  couverture: "Couverture d'événement",
  interview: "Interview",
  production: "Production audiovisuelle",
  digitale: "Stratégie digitale",
  autre: "Autre prestation",
};

const BUDGET_LABELS: Record<string, string> = {
  lt5m: "Moins de 5 millions GNF",
  "5-15m": "5 à 15 millions GNF",
  "15-50m": "15 à 50 millions GNF",
  gt50m: "Plus de 50 millions GNF",
  unknown: "Budget non précisé",
};

/** Badge « Nouveau » — affiché SEULEMENT pour ce qui n'a jamais été vu : au
 *  prochain chargement, la page aura marqué les éléments affichés → pas de
 *  notification répétée à chaque actualisation ni à chaque connexion. */
function NewBadge() {
  return (
    <span className="rounded-full bg-guinea-red px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
      Nouveau
    </span>
  );
}

function UnreadBadge() {
  return (
    <span className="rounded-full bg-guinea-red px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
      Non lu
    </span>
  );
}

/** Badge « Répondu » — UNIQUEMENT si le fournisseur a accepté un envoi
 *  (statut 'sent' en base) ; une tentative échouée ne compte jamais. */
function AnsweredBadge() {
  return (
    <span className="rounded-full bg-guinea-green px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
      Répondu
    </span>
  );
}

/** Historique chronologique des réponses de la demande (0028) : chaque
 *  ligne = une tentative, lisible du plus ancien au plus récent. */
function ReplyHistoryBlock({ replies }: { replies: RequestReply[] }) {
  if (replies.length === 0) {
    return (
      <p className="text-xs text-neutral-400">
        Aucune réponse envoyée pour l&apos;instant — cette demande est « en attente de réponse ».
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2" aria-label="Historique des réponses">
      {replies.map((reply) => (
        <li
          key={reply.id}
          className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-white/10 dark:bg-white/5"
        >
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wide">
            {reply.status === "sent" ? (
              <span className="inline-flex items-center gap-1 text-guinea-green">
                <Reply className="h-3 w-3" /> Envoyée
              </span>
            ) : (
              <span className="text-guinea-red">Échec d&apos;envoi</span>
            )}
            <span className="font-semibold lowercase tracking-normal text-neutral-500 dark:text-neutral-400">
              → {reply.recipient_email} · {formatDateTime(reply.created_at)}
            </span>
          </div>
          {reply.error && (
            <p className="mt-1 text-[11px] text-guinea-red">{reply.error}</p>
          )}
          <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-neutral-700 dark:text-neutral-300">
            {reply.body}
          </p>
        </li>
      ))}
    </ul>
  );
}

export default async function AdminRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ onglet?: string }>;
}) {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) {
    if (guard.denied === "unauthenticated") redirect("/admin/login");
    if (guard.denied === "unconfigured") return <UnconfiguredScreen />;
    return <ForbiddenScreen />;
  }
  // Suppression : ADMIN UNIQUEMENT dans l'interface (la RLS 0027
  // réapplique la même règle en dernier ressort, éditeur inclus).
  const isAdmin = guard.session.profile?.role === "admin";

  const { onglet } = await searchParams;
  const tab = onglet === "contact" ? "contact" : "partenariats";

  const [partnerships, contacts, replies] = await Promise.all([
    getPartnershipRequests(),
    getContactMessages(),
    getReplyHistory(),
  ]);

  /** Historique regroupé par demande, trié du plus ancien au plus récent. */
  const repliesByRequest = groupRepliesByRequest(replies);

  // Consultation = lecture : les éléments affichés sont marqués vu/lu
  // (UNIQUEMENT ceux encore à NULL, une seule UPDATE chacun — les
  // compteurs et badges de CE rendu montrent l'état AVANT le marquage ;
  // au prochain chargement ils sont passés à « Lu », sans répétition).
  await Promise.all([
    markPartnershipRequestsSeen(partnerships.filter((r) => !r.seen_at).map((r) => r.id)),
    markContactMessagesRead(contacts.filter((m) => !m.read_at).map((m) => m.id)),
  ]);

  const unseen = countUnseenPartnerships(partnerships);
  const unread = countUnreadContacts(contacts);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Demandes</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Demandes de partenariat B2B et messages du formulaire de contact.
          </p>
        </div>
        <RefreshButton label="Actualiser" />
      </header>

      {/* Onglets pilotés par l'URL — compteur rouge = ce qui n'est PAS
          encore consulté (jamais le total, jamais ce qui est déjà lu). */}
      <nav className="flex flex-wrap items-center gap-2" aria-label="Types de demandes">
        <Link
          href="/admin/demandes?onglet=partenariats"
          className={
            tab === "partenariats"
              ? "inline-flex items-center gap-2 rounded-full border border-guinea-red bg-guinea-red px-5 py-2 text-xs font-bold text-white"
              : "inline-flex items-center gap-2 rounded-full border border-neutral-200 px-5 py-2 text-xs font-semibold text-neutral-600 hover:border-guinea-red/50 hover:text-guinea-red dark:border-white/10 dark:text-neutral-300"
          }
        >
          <Building2 className="h-3.5 w-3.5" />
          Partenariats ({partnerships.length})
          {unseen > 0 && (
            <span className="rounded-full bg-guinea-red px-2 py-0.5 text-[10px] font-extrabold text-white">
              {unseen} nouvelle{unseen > 1 ? "s" : ""}
            </span>
          )}
        </Link>
        <Link
          href="/admin/demandes?onglet=contact"
          className={
            tab === "contact"
              ? "inline-flex items-center gap-2 rounded-full border border-guinea-red bg-guinea-red px-5 py-2 text-xs font-bold text-white"
              : "inline-flex items-center gap-2 rounded-full border border-neutral-200 px-5 py-2 text-xs font-semibold text-neutral-600 hover:border-guinea-red/50 hover:text-guinea-red dark:border-white/10 dark:text-neutral-300"
          }
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Messages ({contacts.length})
          {unread > 0 && (
            <span className="rounded-full bg-guinea-red px-2 py-0.5 text-[10px] font-extrabold text-white">
              {unread} non lu{unread > 1 ? "s" : ""}
            </span>
          )}
        </Link>
      </nav>

      {tab === "partenariats" ? (
        partnerships.length === 0 ? (
          <NotFoundScreen what="Aucune demande de partenariat" />
        ) : (
          <ul className="flex flex-col gap-4">
            {partnerships.map((r) => {
              const rReplies = repliesByRequest.get(replyGroupKey("partnership", r.id)) ?? [];
              const answered = isRequestAnswered(rReplies);
              return (
              <li
                key={r.id}
                className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-surface p-5 dark:border-white/10 dark:bg-night-800"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={r.status} />
                      {!r.seen_at && <NewBadge />}
                      {answered && <AnsweredBadge />}
                      <span className="rounded-full bg-guinea-green/10 px-2.5 py-0.5 text-[10px] font-bold uppercase text-guinea-green">
                        {SERVICE_LABELS[r.service] ?? r.service}
                      </span>
                    </div>
                    <h3 className="mt-2 font-display text-lg font-bold">
                      {r.organisation}
                    </h3>
                    <p className="text-sm font-semibold text-neutral-600 dark:text-neutral-300">
                      {r.contact_name}
                      {r.fonction ? ` — ${r.fonction}` : ""}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {r.email}
                      </span>
                      {r.phone && <span>Tél : {r.phone}</span>}
                      <span>{formatDateTime(r.created_at)}</span>
                    </p>
                  </div>
                  {r.budget && (
                    <span className="rounded-xl bg-guinea-yellow/15 px-3 py-1.5 text-[11px] font-bold text-amber-700 dark:text-guinea-yellow">
                      {BUDGET_LABELS[r.budget] ?? r.budget}
                    </span>
                  )}
                </div>

                <blockquote className="rounded-xl bg-neutral-100 px-4 py-3 text-sm leading-relaxed text-neutral-700 dark:bg-white/5 dark:text-neutral-300">
                  {r.message}
                </blockquote>
                {r.timeline && (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Échéance souhaitée : {r.timeline}
                  </p>
                )}
                {r.processed_at && (
                  <p className="text-[11px] text-neutral-400">
                    Traité le {formatDateTime(r.processed_at)}
                  </p>
                )}

                <div className="flex flex-col gap-3 border-t border-neutral-200 pt-3 dark:border-white/10">
                  {isAdmin && (
                    <ReplyForm
                      type="partnership"
                      requestId={r.id}
                      recipientEmail={r.email}
                      senderName={r.contact_name}
                    />
                  )}
                  <RequestStatusForm
                    type="partnership"
                    id={r.id}
                    status={r.status}
                    adminNote={r.admin_note}
                  />
                  <ReplyHistoryBlock replies={rReplies} />
                  {isAdmin && (
                    <DeleteActionForm
                      action={deleteRequestAction}
                      hiddenFields={{ type: "partnership", id: r.id }}
                      buttonLabel="Supprimer"
                      confirmLabel={`Supprimer définitivement la demande de ${r.organisation} (${r.contact_name}) du ${formatDateTime(r.created_at)} ? Cette action est irréversible.`}
                    />
                  )}
                </div>
              </li>
              );
            })}
          </ul>
        )
      ) : contacts.length === 0 ? (
        <NotFoundScreen what="Aucun message" />
      ) : (
        <ul className="flex flex-col gap-4">
          {contacts.map((m) => {
            const mReplies = repliesByRequest.get(replyGroupKey("contact", m.id)) ?? [];
            const answered = isRequestAnswered(mReplies);
            return (
            <li
              key={m.id}
              className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-surface p-5 dark:border-white/10 dark:bg-night-800"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={m.status} />
                    {!m.read_at && <UnreadBadge />}
                    {answered && <AnsweredBadge />}
                  </div>
                  <h3 className="mt-2 font-display text-lg font-bold">
                    {m.subject ?? "Message sans sujet"}
                  </h3>
                  <p className="text-sm font-semibold text-neutral-600 dark:text-neutral-300">{m.name}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
                    <span className="inline-flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {m.email}
                    </span>
                    {m.phone && <span>Tél : {m.phone}</span>}
                    <span>{formatDateTime(m.created_at)}</span>
                  </p>
                </div>
              </div>

              <blockquote className="rounded-xl bg-neutral-100 px-4 py-3 text-sm leading-relaxed text-neutral-700 dark:bg-white/5 dark:text-neutral-300">
                {m.message}
              </blockquote>
              {m.processed_at && (
                <p className="text-[11px] text-neutral-400">
                  Traité le {formatDateTime(m.processed_at)}
                </p>
              )}

              <div className="flex flex-col gap-3 border-t border-neutral-200 pt-3 dark:border-white/10">
                {isAdmin && (
                  <ReplyForm
                    type="contact"
                    requestId={m.id}
                    recipientEmail={m.email}
                    senderName={m.name}
                  />
                )}
                <RequestStatusForm
                  type="contact"
                  id={m.id}
                  status={m.status}
                  adminNote={m.admin_note}
                />
                <ReplyHistoryBlock replies={mReplies} />
                {isAdmin && (
                  <DeleteActionForm
                    action={deleteRequestAction}
                    hiddenFields={{ type: "contact", id: m.id }}
                    buttonLabel="Supprimer"
                    confirmLabel={`Supprimer définitivement le message de ${m.name} (${m.email}) du ${formatDateTime(m.created_at)} ? Cette action est irréversible.`}
                  />
                )}
              </div>
            </li>
            );
          })}
        </ul>
      )}

      <p className="flex items-center gap-2 text-[11px] text-neutral-400">
        <Inbox className="h-3.5 w-3.5" />
        Les coordonnées sont celles saisies par les expéditeurs — à vérifier avant usage. Suppression : réservée aux administrateurs, avec confirmation, définitive.
      </p>
    </div>
  );
}