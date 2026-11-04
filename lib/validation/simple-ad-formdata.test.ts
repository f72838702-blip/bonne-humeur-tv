import { describe, expect, it } from "vitest";
import {
  bannerPayloadSchema,
  cardPayloadSchema,
} from "./ads-schemas";
import { simpleAdSchema } from "./ads-schemas";

/**
 * REPRODUCTION du bug « Création incomplete. » constaté par la direction :
 * le formulaire 4 etapes televerse l image (uploadAdImageAction -> URL dans
 * l'etat React) mais N'ENVOIE AUCUN champ image_url/logo_url dans la
 * FormData de publication — le ZOD PAR FORMAT (bannerPayloadSchema /
 * partner obligatoire) refuse donc TOUTE publication, quel que soit
 * l'annonceur. Ici on reproduit la fabrication EXACTE du payload brut
 * telle que buildPayload la fait (lib/actions/ads.ts, extraction FormData
 * lignes 423-438) — sans base, sans session.
 */

/** Miroir exact de l'extraction de buildPayload (champ absent = cle absente). */
function rawFromForm(fields: Record<string, string | undefined>) {
  const raw: Record<string, string> = {};
  for (const key of ["image_url", "image_alt", "title", "description", "cta_text", "logo_url", "text", "youtube_url", "message", "bg_color"]) {
    const v = fields[key];
    if (typeof v === "string") raw[key] = v.trim();
  }
  return raw;
}

/** Simule la FormData TELLE QUE le formulaire 4 etapes la construit. */
function formSansChampCacheImage() {
  return {
    image_alt: "Boutique Test — solde de la rentrée", // champ rempli par l'admin
    title: "Boutique Test",
    // image_url : ABSENT dans la FormData (bug) — l'upload n'a jamais
    // été relié au nom de champ que le serveur lit.
  };
}

describe("bug « Création incomplete » : champ image jamais envoyé", () => {
  it("REPRODUCTION : bannière sans image_url -> refus exact du serveur", () => {
    const parsed = bannerPayloadSchema.safeParse(rawFromForm(formSansChampCacheImage()));
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join(".")}`);
      // C'est l'erreur qui s'affiche dans l'interface (fieldErrors.image_url
      // sous le message « Création incomplete. ») — le champ existe pourtant
      // côté écran : l'admin a bien « ajouté » une image.
      expect(issues).toContain("image_url");
    }
  });

  it("CORRECTION : la valeur téléversée transportée par un champ caché image_url passe", () => {
    const parsed = bannerPayloadSchema.safeParse(
      rawFromForm({ ...formSansChampCacheImage(), image_url: "https://beinalmwqkxbqitvuobr.supabase.co/storage/v1/object/public/ads/test.jpg" })
    );
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.image_url).toContain("/storage/v1/object/public/ads/");
      expect(parsed.data.image_alt).toBe("Boutique Test — solde de la rentrée");
    }
  });

  it("reproduction simpleAdSchema COMPLET (couche 1) : sans champ image_url il passe MAIS la couche 2 (par format) refuse — d'où le blocage", () => {
    const layer1 = simpleAdSchema.safeParse({
      submit_mode: "publish",
      advertiser_mode: "new",
      new_advertiser_name: "Boutique Test",
      format: "banner",
      placements: ["home_top_banner"],
      duration_key: "7j",
      image_alt: "ok",
    });
    // couche 1 OK — l'erreur vient TOUJOURS de la couche par format :
    expect(layer1.success).toBe(true);
  });

  it("même cause pour la CARTE : l'image téléversée est perdue (facultative mais silencieusement ignorée)", () => {
    const parsed = cardPayloadSchema.safeParse(
      rawFromForm({ title: "Boutique Test", text: "Description courte" })
    );
    expect(parsed.success).toBe(true); // image_url facultative -> passe
    if (parsed.success) expect(parsed.data.image_url).toBeUndefined();
  });
});