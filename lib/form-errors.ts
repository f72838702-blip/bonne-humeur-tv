/**
 * Aides à l'affichage des erreurs de formulaires publics (contact,
 * partenariat) après une validation serveur refusée.
 *
 * Principe : l'utilisateur ne doit JAMAIS rechercher son erreur dans la
 * page — le premier champ fautif (dans l'ordre de saisie, celui que Zod
 * a suivi en remplissant fieldErrors) est localisé, défilement + focus
 * automatiques côté composant client, les autres champs restent
 * conservés (les champs sont contrôlés : rien n'est effacé au refus).
 */

/**
 * Premier champ erroné → identifiant d'élément du formulaire.
 * Les clés sans correspondance (honeypot « website », champs techniques)
 * sont sautées : le suivant dans l'ordre est utilisé.
 */
export function firstErrorFieldId(
  fieldErrors: Record<string, string> | undefined,
  idByField: Record<string, string>
): string | null {
  for (const key of Object.keys(fieldErrors ?? {})) {
    const id = idByField[key];
    if (id) return id;
  }
  return null;
}