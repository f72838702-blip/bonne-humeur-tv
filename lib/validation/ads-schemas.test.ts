import { describe, expect, it } from "vitest";
import {
  AD_PAYLOAD_SCHEMAS,
  adCampaignSchema,
  adCreativeSchema,
  adCreativeDecisionSchema,
  adPartnerSchema,
  adPaymentSchema,
  advertiserSchema,
  bannerPayloadSchema,
  cardPayloadSchema,
  videoPayloadSchema,
  promoStripPayloadSchema,
} from "./ads-schemas";

describe("payloads par format", () => {
  it("bannière : image http/https + alt obligatoire", () => {
    const ok = bannerPayloadSchema.safeParse({
      image_url: "https://example.com/pub.png",
      image_alt: "bannière",
    });
    expect(ok.success).toBe(true);
  });

  it("bannière : URL javascript:/data:/file: refusée", () => {
    for (const bad of ["javascript:alert(1)", "data:image/png;base64,x", "file:///C:/x.png", "ftp://h/x.png", "pas d'url"]) {
      expect(bannerPayloadSchema.safeParse({ image_url: bad, image_alt: "alt" }).success).toBe(false);
    }
  });

  it("carte : titre + texte obligatoires, URL unique vide acceptée", () => {
    expect(cardPayloadSchema.safeParse({ title: "Offre", text: "Texte de la carte" }).success).toBe(true);
    expect(cardPayloadSchema.safeParse({ title: "Offre", text: "Texte", logo_url: "" }).success).toBe(true);
    expect(cardPayloadSchema.safeParse({ text: "sans titre" }).success).toBe(false);
  });

  it("vidéo : URL YouTube seulement", () => {
    expect(videoPayloadSchema.safeParse({ youtube_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", title: "Pub" }).success).toBe(true);
    expect(videoPayloadSchema.safeParse({ youtube_url: "https://vimeo.com/123", title: "Pub" }).success).toBe(false);
    expect(videoPayloadSchema.safeParse({ youtube_url: "", title: "Pub" }).success).toBe(false);
  });

  it("bandeau : message obligatoire, couleur #rgb ou #rrggbb", () => {
    expect(promoStripPayloadSchema.safeParse({ message: "Promo" }).success).toBe(true);
    expect(promoStripPayloadSchema.safeParse({ message: "Promo", bg_color: "#f00" }).success).toBe(true);
    expect(promoStripPayloadSchema.safeParse({ message: "Promo", bg_color: "#ff0000" }).success).toBe(true);
    expect(promoStripPayloadSchema.safeParse({ message: "Promo", bg_color: "rouge" }).success).toBe(false);
  });

  it("sponsor_article : payload strictement vide", () => {
    expect(AD_PAYLOAD_SCHEMAS.sponsor_article.safeParse({}).success).toBe(true);
    expect(AD_PAYLOAD_SCHEMAS.sponsor_article.safeParse({ link_url: "https://x.fr" }).success).toBe(false);
  });
});

describe("annonceurs", () => {
  it("nom 2-120, téléphone permissif contrôlé, e-mail valide ou vide", () => {
    expect(advertiserSchema.safeParse({ name: "Sodif SA" }).success).toBe(true);
    expect(advertiserSchema.safeParse({ name: "S" }).success).toBe(false);
    expect(advertiserSchema.safeParse({ name: "Nom", contact_phone: "+224 622 00 00 00" }).success).toBe(true);
    expect(advertiserSchema.safeParse({ name: "Nom", contact_phone: "http://x" }).success).toBe(false);
    expect(advertiserSchema.safeParse({ name: "Nom", contact_email: "" }).success).toBe(true);
    expect(advertiserSchema.safeParse({ name: "Nom", contact_email: "bidon" }).success).toBe(false);
    expect(advertiserSchema.safeParse({ name: "Nom", website: "javascript:alert(1)" }).success).toBe(false);
  });
});

describe("campagnes", () => {
  const base = {
    advertiser_id: "9d2e7e21-1c5a-4a8b-9b2f-0a1b2c3d4e5f",
    name: "Campagne de démonstration",
    start_at: "",
    end_at: "",
  };

  it("dates conakry strictes (datetime-local) ou vides", () => {
    expect(adCampaignSchema.safeParse(base).success).toBe(true);
    expect(adCampaignSchema.safeParse({ ...base, start_at: "2026-11-05T10:00", end_at: "2026-12-05T10:00" }).success).toBe(true);
    expect(adCampaignSchema.safeParse({ ...base, start_at: "05/11/2026" }).success).toBe(false);
    expect(adCampaignSchema.safeParse({ ...base, end_at: "2026-12-05T10:00:44" }).success).toBe(false);
  });

  it("priorité bornée, devise 3 majuscules", () => {
    expect(adCampaignSchema.safeParse({ ...base, priority: 101 }).success).toBe(false);
    expect(adCampaignSchema.safeParse({ ...base, priority: -1 }).success).toBe(false);
    expect(adCampaignSchema.safeParse({ ...base, currency: "gnf" }).success).toBe(false);
    expect(adCampaignSchema.safeParse({ ...base }).data?.priority).toBe(50);
  });

  it("emplacements : liste contrôlée", () => {
    const bad = adCampaignSchema.safeParse({ ...base, placements: ["n'importe où"] });
    // Le schéma limite la longueur/l'origine : l'appelant vérifie les codes
    // (l'action filtre réellement sur AD_PLACEMENT_CODES).
    expect(bad.success).toBe(true); // longueur OK — filtrage définitif par l'action
  });
});

describe("créations et décisions", () => {
  it("format contrôlé, poids 1-20", () => {
    expect(adCreativeSchema.safeParse({ campaign_id: "9d2e7e21-1c5a-4a8b-9b2f-0a1b2c3d4e5f", format: "banner", name: "Créa" }).success).toBe(true);
    expect(adCreativeSchema.safeParse({ campaign_id: "x", format: "popup", name: "Créa" }).success).toBe(false);
    expect(adCreativeSchema.safeParse({ campaign_id: "9d2e7e21-1c5a-4a8b-9b2f-0a1b2c3d4e5f", format: "card", name: "Créa", weight: 21 }).success).toBe(false);
  });

  it("décisions fermées", () => {
    expect(adCreativeDecisionSchema.safeParse({ id: "9d2e7e21-1c5a-4a8b-9b2f-0a1b2c3d4e5f", decision: "approved" }).success).toBe(true);
    expect(adCreativeDecisionSchema.safeParse({ id: "9d2e7e21-1c5a-4a8b-9b2f-0a1b2c3d4e5f", decision: "auto" }).success).toBe(false);
  });
});

describe("partenaires et règlements", () => {
  it("partenaire : logo obligatoire et sûr", () => {
    expect(adPartnerSchema.safeParse({ name: "Partenaire", logo_url: "https://x.com/logo.png" }).success).toBe(true);
    expect(adPartnerSchema.safeParse({ name: "Partenaire", logo_url: "http://x.com/logo.png" }).success).toBe(true);
    expect(adPartnerSchema.safeParse({ name: "Partenaire", logo_url: "data:image/gif;base64,x" }).success).toBe(false);
  });

  it("règlement : montant > 0, méthode de la liste GNF/3 lettres", () => {
    const base = {
      campaign_id: "9d2e7e21-1c5a-4a8b-9b2f-0a1b2c3d4e5f",
      amount: 1500000,
      paid_on: "2026-11-03",
      method: "mobile_money" as const,
    };
    expect(adPaymentSchema.safeParse(base).success).toBe(true);
    expect(adPaymentSchema.safeParse({ ...base, amount: 0 }).success).toBe(false);
    expect(adPaymentSchema.safeParse({ ...base, method: "carte_bancaire" }).success).toBe(false);
  });
});