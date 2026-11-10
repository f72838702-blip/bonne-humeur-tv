import { randomInt } from "node:crypto";

/**
 * COMPTES CRÉÉS DIRECTEMENT PAR LE SUPER ADMINISTRATEUR (mission « création
 * des gestionnaires »). Supabase Auth n'authentifie que email + mot de passe :
 * la connexion par IDENTIFIANT s'appuie sur une adresse technique stable,
 * générée CÔTÉ SERVEUR SEULEMENT — jamais d'adresse fabriquée dans le
 * navigateur, jamais de mot de passe en clair stocké ou journalisé.
 *
 * Stratégie : identifiant normalisé (2-32 car. [a-z0-9._-], jamais commence/
 * finit par . - _) → `identifiant@gestion.bonnehumeur.info`.
 * Le domaine est un SOUS-DOMAINE TECHNIQUE du site officiel, non récepteur
 * de courrier : aucune invitation ne peut y aboutir, aucune adresse réelle
 * n'est exposée, aucun doublon possible (Auth refuse l'email existant).
 * Les comptes invités historiquement (email réel) continuent normalement :
 * isTechnicalManagerEmail() distingue les deux populations.
 */

export const MANAGER_LOGIN_DOMAIN = "gestion.bonnehumeur.info";

/** 2 à 32 caractères, uniquement [a-z0-9._-], sans séparateur en bordure. */
const IDENTIFIANT_MIN = 2;
const IDENTIFIANT_MAX = 32;
const IDENTIFIANT_RE = new RegExp(
  `^[a-z0-9](?:[a-z0-9._-]{0,${IDENTIFIANT_MAX - 2}})[a-z0-9]$`
);

export type IdentifiantResult =
  | { ok: true; identifiant: string }
  | { ok: false; reason: "vide" | "trop_long" | "caracteres" | "bornes" };

/** Normalise (minuscules, espaces retirés) puis valide un identifiant. */
export function normalizeIdentifiant(raw: string): string {
  return raw.replace(/[\s]+/g, "").toLowerCase();
}

export function validateIdentifiant(raw: string): IdentifiantResult {
  const identifiant = normalizeIdentifiant(raw ?? "");
  if (identifiant.length === 0) return { ok: false, reason: "vide" };
  if (identifiant.length > IDENTIFIANT_MAX) return { ok: false, reason: "trop_long" };
  if (!IDENTIFIANT_RE.test(identifiant)) {
    // Un "." / "-" en tête/queue est un cas « bornes » ; le reste = caractères.
    return /^[a-z0-9._-]+$/.test(identifiant)
      ? { ok: false, reason: "bornes" }
      : { ok: false, reason: "caracteres" };
  }
  return { ok: true, identifiant };
}

/** Adresse technique de connexion (règle stable réversible à chaque login). */
export function identifiantToEmail(identifiant: string): string {
  return `${normalizeIdentifiant(identifiant)}@${MANAGER_LOGIN_DOMAIN}`;
}

/** Un identifiant saisi sans « @ » est traité comme identifiant de connexion. */
export function looksLikeEmail(value: string): boolean {
  return (value ?? "").includes("@");
}

/** Distingue les comptes identifiants (domaine technique) des emails réels. */
export function isTechnicalManagerEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(`@${MANAGER_LOGIN_DOMAIN}`);
}

/** Identifiant affichable depuis l'email technique (usage interne/admin). */
export function emailToIdentifiant(email: string | null | undefined): string | null {
  if (!email || !isTechnicalManagerEmail(email)) return null;
  return email.slice(0, email.length - MANAGER_LOGIN_DOMAIN.length - 1);
}

/** L'identifiant de connexion reste la partie sans domaine de la saisie. */
export function loginIdentifierFromInput(value: string): string {
  const raw = (value ?? "").trim();
  if (looksLikeEmail(raw)) {
    const tech = isTechnicalManagerEmail(raw) ? emailToIdentifiant(raw) : null;
    return tech ?? raw;
  }
  return normalizeIdentifiant(raw);
}

/**
 * Mot de passe provisoire généré par le serveur (réinitialisation) :
 * 12 caractères sans ambiguïtés (jamais 0/O/1/l/I) — au moins 1 majuscule,
 * 1 minuscule, 1 chiffre et 1 signe ; jamais stocké, jamais journalisé.
 */
const PW_UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const PW_LOWER = "abcdefghijkmnpqrstuvwxyz";
const PW_DIGIT = "23456789";
const PW_SYMBOL = "!@#$%*+?";
const PW_ALL = PW_UPPER + PW_LOWER + PW_DIGIT + PW_SYMBOL;

function pickOne(set: string): string {
  return set.charAt(randomInt(set.length));
}

export function generateProvisionalPassword(): string {
  const chars = [
    pickOne(PW_UPPER),
    pickOne(PW_LOWER),
    pickOne(PW_DIGIT),
    pickOne(PW_SYMBOL),
  ];
  for (let i = chars.length; i < 12; i += 1) {
    chars.push(pickOne(PW_ALL));
  }
  // Mélange déterministe à la Fischer-Yates (randomInt cryptographique).
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
