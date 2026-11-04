import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { getAdsDashboardCounters, listPubliciteAds } from "@/lib/data/ads";
import { adStateOf, type AdStoredStatus } from "@/lib/ads/ads-core";
import {
  SIMPLE_DURATIONS,
  SIMPLE_PLACEMENT_LABELS,
  SIMPLE_FORMAT_CARDS,
  SIMPLE_FORMAT_LABELS,
  type SimpleAdFormat,
} from "@/lib/ads/simple-ad";
import { deleteCampaignAction } from "@/lib/actions/ads";
import { SimpleStatusButton, ExtendControl } from "@/components/admin/AdsForms";
import DeleteActionForm from "@/components/admin/DeleteActionForm";
import { ForbiddenScreen } from "@/components/admin/AccessDenied";

export const metadata = { title: "Publicités" };

/**
 * CENTRE DE GESTION simplifié — « une publicité = un formulaire = une
 * publication ». Un seul écran : compteurs réels, bouton + NOUVELLE
 * PUBLICITÉ, liste complète avec les actions courantes directement
 * accessibles (Modifier, Suspendre/Reprendre, Prolonger, Supprimer avec
 * confirmation) et filtres simples. La gestion commerciale détaillée
 * (campagnes, annonceurs, emplacements, règlements, export) reste
 * INTACTE, repliée sous « Gestion avancée » — rien n'est supprimé.
 */

type FilterKey = "all" | "diffusing" | "suspended" | "programmed" | "draft" | "expired" | "completed";

const FILTRE_LABELS: Record<Exclude<FilterKey, "all">, string> = {
  diffusing: "En diffusion",
  suspended: "Suspendues",
  programmed: "Programmées",
  draft: "Brouillons",
  expired: "Terminées / expirées",
  completed: "Clôturées",
};

function filterKey(raw: string | undefined): { key: FilterKey; label: string } | null {
  if (!raw || !Object.prototype.hasOwnProperty.call(FILTRE_LABELS, raw)) return null;
  return { key: raw as FilterKey, label: FILTRE_LABELS[raw as Exclude<FilterKey, "all">] };
}

const CLOSED_STATES = ["completed", "cancelled", "refused"];

