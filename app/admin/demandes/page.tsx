import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, Inbox, Mail, MessageSquare } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { getContactMessages, getPartnershipRequests } from "@/lib/data/requests";
import { formatDateTime } from "@/lib/utils";
import StatusBadge from "@/components/admin/StatusBadge";
import RequestStatusForm from "@/components/admin/RequestStatusForm";
import { ForbiddenScreen, NotFoundScreen, UnconfiguredScreen } from "@/components/admin/AccessDenied";

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

  const { onglet } = await searchParams;
  const tab = onglet === "contact" ? "contact" : "partenariats";

  const [partnerships, contacts] = await Promise.all([
    getPartnershipRequests(),
    getContactMessages(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Demandes</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Demandes de partenariat B2B et messages du formulaire de contact.
        </p>
      </header>

      {/* Onglets pilotés par l'URL */}
      <nav className="flex gap-2" aria-label="Types de demandes">
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
        </Link>
      </nav>

      {tab === "partenariats" ? (
        partnerships.length === 0 ? (
          <NotFoundScreen what="Aucune demande de partenariat" />
        ) : (
          <ul className="flex flex-col gap-4">
            {partnerships.map((r) => (
              <li
                key={r.id}
                className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-white/10 dark:bg-night-800"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={r.status} />
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

                <RequestStatusForm
                  type="partnership"
                  id={r.id}
                  status={r.status}
                  adminNote={r.admin_note}
                />
              </li>
            ))}
          </ul>
        )
      ) : contacts.length === 0 ? (
        <NotFoundScreen what="Aucun message" />
      ) : (
        <ul className="flex flex-col gap-4">
          {contacts.map((m) => (
            <li
              key={m.id}
              className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-white/10 dark:bg-night-800"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <StatusBadge status={m.status} />
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

              <RequestStatusForm
                type="contact"
                id={m.id}
                status={m.status}
                adminNote={m.admin_note}
              />
            </li>
          ))}
        </ul>
      )}

      <p className="flex items-center gap-2 text-[11px] text-neutral-400">
        <Inbox className="h-3.5 w-3.5" />
        Les coordonnées sont celles saisies par les expéditeurs — à vérifier avant usage.
      </p>
    </div>
  );
}