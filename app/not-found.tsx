import Link from "next/link";
import { Tv } from "lucide-react";

/** Page 404 — honnête et utile : aucun contenu inventé. */
export default function NotFound() {
  return (
    <section className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center sm:px-6">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-guinea-red/10 text-guinea-red">
        <Tv className="h-8 w-8" />
      </span>
      <p className="mt-6 font-display text-6xl font-extrabold text-guinea-red">404</p>
      <h1 className="mt-2 font-display text-2xl font-extrabold sm:text-3xl">
        Cette page n&apos;existe pas (ou plus)
      </h1>
      <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
        Le contenu que vous cherchez a peut-être été déplacé ou n&apos;a jamais
        existé. Voici les meilleures façons de continuer votre visite.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded-full bg-guinea-red px-6 py-3 text-sm font-bold text-white shadow-glow transition-transform hover:scale-105"
        >
          Retour à l&apos;accueil
        </Link>
        <Link
          href="/actualites"
          className="rounded-full border border-neutral-300 px-6 py-3 text-sm font-bold transition-colors hover:border-guinea-red hover:text-guinea-red dark:border-white/20"
        >
          Les actualités
        </Link>
        <Link
          href="/videos"
          className="rounded-full border border-neutral-300 px-6 py-3 text-sm font-bold transition-colors hover:border-guinea-red hover:text-guinea-red dark:border-white/20"
        >
          Les vidéos
        </Link>
      </div>
    </section>
  );
}