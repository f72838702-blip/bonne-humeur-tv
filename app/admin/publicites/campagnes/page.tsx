import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { listCampaigns } from "@/lib/data/ads";
import { AD_STORED_STATUSES, AD_STATUS_LABELS, AD_STATE_LABELS, adStateOf } from "@/lib/ads/ads-core";
import { ForbiddenScreen, NotFoundScreen } from "@/components/admin/AccessDenied";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Campagnes publicitaires" };

export default async function AdminCampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) {
    if (guard.denied === "unauthenticated") redirect("/admin/login");
    return <ForbiddenScreen />;
  }

  const { q, status } = await searchParams;
  const validStatus = (AD_STORED_STATUSES as readonly string[]).includes(status ?? "") ? status! : undefined;
  const campaigns = await listCampaigns({ q: q?.trim() || undefined, status: validStatus });
  const nowIso = new Date().toISOString();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Campagnes</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Une campagne EST EFFECTIVEMENT en diffusion : active + créative
            approuvée + annonceur actif + PÉRIODE COURANTE (horloge serveur).
            Sans dates → jamais diffusée, même activée.
          </p>
        </div>
        <Link href="/admin/publicites/campagnes/new" className="rounded-xl bg-guinea-red px-5 py-2.5 text-sm font-bold text-white hover:bg-guinea-red/90">
          Nouvelle campagne
        </Link>
      </header>

      <section className="flex flex-wrap items-center gap-2">
        <FilterLink label="Toutes" href={`/admin/publicites/campagnes${q ? `?q=${encodeURIComponent(q)}` : ""}`} active={!validStatus} />
        {AD_STORED_STATUSES.map((s) => (
          <FilterLink
            key={s}
            label={AD_STATUS_LABELS[s]}
            href={`/admin/publicites/campagnes?status=${s}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            active={validStatus === s}
          />
        ))}
        <form className="ml-auto flex gap-2" action="/admin/publicites/campagnes">
          {validStatus && <input type="hidden" name="status" value={validStatus} />}
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Rechercher…"
            className="w-48 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none dark:border-white/15 dark:bg-night-800"
          />
          <button type="submit" className="rounded-xl border border-neutral-300 px-4 text-sm font-semibold dark:border-white/15">Rechercher</button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold">Campagnes ({campaigns.length})</h2>
        {campaigns.length === 0 ? (
          <NotFoundScreen what="Aucune campagne" />
        ) : (
          <div className="grid gap-3">
            {campaigns.map((c) => {
              const state = adStateOf({ status: c.status, start_at: c.start_at, end_at: c.end_at }, nowIso);
              return (
                <Link
                  key={c.id}
                  href={`/admin/publicites/campagnes/${c.id}`}
                  className="flex flex-wrap items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-4 text-sm transition-colors hover:border-guinea-red/40 dark:border-white/10 dark:bg-night-800"
                >
                  <span className="rounded-full bg-neutral-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase text-neutral-600 dark:text-neutral-300">
                    {AD_STATE_LABELS[state]}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-bold">{c.name}</span>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                    {c.advertisers?.name ?? "annonceur supprimé"}
                  </span>
                  <span className="hidden text-xs text-neutral-400 sm:inline">{c.reference}</span>
                  {c.amount !== null && (
                    <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                      {c.amount} {c.currency}
                    </span>
                  )}
                  <span className="text-xs text-neutral-400">
                    {c.start_at ? formatDate(c.start_at) : "sans période"}
                    {c.end_at ? ` → ${formatDate(c.end_at)}` : ""}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function FilterLink({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-4 py-1.5 text-xs font-bold transition-colors ${
        active
          ? "border-guinea-red bg-guinea-red/10 text-guinea-red"
          : "border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-white/15 dark:text-neutral-300 dark:hover:bg-white/10"
      }`}
    >
      {label}
    </Link>
  );
}