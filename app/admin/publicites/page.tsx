import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { listPubliciteAds } from "@/lib/data/ads";
import { adStateOf, type AdStoredStatus } from "@/lib/ads/ads-core";
import {
  SIMPLE_PLACEMENT_LABELS,
  SIMPLE_FORMAT_LABELS,
  type SimpleAdFormat,
} from "@/lib/ads/simple-ad";
import { deleteCampaignAction } from "@/lib/actions/ads";
import { SimpleStatusButton, ExtendControl } from "@/components/admin/AdsForms";
import DeleteActionForm from "@/components/admin/DeleteActionForm";
import { ForbiddenScreen } from "@/components/admin/AccessDenied";

export const metadata = { title: "Publicités" };

/**
 * RÉGIE ULTRA SIMPLE — une seule page « Publicités » :
 *   • le gros bouton « + Créer une publicité » ;
 *   • 3 infos en haut (en cours / programmées / terminées) ;
 *   • les publicités elles-mêmes, groupées lisiblement, avec 5 actions.
 * La gestion commerciale complète (campagnes détaillées, annonceurs,
 * emplacements, règlements, statistiques, exports) reste INTACTE, repliée
 * sous « Gestion avancée » réservée aux administrateurs — rien n'est
 * supprimé et la publication n'en dépend jamais.
 */

type Group = "diffusing" | "programmed" | "finished";

const GROUP_TITLES: { key: Group; title: string; hint: string }[] = [
  { key: "diffusing", title: "En diffusion", hint: "visibles sur le site en ce moment" },
  { key: "programmed", title: "Programmées", hint: "commenceront à la date choisie" },
  { key: "finished", title: "Terminées", hint: "terminées, suspendues, clôturées ou brouillons" },
];

export default async function AdminPublicitesPage() {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) {
    if (guard.denied === "unauthenticated") redirect("/admin/login");
    return <ForbiddenScreen />;
  }
  const role = (guard.session.profile?.role ?? "reporter") as "admin" | "editor";

  const ads = await listPubliciteAds();
  const nowIso = new Date().toISOString();

  const rows = ads.map((ad) => {
    const state = adStateOf(
      { status: ad.status as AdStoredStatus, start_at: ad.start_at, end_at: ad.end_at },
      nowIso
    );
    return { ad, state, group: groupOf(state) };
  });

  const counts: Record<Group, number> = { diffusing: 0, programmed: 0, finished: 0 };
  for (const r of rows) counts[r.group] += 1;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col items-start gap-4">
        <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Publicités</h1>
        <Link
          href="/admin/publicites/nouvelle"
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-guinea-red px-8 py-5 text-lg font-extrabold text-white shadow-lg hover:bg-guinea-red/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-guinea-red sm:w-auto sm:text-xl"
        >
          <span aria-hidden className="text-2xl leading-none">+</span> Créer une publicité
        </Link>
      </header>

      {/* ─── 3 infos en haut : compteurs RÉELS ─── */}
      <section aria-label="Situation des publicités" className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Publicités en cours" value={counts.diffusing} hint="visibles sur le site maintenant" />
        <StatCard label="Publicités programmées" value={counts.programmed} hint="commenceront à leur date de début" />
        <StatCard label="Publicités terminées" value={counts.finished} hint="passées, suspendues, clôturées ou brouillons" />
      </section>

      {/* ─── Les publicités, groupées ─── */}
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center dark:border-white/15 dark:bg-night-800">
          <p className="font-display text-lg font-bold">Aucune publicité pour l&apos;instant</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500 dark:text-neutral-400">
            Cliquez sur « Créer une publicité » : choisissez un format, ajoutez
            le contenu, l&apos;endroit, la durée — puis publiez. Tout le reste
            est automatique.
          </p>
        </div>
      ) : (
        GROUP_TITLES.map(({ key, title, hint }) => {
          const groupRows = rows.filter((r) => r.group === key);
          if (groupRows.length === 0) return null;
          return (
            <section key={key} aria-label={title} className="flex flex-col gap-3">
              <div className="flex items-baseline gap-3">
                <h2 className="font-display text-lg font-extrabold">{title}</h2>
                <span className="text-xs text-neutral-400">{groupRows.length} · {hint}</span>
              </div>
              <div className="flex flex-col gap-3">
                {groupRows.map(({ ad, state }) => (
                  <AdRow key={ad.id} ad={ad} state={state} role={role} />
                ))}
              </div>
            </section>
          );
        })
      )}

      {/* ─── Gestion avancée : réservée aux ADMINISTRATEURS, repliée ─── */}
      {role === "admin" && (
        <details className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-white/10 dark:bg-night-800">
          <summary className="cursor-pointer font-display text-base font-bold">Gestion avancée</summary>
          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            Outils commerciaux complets : fiches détaillées, contrats et
            règlements manuels, exports CSV, statistiques journalières. Les
            statistiques restent INDICATIVES (jamais une audience certifiée).
            La création simplifiée ci-dessus n&apos;a jamais besoin de cette zone.
          </p>
          <nav className="mt-4 flex flex-wrap gap-3">
            <AdvLink href="/admin/publicites/campagnes">Campagnes détaillées</AdvLink>
            <AdvLink href="/admin/publicites/annonceurs">Annonceurs</AdvLink>
            <AdvLink href="/admin/publicites/emplacements">Emplacements</AdvLink>
            <AdvLink href="/admin/publicites/partenaires">Partenaires</AdvLink>
            <AdvLink href="/admin/publicites/statistiques">Statistiques</AdvLink>
            <AdvLink href="/admin/publicites/paiements">Règlements</AdvLink>
          </nav>
        </details>
      )}
    </div>
  );
}