export default async function AdminPublicitesPage({
  searchParams,
}: {
  searchParams: Promise<{ filtre?: string }>;
}) {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) {
    if (guard.denied === "unauthenticated") redirect("/admin/login");
    return <ForbiddenScreen />;
  }
  const role = (guard.session.profile?.role ?? "reporter") as "admin" | "editor";
  const { filtre } = await searchParams;
  const activeFilter = filterKey(filtre) ?? { key: "all" as FilterKey, label: "Toutes" };

  const [counters, ads] = await Promise.all([getAdsDashboardCounters(), listPubliciteAds()]);

  const nowIso = new Date().toISOString();
  const withState = ads.map((ad) => ({
    ad,
    state: adStateOf(
      { status: ad.status as AdStoredStatus, start_at: ad.start_at, end_at: ad.end_at },
      nowIso
    ),
  }));
  const counts: Record<Exclude<FilterKey, "all">, number> = {
    diffusing: 0, suspended: 0, programmed: 0, draft: 0, expired: 0, completed: 0,
  };
  for (const { state } of withState) {
    if (CLOSED_STATES.includes(state)) counts.completed += 1;
    else if (state in counts) counts[state as Exclude<FilterKey, "all">] += 1;
  }
  const visible =
    activeFilter.key === "all"
      ? withState
      : activeFilter.key === "completed"
        ? withState.filter((r) => CLOSED_STATES.includes(r.state))
        : withState.filter((r) => r.state === activeFilter.key);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Publicités</h1>
          <p className="mt-1 max-w-xl text-sm text-neutral-500 dark:text-neutral-400">
            Créez une publicité en quelques minutes : l&apos;entreprise, le
            format, l&apos;endroit, la durée — tout le reste est automatique.
          </p>
        </div>
        <Link
          href="/admin/publicites/nouvelle"
          className="inline-flex items-center gap-2 rounded-2xl bg-guinea-red px-6 py-4 text-base font-extrabold text-white shadow-md hover:bg-guinea-red/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-guinea-red sm:text-lg"
        >
          <span aria-hidden className="text-2xl leading-none">+</span> NOUVELLE PUBLICITÉ
        </Link>
      </header>

      {/* ─── Compteurs RÉELS (aucun chiffre décoratif) ─── */}
      <section aria-label="Tableau de bord" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="En diffusion" value={counts.diffusing} hint="visibles sur le site maintenant" />
        <StatCard label="Programmées" value={counts.programmed} hint="commenceront à leur date de début" />
        <StatCard label="Brouillons" value={counts.draft} hint="pas encore publiées" />
        <StatCard
          label="Impressions"
          value={counters.impressionsTotal}
          hint={`${counters.clicksTotal} clics — indicateurs, jamais certifiés`}
        />
      </section>

      {/* ─── Liste des publicités ─── */}
      <section className="flex flex-col gap-3">
        <nav aria-label="Filtres de publicités" className="flex flex-wrap gap-2">
          <Link
            href="/admin/publicites"
            className={`rounded-full px-4 py-2 text-sm font-bold ${
              activeFilter.key === "all"
                ? "bg-guinea-red text-white"
                : "border border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-white/15 dark:text-neutral-300 dark:hover:bg-white/10"
            }`}
          >
            Toutes <span className="opacity-60">({withState.length})</span>
          </Link>
          {(Object.keys(FILTRE_LABELS) as Exclude<FilterKey, "all">[]).map((key) => (
            <Link
              key={key}
              href={`/admin/publicites?filtre=${key}`}
              className={`rounded-full px-4 py-2 text-sm font-bold ${
                activeFilter.key === key
                  ? "bg-guinea-red text-white"
                  : "border border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-white/15 dark:text-neutral-300 dark:hover:bg-white/10"
              }`}
            >
              {FILTRE_LABELS[key]} <span className="opacity-60">({counts[key]})</span>
            </Link>
          ))}
        </nav>

        {withState.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center dark:border-white/15 dark:bg-night-800">
            <p className="font-display text-lg font-bold">Aucune publicité pour l&apos;instant</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500 dark:text-neutral-400">
              Cliquez sur « + NOUVELLE PUBLICITÉ » : choisissez l&apos;entreprise, un format, où l&apos;afficher, une durée — puis publiez.
            </p>
            <Link
              href="/admin/publicites/nouvelle"
              className="mt-5 inline-flex rounded-xl bg-guinea-red px-6 py-3 text-sm font-bold text-white hover:bg-guinea-red/90"
            >
              Créer la première publicité
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {visible.length === 0 && (
              <p className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-500 dark:border-white/10 dark:bg-night-800 dark:text-neutral-400">
                Aucune publicité dans ce filtre.
              </p>
            )}
            {visible.map(({ ad, state }) => (
              <AdRow key={ad.id} ad={ad} state={state} role={role} />
            ))}
          </div>
        )}
      </section>

      {/* ─── Gestion avancée (repliée — rien n'a été supprimé) ─── */}
      <details className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-white/10 dark:bg-night-800">
        <summary className="cursor-pointer font-display text-base font-bold">Gestion avancée</summary>
        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
          Outils commerciaux complets : fiches détaillées, contrats et
          règlements manuels, exports CSV, statistiques journalières. Les
          statistiques restent INDICATIVES (jamais une audience certifiée).
        </p>
        <nav className="mt-4 flex flex-wrap gap-3">
          <AdvLink href="/admin/publicites/campagnes">Campagnes détaillées</AdvLink>
          <AdvLink href="/admin/publicites/annonceurs">Annonceurs</AdvLink>
          <AdvLink href="/admin/publicites/emplacements">Emplacements</AdvLink>
          <AdvLink href="/admin/publicites/partenaires">Partenaires</AdvLink>
          <AdvLink href="/admin/publicites/statistiques">Statistiques</AdvLink>
          {role === "admin" && <AdvLink href="/admin/publicites/paiements">Règlements</AdvLink>}
        </nav>
        <div className="mt-4 grid gap-1 text-xs text-neutral-500 dark:text-neutral-400">
          <p>Formats : {SIMPLE_FORMAT_CARDS.map((f) => f.label).join(" · ")}.</p>
          <p>Durées : {SIMPLE_DURATIONS.map((d) => d.label).join(" · ")} — 7 jours par défaut (dates Conakry, stockées en UTC).</p>
        </div>
      </details>
    </div>
  );
}

