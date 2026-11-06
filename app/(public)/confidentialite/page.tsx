import type { Metadata } from "next";
import PageTitle from "@/components/shared/PageTitle";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description:
    "Politique de confidentialité de Bonne Humeur TV : données collectées via les formulaires contact et partenariat, finalités, durées de conservation et vos droits.",
  alternates: { canonical: "/confidentialite" },
};

/**
 * Politique de confidentialité STRUCTURANTE — alignée sur les traitements
 * réellement implémentés (formulaires contact + partenariats, stockage
 * Supabase, journal anti-spam). Les points à arbitrer par la direction
 * restent des marqueurs explicites — aucune durée ni coordonnée inventée.
 */
export default function ConfidentialitePage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <PageTitle
        kicker="Vos données"
        title="Politique de"
        highlight="confidentialité"
        subtitle="Dernière mise à jour : novembre 2026"
      />

      <div className="mt-10 space-y-10 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
        <div>
          <h2 className="font-display text-lg font-bold">1. Responsable du traitement</h2>
          <p className="mt-2">
            Le responsable du traitement des données collectées sur ce site est
            <strong> Bonne Humeur TV</strong>, Kaloum, Sans-Fil, Immeuble Mbemba Diaby —
            Conakry, République de Guinée. Contact pour toute question relative
            aux données : **[À VALIDER PAR LA DIRECTION — email officiel de
            référence pour les demandes de données]**
          </p>
        </div>

        <div>
          <h2 className="font-display text-lg font-bold">2. Données collectées et finalités</h2>
          <p className="mt-2">
            Le site collecte uniquement les données saisies volontairement via
            ses formulaires :
          </p>
          <ul className="mt-2 list-disc space-y-1.5 pl-6">
            <li>
              <strong>Formulaire de contact</strong> : nom, email, téléphone
              (facultatif), sujet et message — pour répondre à votre demande.
            </li>
            <li>
              <strong>Formulaire de partenariat / devis</strong> : nom du contact,
              organisation, fonction, email, téléphone, prestation, budget,
              calendrier et description du projet — pour instruire votre demande
              commerciale.
            </li>
            <li>
              <strong>Protection anti-abus</strong> : chaque soumission est
              enregistrée avec un identifiant technique dérivé (hachage) de
              votre adresse IP, utilisé exclusivement pour limiter les envois
              abusifs. L&apos;adresse IP n&apos;est jamais stockée en clair.
            </li>
          </ul>
          <p className="mt-2">
            Aucune donnée n&apos;est collectée à votre insu, aucun compteur de
            vues nominatif n&apos;est mis en place.
          </p>
          <p className="mt-3">
            <strong>Mesure d&apos;audience anonyme</strong> : pour comprendre
            l&apos;audience générale du site (pages visitées, pays d&apos;origine
            approximatif, durée de consultation, appareil), le site mesure des
            événements strictement anonymes. Cette mesure{" "}
            <strong>n&apos;utilise ni cookie, ni adresse IP stockée, ni
            identifiant personnel, ni profil de navigation individuelle</strong> : le
            seul identifiant de session est un nombre aléatoire qui disparaît à
            la fermeture de l&apos;onglet (sessionStorage), le pays est déduit
            par l&apos;infrastructure d&apos;hébergement sans jamais conserver
            l&apos;adresse IP, et la durée mesurée est celle où la page est
            réellement visible. Les administrateurs du site et les robots
            d&apos;indexation sont exclus de ces compteurs. Les données
            agrégées ne sont visibles que par les administrateurs du site et
            pour une durée de conservation de 12 mois maximum.
          </p>
        </div>

        <div>
          <h2 className="font-display text-lg font-bold">3. Base légale du traitement</h2>
          <p className="mt-2">
            Le traitement repose sur votre <strong>consentement</strong>, recueilli
            par la case à cocher obligatoire des formulaires, que vous pouvez
            retirer à tout moment en nous écrivant.
          </p>
        </div>

        <div>
          <h2 className="font-display text-lg font-bold">4. Durée de conservation</h2>
          <p className="mt-2">
            Les messages et demandes sont conservés le temps nécessaire à leur
            traitement, puis archivés ou supprimés. Durée d&apos;archivage
            recommandée : **[À VALIDER PAR LA DIRECTION — durée exacte, ex. 24
            mois, à confirmer]**. Le journal anti-spam est purgé
            automatiquement après 7 jours.
          </p>
        </div>

        <div>
          <h2 className="font-display text-lg font-bold">5. Destinataires et sous-traitants</h2>
          <p className="mt-2">
            Les données sont stockées sur l&apos;infrastructure <strong>Supabase</strong>{" "}
            (base de données et stockage) et le site est hébergé par{" "}
            <strong>Vercel</strong>. Aucune donnée n&apos;est vendue ni transmise à des
            tiers à des fins commerciales. La rédaction et le pôle commercial de
            Bonne Humeur TV y accèdent dans le cadre strict de leurs fonctions.
          </p>
        </div>

        <div>
          <h2 className="font-display text-lg font-bold">6. Vos droits</h2>
          <p className="mt-2">
            Vous disposez d&apos;un droit d&apos;accès, de rectification,
            d&apos;effacement, d&apos;opposition et de portabilité de vos données.
            Pour l&apos;exercer, écrivez à l&apos;adresse indiquée ci-dessus ou via
            la page Contact en précisant votre demande. Le responsable
            institutionnel de la protection des données est :
            **[À VALIDER PAR LA DIRECTION — responsable désigné à confirmer]**
          </p>
        </div>

        <div>
          <h2 className="font-display text-lg font-bold">7. Sécurité</h2>
          <p className="mt-2">
            Les communications sont protégées par HTTPS. L&apos;accès administratif
            aux données se fait exclusivement via des comptes nominatifs
            protégés par mot de passe, avec des rôles distincts (administrateur,
            éditeur, reporter) et un journal d&apos;audit des opérations.
          </p>
        </div>

        <div>
          <h2 className="font-display text-lg font-bold">8. Cookies</h2>
          <p className="mt-2">
            Le site utilise uniquement le stockage local de votre navigateur pour
            mémoriser votre préférence de thème clair/sombre — aucune donnée
            n&apos;est transmise à des fins publicitaires. Si la protection
            anti-robot Cloudflare Turnstile est activée, elle peut déposer un
            cookie technique strictement nécessaire à la sécurité des
            formulaires.
          </p>
        </div>
      </div>
    </section>
  );
}