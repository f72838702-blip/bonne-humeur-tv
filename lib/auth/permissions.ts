/**
 * Permissions granulaires de l'administration — noyau PUR (0036).
 *
 * Modèle (mission multi-administrateurs 10/11/2026) :
 *   • super_admin → TOUT, sans exception, jamais modifiable côté application ;
 *   • admin → tout aussi (rôle historique conservé, réservé au PDG) ;
 *   • editor → UNIQUEMENT les clés cochées sur son profil ;
 *   • reporter → ses propres brouillons (aucune clé nécessaire).
 *
 * Ce fichier est pur : aucune dépendance réseau/serveur — testable par vitest
 * et réutilisable par les Server Actions, la Sidebar et le tableau de bord.
 */

/** Clés de permissions — doivent refléter exactement la contrainte SQL 0036. */
export const PERMISSION_KEYS = [
  "articles",
  "articles_publier",
  "articles_tous",
  "videos",
  "flash",
  "directs",
  "publicite",
  "publicite_approuver",
  "consultation",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

/** Libellés d'interface — vocabulaire humain, jamais la clé technique. */
export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  articles: "Articles (les siens)",
  articles_publier: "Publier / dépublier / corbeille des articles",
  articles_tous: "Modifier les articles des autres",
  videos: "Vidéos (émissions)",
  flash: "Flash-infos",
  directs: "Direct (affichage du direct)",
  publicite: "Publicités (créer / modifier)",
  publicite_approuver: "Approuver / supprimer les publicités",
  consultation: "Consultation (aucun droit d'écriture)",
};

/** Description affichée sous chaque case dans la fiche administrateur. */
export const PERMISSION_DESCRIPTIONS: Record<PermissionKey, string> = {
  articles: "Accéder à la rubrique et créer/modifier SES articles (brouillons, soumission à validation).",
  articles_publier: "Publier, dépublier, mettre en corbeille ou restaurer un article.",
  articles_tous: "Modifier les articles rédigés par d'autres personnes.",
  videos: "Gérer la vidéothèque des émissions (titres, descriptions, miniature, position).",
  flash: "Créer et gérer les flashs d'information (bandeau du site).",
  directs:
    "Gérer l'AFFICHAGE du direct sur Bonne Humeur Média (lien YouTube Live, programme, activation). " +
    "Le contrôle de la chaîne YouTube elle-même reste hors de l'application.",
  publicite: "Accéder à la régie et créer/modifier SES annonces (créatives, campagnes).",
  publicite_approuver: "Approuver les créatives, changer le statut des campagnes, supprimer.",
  consultation:
    "Accéder aux statistiques et aux listes en lecture seule. Aucune publication, aucune modification.",
};

/** Rôles qui possèdent TOUT, sans case à cocher. */
export function isFullyPrivileged(role: string | null | undefined): boolean {
  return role === "super_admin" || role === "admin";
}

/** Clés valides uniquement (jamais une valeur inconnue du navigateur). */
function sanitize(permissions: string[] | null | undefined): PermissionKey[] {
  if (!Array.isArray(permissions)) return [];
  return permissions.filter((k): k is PermissionKey =>
    (PERMISSION_KEYS as readonly string[]).includes(k)
  );
}

/**
 * Permissions EFFECTIVES d'un profil (source unique de vérité côté app).
 * admin/super_admin → toutes ; editor → clés actives ; reporter → aucune.
 */
export function effectivePermissions(profile: {
  role: string;
  permissions?: string[] | null;
} | null | undefined): PermissionKey[] {
  if (!profile) return [];
  if (isFullyPrivileged(profile.role)) return [...PERMISSION_KEYS];
  if (profile.role === "editor") return sanitize(profile.permissions);
  return [];
}

export function hasPermission(
  profile: { role: string; permissions?: string[] | null } | null | undefined,
  key: PermissionKey
): boolean {
  return effectivePermissions(profile).includes(key);
}

/** Première permission présente parmi une liste (raccourci des gardes). */
export function hasAnyPermission(
  profile: { role: string; permissions?: string[] | null } | null | undefined,
  keys: readonly PermissionKey[]
): boolean {
  const granted = effectivePermissions(profile);
  return keys.some((k) => granted.includes(k));
}

/** Clés normalisées acceptées côté formulaire d'invitation/fiche. */
export function sanitizePermissions(permissions: string[] | null | undefined): PermissionKey[] {
  return sanitize(permissions);
}
