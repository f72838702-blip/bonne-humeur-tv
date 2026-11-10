import { NextResponse, type NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { listCampaigns, listAllPayments } from "@/lib/data/ads";
import { AD_STATE_LABELS, adStateOf, toCsv } from "@/lib/ads/ads-core";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Export CSV — §9 : règlements et contrats en pièces jointes.
 *   - ?type=payments : règlements (ADMIN uniquement) ;
 *   - ?type=campaigns : campagnes, contrats, somme encaissée (admin+editor,
 *     mais la colonne « encaisse » est vide pour l'éditeur — RLS 0026).
 * CSV construit côté serveur, BOM Excel, jamais aucun montant inventé.
 */
export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type") === "campaigns" ? "campaigns" : "payments";

  if (type === "payments") {
    const guard = await requireRole(["admin"]);
    if ("denied" in guard) {
      if (guard.denied !== "unauthenticated") {
        return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
      }
      redirect("/admin/login");
    }
    const payments = await listAllPayments();
    const csv = toCsv(
      ["date_reglement", "campagne", "reference", "annonceur", "montant", "devise", "methode", "reference_transaction", "note"],
      payments.map((p) => [
        p.paid_on,
        p.ad_campaigns?.name ?? "",
        p.ad_campaigns?.reference ?? "",
        p.ad_campaigns?.advertisers?.name ?? "",
        String(p.amount),
        p.currency,
        p.method,
        p.transaction_reference ?? "",
        p.note ?? "",
      ])
    );
    return csvResponse(csv, "reglements-publicites.csv");
  }

  // type=campaigns : contrats + état effectif + montant réellement encaissé.
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) {
    if (guard.denied !== "unauthenticated") {
      return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
    }
    redirect("/admin/login");
  }
  if (
    guard.session.profile?.role === "editor" &&
    !hasPermission(guard.session.profile, "publicite")
  ) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }
  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Backend non configuré." }, { status: 503 });
  }

  const nowIso = new Date().toISOString();
  const campaigns = await listCampaigns({});
  const rows: unknown[][] = [];
  for (const c of campaigns) {
    const { data: paidRows, error } = await supabase
      .from("ad_payments")
      .select("amount")
      .eq("campaign_id", c.id);
    const paidSum = error
      ? 0 // RLS (éditeur) : 0 ligne, pas un 0 inventé — la valeur est vide
      : (paidRows ?? []).reduce((s: number, r: { amount: number | string }) => s + Number(r.amount), 0);
    rows.push([
      c.reference ?? "",
      c.name,
      c.advertisers?.name ?? "",
      AD_STATE_LABELS[adStateOf({ status: c.status, start_at: c.start_at, end_at: c.end_at }, nowIso)],
      c.billing_type,
      c.amount === null ? "" : String(c.amount),
      error ? "" : paidSum,
      c.currency,
      c.contract_ref ?? "",
      c.contract_signed_at ?? "",
      c.contract_start_at ?? "",
      c.contract_end_at ?? "",
    ]);
  }
  const csv = toCsv(
    ["reference", "campagne", "annonceur", "etat_effectif", "facturation", "montant", "devise", "encaisse", "contrat_ref", "signe_le", "debut", "fin"],
    rows
  );
  return csvResponse(csv, "campagnes-publicitaires.csv");
}

/** CSV UTF-8 avec BOM (Excel FR/GN), disposition pièce jointe, sans cache. */
function csvResponse(content: string, filename: string): NextResponse {
  return new NextResponse(`﻿${content}`, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}