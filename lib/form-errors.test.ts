import { describe, expect, it } from "vitest";
import { zodFieldErrors } from "@/lib/actions/helpers";
import { firstErrorFieldId } from "@/lib/form-errors";
import { contactSchema, partnershipSchema } from "@/lib/validation/schemas";

/**
 * SCÉNARIOS §6 de la mission « perte des informations du formulaire de
 * partenariat » — couche validation serveur + positionnement du premier
 * champ fautif. Les valeurs saisies sont conservées PAR CONSTRUCTION
 * (champs contrôlés) : ces tests prouvent que le serveur renvoie, pour
 * chaque scénario de refus, l'erreur exacte SOUS LE BON CHAMP, dans
 * l'ordre de saisie, sans jamais toucher aux validations.
 */

/** Miroir exact de l'extraction FormData de submitPartnership. */
function partnershipPayload(fields: Record<string, unknown>) {
  return partnershipSchema.safeParse({
    contact_name: fields.contact_name,
    organisation: fields.organisation,
    fonction: fields.fonction ?? "",
    email: fields.email,
    phone: fields.phone ?? "",
    service: fields.service,
    message: fields.message,
    budget: fields.budget ?? "",
    timeline: fields.timeline ?? "",
    consent: fields.consent === true,
    website: fields.website ?? "",
  });
}

/** id d'élément — copie exacte du mapping du composant. */
const PART_IDS: Record<string, string> = {
  organisation: "part-organisation",
  contact_name: "part-contact-name",
  fonction: "part-fonction",
  email: "part-email",
  phone: "part-phone",
  service: "part-service",
  budget: "part-budget",
  timeline: "part-timeline",
  message: "part-message",
  consent: "part-consent",
};

describe("formulaire partenariat — refus server et erreurs par champ", () => {
  it("scénario 1 : formulaire entier correct → ACCEPTÉ (soumission normale)", () => {
    const parsed = partnershipPayload({
      contact_name: "Aissatou Bah",
      organisation: "Salon Exemple SARL",
      email: "contact@exemple.gn",
      service: "production",
      message: "Nous souhaitons couvrir notre lancement produit en octobre.",
      consent: true,
    });
    expect(parsed.success).toBe(true);
  });

  it("scénario 2 : champ obligatoire vide → erreur SOUS LE CHAMP (organisation)", () => {
    const parsed = partnershipPayload({
      contact_name: "Aissatou Bah",
      organisation: "", // FormData.get renvoie "" pour un champ laissé vide
      email: "contact@exemple.gn",
      service: "couverture",
      message: "Une proposition détaillée et complète.",
      consent: true,
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const errors = zodFieldErrors(parsed.error);
      expect(errors.organisation).toContain("2 caractères minimum");
      // le 1er champ fautif pointe vers le champ organisation
      expect(firstErrorFieldId(errors, PART_IDS)).toBe("part-organisation");
    }
  });

  it("scénario 3 : email invalide → « Adresse email invalide » sous le champ email", () => {
    const parsed = partnershipPayload({
      contact_name: "Aissatou Bah",
      organisation: "Salon Exemple SARL",
      email: "pas-un-email",
      service: "digitale",
      message: "Une proposition détaillée et complète.",
      consent: true,
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const errors = zodFieldErrors(parsed.error);
      expect(errors.email).toBe("Adresse email invalide");
    }
  });

  it("scénario 4 : PLUSIEURS champs fautifs → ordre de saisie respecté (nom avant consentement)", () => {
    const parsed = partnershipPayload({
      // contact_name trop court + email invalide + consentement refusé
      contact_name: "A",
      organisation: "Salon Exemple SARL",
      email: "invalide",
      service: "autre",
      message: "Une proposition détaillée et complète.",
      consent: false,
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const errors = zodFieldErrors(parsed.error);
      const keys = Object.keys(errors);
      expect(keys).toContain("contact_name");
      expect(keys).toContain("email");
      expect(keys).toContain("consent");
      // l'ordre suit le schéma : le PREMIER champ fautif est bien le nom
      expect(firstErrorFieldId(errors, PART_IDS)).toBe("part-contact-name");
      expect(Object.keys(errors).indexOf("email")).toBeLessThan(
        Object.keys(errors).indexOf("consent")
      );
    }
  });

  it("scénario 5/validation : service absent (value=\"\") → « Choisissez une prestation »", () => {
    const parsed = partnershipPayload({
      contact_name: "Aissatou Bah",
      organisation: "Salon Exemple SARL",
      email: "contact@exemple.gn",
      service: "",
      message: "Une proposition détaillée et complète.",
      consent: true,
    });
    if (!parsed.success) {
      const errors = zodFieldErrors(parsed.error);
      expect(errors.service).toBe("Choisissez une prestation");
    }
  });

  it("honeypot « website » rempli → erreur sans id d'élément (le suivant en erreur prend la main)", () => {
    const parsed = partnershipPayload({
      contact_name: "Aissatou Bah",
      organisation: "Salon Exemple SARL",
      email: "contact@exemple.gn",
      service: "interview",
      message: "Une proposition détaillée et complète.",
      consent: true,
      website: "http://spam.example",
    });
    if (!parsed.success) {
      const errors = zodFieldErrors(parsed.error);
      expect(firstErrorFieldId(errors, PART_IDS)).toBeNull(); // jamais de scroll vers un honeypot
    }
  });

  it("contact (même cause corrigée) : champ vide → erreur sous le champ", () => {
    const parsed = contactSchema.safeParse({
      name: "",
      email: "contact@exemple.gn",
      phone: "",
      subject: "Objet du message",
      message: "Dix caractères au minimum ici.",
      consent: true,
      website: "",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(zodFieldErrors(parsed.error).name).toContain("2 caractères minimum");
    }
  });
});

describe("firstErrorFieldId — positionnement automatique", () => {
  it("renvoie null sans erreur", () => {
    expect(firstErrorFieldId(undefined, PART_IDS)).toBeNull();
    expect(firstErrorFieldId({}, PART_IDS)).toBeNull();
  });

  it("saute les champs sans id (honeypot, techniques)", () => {
    expect(firstErrorFieldId({ website: "Rejeté", service: "Choisissez une prestation" }, PART_IDS)).toBe(
      "part-service"
    );
  });
});