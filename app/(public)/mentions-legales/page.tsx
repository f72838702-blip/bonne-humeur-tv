import type { Metadata } from "next";
import PageTitle from "@/components/shared/PageTitle";

export const metadata: Metadata = {
  title: "Mentions légales",
  description: "Mentions légales du site Bonne Humeur TV — éditeur, hébergement et propriété intellectuelle.",
  alternates: { canonical: "/mentions-legales" },
};

/**
 * Mentions légales STRUCTURANTES. Les champs dont la valeur réelle doit
 * être confirmée par la direction restent des marqueurs explicites —
 * AUCUNE coordonnée n'est inventée ici.
 */
export default function MentionsLegalesPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <PageTitle
        kicker="Transparence"
        title="Mentions"
        highlight="légales"
        subtitle="Dernière mise à jour : octobre 2026"
      />

      <div className="mt-10 space-y-10 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
        <div>
          <h2 className="font-display text-lg font-bold">1. Éditeur du site</h2>
          <p className="mt-2">
            Le site Bonne Humeur TV est édité par <strong>Bonne Humeur TV</strong>,
            média audiovisuel basé à Conakry, République de Guinée.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>
              Représentant légal : <strong>Ibrahima Sory Touré</strong>, Président-Directeur Général
            </li>
            <li>
              Adresse du siège : Kaloum, Sans-Fil, Immeuble Mbemba Diaby — Conakry,
              République de Guinée
            </li>
            <li>
              Téléphone / WhatsApp : +224 662 860 976
            </li>
            <li>
              Email de contact : **[À VALIDER PAR LA DIRECTION — adresse email
              officielle à confirmer]**
            </li>
            <li>
              Forme juridique et identifiant d&apos;enregistrement (RCCM / NIF) :
              **[À VALIDER PAR LA DIRECTION — immatriculation exacte à confirmer]**
            </li>
          </ul>
        </div>

        <div>
          <h2 className="font-display text-lg font-bold">2. Hébergement</h2>
          <p className="mt-2">
            Le site est hébergé par <strong>Vercel, Inc.</strong> — 425 N Sheridan Ave,
            Santa Ana, CA 92706, États-Unis (vercel.com). Les données de la
            plateforme (contenus, formulaires) sont stockées via Supabase
            (supabase.com) sur des infrastructures cloud professionnelles.
          </p>
        </div>

        <div>
          <h2 className="font-display text-lg font-bold">3. Propriété intellectuelle</h2>
          <p className="mt-2">
            L&apos;ensemble des contenus du site (textes, vidéos, images, logo,
            charte graphique) est la propriété exclusive de Bonne Humeur TV, sauf
            mention contraire. Toute reproduction, diffusion ou exploitation,
            totale ou partielle, sans autorisation écrite préalable est
            interdite. Les vidéos hébergées sur YouTube restent soumises aux
            conditions d&apos;utilisation de cette plateforme.
          </p>
        </div>

        <div>
          <h2 className="font-display text-lg font-bold">4. Responsabilité</h2>
          <p className="mt-2">
            Bonne Humeur TV s&apos;efforce de publier une information exacte et
            vérifiée. Des erreurs ou omissions peuvent néanmoins survenir : toute
            signalement est bienvenu via la page Contact. L&apos;éditeur ne saurait
            être tenu responsable des contenus de sites tiers vers lesquels le
            site renvoie par lien hypertexte.
          </p>
        </div>

        <div>
          <h2 className="font-display text-lg font-bold">5. Droit applicable</h2>
          <p className="mt-2">
            Les présentes mentions légales sont régies par le droit guinéan. Tout
            litige relatif au site relève de la compétence des tribunaux de
            Conakry.
          </p>
        </div>
      </div>
    </section>
  );
}