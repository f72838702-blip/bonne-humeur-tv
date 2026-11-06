import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionInfo } from "@/lib/auth/session";
import LoginForm from "@/components/admin/LoginForm";
import Logo from "@/components/shared/Logo";

export const metadata: Metadata = {
  title: "Espace rédaction",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  // Déjà connecté → directement au tableau de bord.
  const session = await getSessionInfo();
  if (session) redirect("/admin");

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 sm:px-6">
      <div className="w-full rounded-3xl border border-neutral-200 bg-white p-8 shadow-xl dark:border-white/10 dark:bg-night-800">
        <div className="mb-8 flex flex-col items-center text-center">
          {/* Logo officiel (original tel quel — aucune retouche) */}
          <Logo className="h-10 w-auto select-none object-contain" />
          <h1 className="mt-4 font-display text-2xl font-extrabold">Espace rédaction</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Bonne Humeur TV — gestion des contenus
          </p>
        </div>

        <LoginForm />
      </div>

      <Link
        href="/"
        className="mt-6 text-sm font-medium text-neutral-500 transition-colors hover:text-guinea-red dark:text-neutral-400"
      >
        ← Retour au site public
      </Link>
    </div>
  );
}