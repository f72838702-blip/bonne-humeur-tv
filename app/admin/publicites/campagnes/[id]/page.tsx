import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Download } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import {
  getCampaign,
  getCampaignCreatives,
  getCampaignPlacements,
  getCampaignPayments,
  listAdvertisers,
  listDailyStats,
} from "@/lib/data/ads";
import { getPublishedArticles } from "@/lib/data/articles";
import {
  AD_STATUS_LABELS,
  AD_STATE_LABELS,
  AD_FORMAT_LABELS,
  PAYMENT_STATE_LABELS,
  adStateOf,
  computedCtr,
  paymentStateOf,
} from "@/lib/ads/ads-core";
import type { AdFormat, AdStoredStatus } from "@/lib/ads/ads-core";
import { CampaignForm, CreativeForm, CreativeDecisionButtons, StatusActions, PaymentForm, StatusLabel } from "@/components/admin/AdsForms";
import DeleteActionForm from "@/components/admin/DeleteActionForm";
import { deleteCampaignAction, deletePaymentAction } from "@/lib/actions/ads";
import { ForbiddenScreen, NotFoundScreen } from "@/components/admin/AccessDenied";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Fiche campagne" };

export default async function AdminCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) {
    if (guard.denied === "unauthenticated") redirect("/admin/login");
    return <ForbiddenScreen />;
  }
  const role = (guard.session.profile?.role ?? "reporter") as "admin" | "editor";

  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();

  const campaign = await getCampaign(id);
  if (!campaign) return <NotFoundScreen what="Campagne introuvable" />;

  const [creatives, links, advertisers, published] = await Promise.all([
    getCampaignCreatives(id),
    getCampaignPlacements(id),
    listAdvertisers(),
    getPublishedArticles({ perPage: 100 }),
  ]);
  // Règlements — requête séparée : l'éditeur ne les lit PAS (RLS, liste vide).
  const payments = await getCampaignPayments(id);

  const articleOptions = published.items
    .filter((a) => a.status === "published")
    .map((a) => ({ id: a.id, title: a.title }));

  const nowIso = new Date().toISOString();
  const state = adStateOf({ status: campaign.status, start_at: campaign.start_at, end_at: campaign.end_at }, nowIso);
  const paidSum = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const payState = campaign.amount !== null
    ? paymentStateOf({ amount: Number(campaign.amount), paidSum, contract_end_at: campaign.contract_end_at, nowIso })
    : null;
  const daily = await listDailyStats({ campaignId: id });
  let impressions = 0;
  let clicks = 0;
  for (const row of daily) {
    impressions += Number(row.impressions);
    clicks += Number(row.clicks);
  }
  const ctr = computedCtr(clicks, impressions);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/publicites/campagnes" className="text-xs font-semibold text-guinea-red hover:underline">← Campagnes</Link>
          <h1 className="font-display text-2xl font-extrabold sm:text-3xl">{campaign.name}</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {campaign.advertisers?.name ? (
              <Link href={`/admin/publicites/annonceurs/${campaign.advertisers.id}`} className="hover:underline">{campaign.advertisers.name}</Link>
            ) : "annonceur supprimé"}
            {" · Réf. "}
            {campaign.reference}
            {" · "}
            {formatDate(campaign.created_at)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusLabel status={state} />
          {state !== campaign.status && (
            <span className="text-[10px] font-bold uppercase text-neutral-400">{AD_STATUS_LABELS[campaign.status]} (statut enregistré)</span>
          )}
        </div>
      </header>

      {/* ─── Machine à états ─── */}
      <section className="rounded-2xl border border-neutral-200 bg-surface p-6 dark:border-white/10 dark:bg-night-800">
        <h2 className="mb-3 font-display text-base font-bold">Cycle de vie</h2>
        <p className="mb-3 text-sm text-neutral-500 dark:text-neutral-400">
          État effectif : {AD_STATE_LABELS[state]}. {state === "paused" && "Aucune date → jamais diffusée, même activée (fail-closed)."}
          {state === "programmed" && "Diffusion effective quand la période de diffusion commence (horloge serveur)."}
          {state === "expired" && "Période passée : plus jamais diffusée ; prolonger = modifier les dates puis réactiver."}
        </p>
        <StatusActions campaignId={id} status={campaign.status as AdStoredStatus} role={role} />
      </section>

      {/* ─── Édition de la campagne ─── */}
      <section className="rounded-2xl border border-neutral-200 bg-surface p-6 dark:border-white/10 dark:bg-night-800">
        <h2 className="mb-4 font-display text-base font-bold">Modifier la campagne</h2>
        <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
          Modifier les dates ou les emplacements ne RÉINITIALISE JAMAIS le
          statut ni l&#39;approbation des créations.
        </p>
        <CampaignForm
          advertisers={advertisers.map((a) => ({ id: a.id, name: a.name, is_active: a.is_active }))}
          item={campaign}
          selectedPlacements={links?.map((l) => l.placement_code) ?? []}
        />
      </section>

      {/* ─── Contrat ─── */}
      <section className="rounded-2xl border border-neutral-200 bg-surface p-6 dark:border-white/10 dark:bg-night-800">
        <h2 className="font-display text-base font-bold">Contrat — {payState ? PAYMENT_STATE_LABELS[payState] : "montant non fixé"}</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <Detail label="Facturation" value={campaign.billing_type === "forfait_plus_production" ? "Forfait + production" : "Forfait"} />
          <Detail label="Montant" value={campaign.amount !== null ? `${campaign.amount} ${campaign.currency}` : "—"} />
          <Detail label="Signé le" value={campaign.contract_signed_at ? formatDate(campaign.contract_signed_at) : "—"} />
          <Detail label="Période contractuelle" value={[campaign.contract_start_at, campaign.contract_end_at].filter(Boolean).map(formatDate).join(" → ") || "—"} />
          <Detail label="Référence contrat" value={campaign.contract_ref ?? "—"} />
          <Detail label="Encaissé" value={paidSum > 0 ? String(paidSum) : "0"} />
          {campaign.contract_terms && <Detail label="Conditions" value={campaign.contract_terms} full />}
          {campaign.description && <Detail label="Description" value={campaign.description} full />}
        </dl>
        <div className="mt-4">
          <a
            href="/admin/publicites/export?type=payments"
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 px-4 py-2 text-xs font-semibold hover:bg-neutral-100 dark:border-white/15 dark:hover:bg-white/10"
          >
            <Download className="h-3.5 w-3.5" />
            CSV du contrat & règlements
          </a>
        </div>
      </section>

      {/* ─── Statistiques (réelles, indicatives) ─── */}
      <section className="rounded-2xl border border-neutral-200 bg-surface p-6 dark:border-white/10 dark:bg-night-800">
        <h2 className="font-display text-base font-bold">Statistiques (indicatives — jamais certifiées)</h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {impressions} impressions · {clicks} clics · CTR {ctr === null ? "—" : `${ctr} %`} —
          agrégats dédupliqués (max 1 impression et 1 clic par empreinte/jour).
        </p>
        <Link href="/admin/publicites/statistiques" className="mt-3 inline-block text-xs font-semibold text-guinea-red hover:underline">Détail journalier →</Link>
      </section>

      {/* ─── Créations ─── */}
      <section className="flex flex-col gap-4">
        <h2 className="font-display text-lg font-bold">Créations ({creatives.length})</h2>
        {creatives.map((creative) => (
          <div key={creative.id} className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-surface p-4 dark:border-white/10 dark:bg-night-800">
            <StatusRow title={creative.name} note={`${AD_FORMAT_LABELS[creative.format]} · poids ${creative.weight}${creative.article_id ? " · article lié" : ""}`} status={creative.status} />
            <CreativeDecisionButtons creativeId={creative.id} />
            <details>
              <summary className="cursor-pointer text-xs font-semibold text-guinea-red">Modifier la création</summary>
              <div className="mt-3">
                <CreativeForm campaignId={id} articleOptions={articleOptions} item={creative} />
              </div>
            </details>
          </div>
        ))}
        <details className="rounded-2xl border border-neutral-200 bg-surface p-4 dark:border-white/10 dark:bg-night-800">
          <summary className="cursor-pointer text-sm font-bold">+ Nouvelle création</summary>
          <div className="mt-3">
            <CreativeForm campaignId={id} articleOptions={articleOptions} />
          </div>
        </details>
      </section>

      {/* ─── Règlements (admin — l'éditeur n'en voit aucune : RLS) ─── */}
      {role === "admin" && (
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-lg font-bold">Règlements ({payments?.length ?? 0})</h2>
          {(payments ?? []).map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-neutral-200 bg-surface p-4 text-sm dark:border-white/10 dark:bg-night-800">
              <span className="font-bold">{Number(p.amount).toLocaleString("fr-FR")} {p.currency}</span>
              <span className="text-xs text-neutral-400">{formatDate(p.paid_on)} · {p.method}</span>
              {p.transaction_reference && <span className="text-xs text-neutral-500">réf. {p.transaction_reference}</span>}
              <span className="ml-auto">
                <DeleteActionForm action={deletePaymentAction} hiddenFields={{ id: p.id }} confirmLabel={`Supprimer le règlement du ${formatDate(p.paid_on)} ?`} />
              </span>
            </div>
          ))}
          <details className="rounded-2xl border border-neutral-200 bg-surface p-4 dark:border-white/10 dark:bg-night-800">
            <summary className="cursor-pointer text-sm font-bold">+ Enregistrer un règlement (paiement MANUEL — aucune passerelle externe)</summary>
            <div className="mt-3"><PaymentForm campaignId={id} /></div>
          </details>
        </section>
      )}

      <section>
        <DeleteActionForm
          action={deleteCampaignAction}
          hiddenFields={{ id }}
          confirmLabel="Supprimer définitivement la campagne, ses créations et ses règlements ? L'ADMIN UNIQUE — et l'historique commercial le perd."
        />
      </section>
    </div>
  );
}

function StatusRow({ title, note, status }: { title: string; note: string; status: string }) {
  const tone = status === "approved" ? "text-guinea-green" : status === "refused" ? "text-guinea-red" : "text-neutral-500";
  return (
    <span className="flex flex-wrap items-center gap-2 text-sm">
      <span className={`rounded-full bg-neutral-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase ${tone}`}>{status}</span>
      <span className="font-bold">{title}</span>
      <span className="text-xs text-neutral-400">{note}</span>
    </span>
  );
}

function Detail({ label, value, full = false }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <dt className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">{label}</dt>
      <dd className="mt-0.5 text-sm">{value}</dd>
    </div>
  );
}