/** 3 groupes simples à partir de l'état réel (aucun état inventé). */
function groupOf(state: string): Group {
  if (state === "diffusing") return "diffusing";
  if (state === "programmed") return "programmed";
  return "finished"; // expired, suspended, draft, paused, completed, cancelled, refused
}

// ─── Carte « publicité » — aperçu réel, infos lisibles, 5 actions ────
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
  const canToggle = state === "suspended" || state === "diffusing";
  const ended = state === "expired" || state === "completed" || state === "cancelled" || state === "refused";

  return (
    <article className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-night-800">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* Aperçu RÉEL (image / vignette YouTube / initiale) */}
        <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-neutral-100 dark:bg-white/5">
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
          <dl className="mt-1 grid gap-x-4 gap-y-0.5 text-xs text-neutral-500 dark:text-neutral-400 sm:grid-cols-2">
            <div className="truncate"><dt className="inline font-bold text-neutral-600 dark:text-neutral-300">Annonceur : </dt><dd className="inline">{ad.advertiser_name ?? "—"}</dd></div>
            <div className="truncate"><dt className="inline font-bold text-neutral-600 dark:text-neutral-300">Format : </dt><dd className="inline">{ad.creative ? SIMPLE_FORMAT_LABELS[ad.creative.format as SimpleAdFormat] ?? ad.creative.format : "sans visuel"}</dd></div>
            {ad.placements.length > 0 && (
              <div className="truncate sm:col-span-2"><dt className="inline font-bold text-neutral-600 dark:text-neutral-300">Emplacement : </dt><dd className="inline">{ad.placements.map((p) => SIMPLE_PLACEMENT_LABELS[p] ?? p).join(", ")}</dd></div>
            )}
            <div><dt className="inline font-bold text-neutral-600 dark:text-neutral-300">Fin : </dt><dd className="inline">{endDateText(ad.end_at)} · <StateText state={state} awaitingApproval={awaitingApproval} /></dd></div>
          </dl>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/admin/publicites/campagnes/${ad.id}`}
            className="rounded-xl border border-neutral-300 px-3.5 py-2 text-xs font-bold hover:bg-neutral-100 dark:border-white/15 dark:hover:bg-white/10"
          >
            Modifier
          </Link>
          {canToggle && (
            <SimpleStatusButton adId={ad.id} to={state === "suspended" ? "active" : "suspended"} label={state === "suspended" ? "Réactiver" : "Suspendre"} />
          )}
          {!ended && !paused && <ExtendControl adId={ad.id} />}
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
  const label = badgeLabel(state, awaitingApproval);
  const cls = awaitingApproval
    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
    : {
        diffusing: "bg-guinea-green/15 text-guinea-green",
        programmed: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
        suspended: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
        refused: "bg-red-500/15 text-red-600",
        paused: "bg-red-500/15 text-red-600",
      }[state] ?? "bg-neutral-500/15 text-neutral-400";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${cls}`}>{label}</span>
  );
}

function StateText({ state, awaitingApproval }: { state: string; awaitingApproval: boolean }) {
  return <span className="font-semibold">{badgeLabel(state, awaitingApproval)}</span>;
}

function badgeLabel(state: string, awaitingApproval: boolean): string {
  if (awaitingApproval) return "À valider par un administrateur";
  switch (state) {
    case "diffusing": return "En diffusion";
    case "programmed": return "Programmée";
    case "draft": return "Brouillon";
    case "suspended": return "Suspendue";
    case "expired": return "Terminée";
    case "paused": return "Sans période";
    case "completed": return "Clôturée";
    case "cancelled": return "Annulée";
    case "refused": return "Refusée";
    default: return state;
  }
}

/** Vignette YouTube dérivée de l'URL canonique (aucun appel réseau serveur). */
function youtubeThumb(url: string | undefined): string | null {
  if (!url) return null;
  const m = /[?&]v=([\w-]{11})|youtu\.be\/([\w-]{11})/.exec(url);
  const id = m?.[1] ?? m?.[2];
  return id ? `https://i.ytimg.com/vi/${id}/default.jpg` : null;
}

function endDateText(end: string | null): string {
  if (!end) return "sans date de fin";
  return end.slice(0, 10).split("-").reverse().join("/");
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