// ─── Ligne « publicité » — visuel réel, infos lisibles, actions 1 clic ──
function AdRow({
  ad,
  state,
  role,
}: {
  ad: Awaited<ReturnType<typeof listPubliciteAds>>[number];
  state: ReturnType<typeof adStateOf>;
  role: "admin" | "editor";
}) {
  const payload = (ad.creative?.payload ?? {}) as Record<string, string | undefined>;
  const imageUrl = payload.image_url || payload.logo_url || null;
  const thumb = imageUrl ?? (ad.creative?.format === "video" ? youtubeThumb(payload.youtube_url) : null);
  const awaitingApproval = ad.creative?.status === "draft" && (state === "diffusing" || state === "programmed");
  const paused = state === "draft" || state === "paused";

  return (
    <article className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-night-800">
      <div className="flex flex-wrap items-center gap-4">
        {/* Visuel RÉEL de la publication (image / vignette YouTube / initiale) */}
        <div className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-neutral-100 dark:bg-white/5">
          {thumb && /^(https?:)?\/\//i.test(thumb) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <span aria-hidden className="text-lg font-extrabold text-neutral-400">
              {(ad.name || "?").charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-bold">{ad.name}</h3>
            <StateBadge state={state} awaitingApproval={awaitingApproval} />
          </div>
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            {[ad.advertiser_name ?? "—",
              ad.creative ? SIMPLE_FORMAT_LABELS[ad.creative.format as SimpleAdFormat] ?? ad.creative.format : "sans visuel",
              ad.placements.length > 0
                ? ad.placements.map((p) => SIMPLE_PLACEMENT_LABELS[p] ?? p).join(", ")
                : null,
              periodText(ad.start_at, ad.end_at),
            ].filter(Boolean).join(" · ")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/admin/publicites/campagnes/${ad.id}`}
            className="rounded-xl border border-neutral-300 px-3.5 py-2 text-xs font-bold hover:bg-neutral-100 dark:border-white/15 dark:hover:bg-white/10"
          >
            Modifier
          </Link>
          {!paused && (
            <SimpleStatusButton adId={ad.id} to={state === "suspended" ? "active" : "suspended"} label={state === "suspended" ? "Reprendre" : "Suspendre"} />
          )}
          {!paused && (
            <ExtendControl adId={ad.id} />
          )}
          {role === "admin" && (
            <DeleteActionForm
              action={deleteCampaignAction}
              hiddenFields={{ id: ad.id }}
              confirmLabel={`Supprimer définitivement « ${ad.name} » avec son visuel et ses liens d'emplacement ? Irréversible.`}
              buttonLabel="Supprimer"
            />
          )}
        </div>
      </div>
    </article>
  );
}

function StateBadge({ state, awaitingApproval }: { state: string; awaitingApproval: boolean }) {
  let label: string = state;
  let cls = "bg-neutral-500/15 text-neutral-500";
  if (awaitingApproval) {
    label = "À valider par un administrateur";
    cls = "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  } else {
    switch (state) {
      case "diffusing": label = "En diffusion"; cls = "bg-guinea-green/15 text-guinea-green"; break;
      case "programmed": label = "Programmée"; cls = "bg-sky-500/15 text-sky-700 dark:text-sky-300"; break;
      case "draft": label = "Brouillon"; break;
      case "suspended": label = "Suspendue"; cls = "bg-amber-500/15 text-amber-700 dark:text-amber-300"; break;
      case "expired": label = "Terminée"; cls = "bg-neutral-500/15 text-neutral-400"; break;
      case "paused": label = "Sans période"; cls = "bg-red-500/15 text-red-600"; break;
      case "completed": label = "Clôturée"; break;
      case "cancelled": label = "Annulée"; break;
      case "refused": label = "Refusée"; cls = "bg-red-500/15 text-red-600"; break;
    }
  }
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${cls}`}>{label}</span>
  );
}

/** Vignette YouTube dérivée de l'URL canonique (aucun appel réseau serveur). */
function youtubeThumb(url: string | undefined): string | null {
  if (!url) return null;
  const m = /[?&]v=([\w-]{11})|youtu\.be\/([\w-]{11})/.exec(url);
  const id = m?.[1] ?? m?.[2];
  return id ? `https://i.ytimg.com/vi/${id}/default.jpg` : null;
}

function periodText(start: string | null, end: string | null): string {
  if (!start || !end) return "sans période";
  const fmt = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
  return `du ${fmt(start)} au ${fmt(end)}`;
}

function StatCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-white/10 dark:bg-night-800">
      <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">{label}</p>
      <p className="mt-1 font-display text-3xl font-extrabold">{value}</p>
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{hint}</p>
    </div>
  );
}

function AdvLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-neutral-300 px-4 py-2 text-xs font-bold hover:bg-neutral-100 dark:border-white/15 dark:hover:bg-white/10"
    >
      {children}
    </Link>
  );
}