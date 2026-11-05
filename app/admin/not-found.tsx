import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * 404 du back-office UNIQUEMENT (URL inconnues sous /admin/*) : rendu
 * nu — aucun élément public (navigation, WhatsApp, publicités). La
 * navigation de secours est purement administrative.
 */
export default function AdminNotFound() {
  return (
    <section className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center sm:px-6">
      <p className="font-display text-6xl font-extrabold text-guinea-red">404</p>
      <h1 className="mt-2 font-display text-2xl font-extrabold sm:text-3xl">
        Page administrative inconnue
      </h1>
      <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
        Cette adresse n&apos;existe pas dans le back-office.
      </p>
      <Link
        href="/admin"
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-guinea-red px-6 py-3 text-sm font-bold text-white transition-transform hover:scale-105"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour au tableau de bord
      </Link>
    </section>
  );
}
