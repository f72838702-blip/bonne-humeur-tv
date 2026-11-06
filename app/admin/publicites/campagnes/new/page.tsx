import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { listAdvertisers } from "@/lib/data/ads";
import { CampaignForm } from "@/components/admin/AdsForms";
import { ForbiddenScreen, NotFoundScreen } from "@/components/admin/AccessDenied";

export const metadata = { title: "Nouvelle campagne" };

export default async function NewCampaignPage() {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) {
    if (guard.denied === "unauthenticated") redirect("/admin/login");
    return <ForbiddenScreen />;
  }

  const advertisers = await listAdvertisers();
  if (advertisers.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/admin/publicites/annonceurs" className="text-xs font-semibold text-guinea-red hover:underline">← Annonceurs</Link>
        <NotFoundScreen what="Annonceur" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Link href="/admin/publicites/campagnes" className="text-xs font-semibold text-guinea-red hover:underline">← Campagnes</Link>
        <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Nouvelle campagne</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Les dates sont saisies en heure de Conakry (UTC+0 constant).
          Sans début/fin, une campagne activée ne diffusera JAMAIS
          (fail-closed). La référence est générée si laissée vide.
        </p>
      </header>

      <section className="rounded-2xl border border-neutral-200 bg-surface p-6 dark:border-white/10 dark:bg-night-800">
        <CampaignForm advertisers={advertisers.map((a) => ({ id: a.id, name: a.name, is_active: a.is_active }))} />
      </section>
    </div>
  );
}