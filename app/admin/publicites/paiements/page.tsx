import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { listAllPayments } from "@/lib/data/ads";
import { ForbiddenScreen, NotFoundScreen } from "@/components/admin/AccessDenied";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Règlements publicitaires" };

/**
 * Règlements MANUELS de toutes les campagnes — ADMIN exclusivement
 * (RLS 0026 : l'éditor n'en lit AUCUNE). Aucune passerelle externe ;
 * les montants sont encaissés hors plateforme puis déclarés ici.
 */
export default async function AdminPaymentsPage() {
  const guard = await requireRole(["admin"]);
  if ("denied" in guard) {
    if (guard.denied === "unauthenticated") redirect("/admin/login");
    return <ForbiddenScreen />;
  }

  const payments = await listAllPayments();
  const totalByCurrency = new Map<string, number>();
  for (const p of payments) {
    totalByCurrency.set(p.currency, (totalByCurrency.get(p.currency) ?? 0) + Number(p.amount));
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Règlements</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Encaissements réels déclarés manuellement (espèces, Mobile
            Money, virement, chèque). Le détail des campagnes se trouve
            sur chaque fiche.
          </p>
        </div>
        <a
          href="/admin/publicites/export?type=payments"
          className="inline-flex items-center gap-2 rounded-xl bg-guinea-red px-5 py-2.5 text-sm font-bold text-white hover:bg-guinea-red/90"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </a>
      </header>

      {totalByCurrency.size > 0 && (
        <section className="flex flex-wrap gap-3">
          {[...totalByCurrency.entries()].map(([currency, total]) => (
            <div key={currency} className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-white/10 dark:bg-night-800">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">Total {currency}</p>
              <p className="mt-1 font-display text-2xl font-extrabold">{total.toLocaleString("fr-FR")}</p>
            </div>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold">Règlements ({payments.length})</h2>
        {payments.length === 0 ? (
          <NotFoundScreen what="Règlement" />
        ) : (
          <div className="grid gap-3">
            {payments.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-4 text-sm dark:border-white/10 dark:bg-night-800">
                <span className="font-bold">{Number(p.amount).toLocaleString("fr-FR")} {p.currency}</span>
                {p.ad_campaigns ? (
                  <span className="min-w-0 flex-1 truncate">
                    {p.ad_campaigns.name}
                    {p.ad_campaigns.advertisers ? ` · ${p.ad_campaigns.advertisers.name}` : ""}
                  </span>
                ) : (
                  <span className="min-w-0 flex-1 truncate text-neutral-400">campagne supprimée</span>
                )}
                <span className="text-xs text-neutral-400">{formatDate(p.paid_on)} · {p.method}</span>
                {p.transaction_reference && <span className="text-xs text-neutral-500">réf. {p.transaction_reference}</span>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}