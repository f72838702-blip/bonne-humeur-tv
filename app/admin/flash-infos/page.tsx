import { redirect } from "next/navigation";
import { Zap } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { getStaffBreakingNews } from "@/lib/data/admin-content";
import { deleteBreakingNews } from "@/lib/actions/content";
import FlashNewsForm from "@/components/admin/FlashNewsForm";
import FlashCountdown from "@/components/admin/FlashCountdown";
import DeleteActionForm from "@/components/admin/DeleteActionForm";
import { ForbiddenScreen, NotFoundScreen, UnconfiguredScreen } from "@/components/admin/AccessDenied";

export const metadata = { title: "Flash-infos" };

export default async function AdminFlashInfosPage() {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) {
    if (guard.denied === "unauthenticated") redirect("/admin/login");
    if (guard.denied === "unconfigured") return <UnconfiguredScreen />;
    return <ForbiddenScreen />;
  }

  const items = await getStaffBreakingNews();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Flash-infos</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Bandeau d’alerte du site public — diffusé uniquement pendant sa période
          d’activation. Un flash-info doit toujours relater un fait réel.
        </p>
      </header>

      <section className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-white/10 dark:bg-night-800">
        <h2 className="mb-4 flex items-center gap-2 font-display text-base font-bold">
          <Zap className="h-4 w-4 text-guinea-red" />
          Nouveau flash-info
        </h2>
        <FlashNewsForm />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold">
          Flash-infos existants ({items.length})
        </h2>

        {items.length === 0 ? (
          <NotFoundScreen what="Aucun flash-info" />
        ) : (
          items.map((item) => (
            <details
              key={item.id}
              className="rounded-2xl border border-neutral-200 bg-white dark:border-white/10 dark:bg-night-800"
            >
              <summary className="flex cursor-pointer flex-wrap items-center gap-3 p-4">
                <span
                  className={
                    item.is_active
                      ? "inline-flex items-center gap-1.5 rounded-full bg-guinea-red/15 px-2.5 py-0.5 text-[10px] font-bold uppercase text-guinea-red"
                      : "inline-flex items-center gap-1.5 rounded-full bg-neutral-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase text-neutral-500"
                  }
                >
                  <span
                    className={
                      item.is_active
                        ? "h-1.5 w-1.5 animate-pulse-dot rounded-full bg-guinea-red"
                        : "h-1.5 w-1.5 rounded-full bg-neutral-400"
                    }
                  />
                  {item.is_active ? "Actif" : "Inactif"}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{item.content}</span>
                <span className="shrink-0 text-xs text-neutral-400">
                  #{item.position}
                  {item.end_at && " · "}
                  {item.end_at && <FlashCountdown endIso={item.end_at} />}
                </span>
              </summary>

              <div className="border-t border-neutral-200 p-4 dark:border-white/10">
                <FlashNewsForm item={item} />
                <div className="mt-4 border-t border-neutral-200 pt-3 dark:border-white/10">
                  <DeleteActionForm
                    action={deleteBreakingNews}
                    hiddenFields={{ id: item.id }}
                    confirmLabel="Supprimer ce flash-info définitivement ? Action irréversible."
                  />
                </div>
              </div>
            </details>
          ))
        )}
      </section>
    </div>
  );
}