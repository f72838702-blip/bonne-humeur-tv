import { describe, expect, it } from "vitest";
import {
  articleSchema,
  contactSchema,
  loginSchema,
  partnershipSchema,
  videoSchema,
} from "@/lib/validation/schemas";

const validContact = {
  name: "Mariama Sy",
  email: "mariama@exemple.gn",
  subject: "Demande de partenariat média",
  message: "Bonjour, je souhaite discuter d'une collaboration.",
  consent: true,
  website: "",
};

describe("contactSchema", () => {
  it("accepte un message de contact complet", () => {
    expect(contactSchema.safeParse(validContact).success).toBe(true);
  });

  it("refuse un email invalide", () => {
    const result = contactSchema.safeParse({ ...validContact, email: "pas-un-email" });
    expect(result.success).toBe(false);
  });

  it("refuse sans consentement explicite", () => {
    const result = contactSchema.safeParse({ ...validContact, consent: false });
    expect(result.success).toBe(false);
  });

  it("refuse un honeypot rempli (bot)", () => {
    const result = contactSchema.safeParse({
      ...validContact,
      website: "http://spam.example",
    });
    expect(result.success).toBe(false);
  });

  it("refuse un message trop court", () => {
    const result = contactSchema.safeParse({ ...validContact, message: "ok" });
    expect(result.success).toBe(false);
  });
});

describe("partnershipSchema", () => {
  it("accepte une demande B2B complète", () => {
    const result = partnershipSchema.safeParse({
      contact_name: "Ibrahima Diallo",
      organisation: "Exemple SARL",
      email: "contact@exemple.gn",
      service: "couverture",
      message: "Nous souhaitons une couverture de notre évènement.",
      consent: true,
      website: "",
    });
    expect(result.success).toBe(true);
  });

  it("refuse une prestation hors énumération", () => {
    const result = partnershipSchema.safeParse({
      contact_name: "Ibrahima Diallo",
      organisation: "Exemple SARL",
      email: "contact@exemple.gn",
      service: "service-inconnu",
      message: "Nous souhaitons une prestation.",
      consent: true,
      website: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("refuse un mot de passe trop court", () => {
    expect(loginSchema.safeParse({ email: "a@b.gn", password: "court" }).success).toBe(false);
  });
});

describe("articleSchema", () => {
  const validArticle = {
    title: "Titre d'article valide",
    content: "Contenu de l'article.",
    status: "draft" as const,
  };

  it("accepte un brouillon minimal", () => {
    expect(articleSchema.safeParse(validArticle).success).toBe(true);
  });

  it("refuse un titre trop court", () => {
    const result = articleSchema.safeParse({ ...validArticle, title: "abc" });
    expect(result.success).toBe(false);
  });

  it("refuse un statut hors workflow", () => {
    const result = articleSchema.safeParse({ ...validArticle, status: "inconnu" });
    expect(result.success).toBe(false);
  });

  it("limite les tags à 10", () => {
    const result = articleSchema.safeParse({
      ...validArticle,
      tags: Array.from({ length: 11 }, (_, i) => `tag-${i}`),
    });
    expect(result.success).toBe(false);
  });
});

describe("videoSchema", () => {
  it("accepte un ID YouTube valide (11 caractères)", () => {
    const result = videoSchema.safeParse({
      title: "Émission spéciale",
      youtube_id: "aqz-KE-bpKQ",
      status: "draft" as const,
    });
    expect(result.success).toBe(true);
  });

  it("refuse un ID YouTube de longueur incorrecte", () => {
    const result = videoSchema.safeParse({
      title: "Émission spéciale",
      youtube_id: "aqz-KE",
      status: "draft" as const,
    });
    expect(result.success).toBe(false);
  });

  it("refuse des caractères exotiques dans l'ID YouTube", () => {
    const result = videoSchema.safeParse({
      title: "Émission spéciale",
      youtube_id: "aqz-KE-bpK!",
      status: "draft" as const,
    });
    expect(result.success).toBe(false);
  });
});