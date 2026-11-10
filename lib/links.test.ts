import { describe, expect, it } from "vitest";
import {
  addExternalLinkTargets,
  externalAnchorProps,
  isExternalHttpUrl,
  SITE_HOSTS,
} from "@/lib/links";

/** Matrice de la règle de navigation uniforme (12 scénarios de recette). */
describe("isExternalHttpUrl — propriété du domaine", () => {
  it("EXTERNE : site d'un annonceur (autre domaine)", () => {
    expect(isExternalHttpUrl("https://boutique-exemple.gn")).toBe(true);
    expect(isExternalHttpUrl("http://facebook.com/bonnehumeurtv")).toBe(true);
  });

  it("EXTERNE : sous-domaine tiers (même racine apparente, hôte différent)", () => {
    expect(isExternalHttpUrl("https://shop.boutique-exemple.gn/page")).toBe(true);
  });

  it("INTERNE : chemin relatif, ancre, query — même onglet", () => {
    expect(isExternalHttpUrl("/actualites")).toBe(false);
    expect(isExternalHttpUrl("/actualites/mon-article")).toBe(false);
    expect(isExternalHttpUrl("#devis")).toBe(false);
    expect(isExternalHttpUrl("?page=2")).toBe(false);
    expect(isExternalHttpUrl("")).toBe(false);
  });

  it("INTERNE : domaines de Bonne Humeur Média (Vercel, Cloudflare, www, env)", () => {
    expect(isExternalHttpUrl("https://bonne-humeur-tv.vercel.app/actualites")).toBe(false);
    expect(
      isExternalHttpUrl("https://bonne-humeur-tv-preview.bonne-humeur-tv.workers.dev/videos")
    ).toBe(false);
    // Phase J : l'hôte PRODUCTION Workers est interne lui aussi.
    expect(
      isExternalHttpUrl("https://bonne-humeur-tv.bonne-humeur-tv.workers.dev/videos")
    ).toBe(false);
    expect(isExternalHttpUrl("https://www.bonne-humeur-tv.vercel.app/")).toBe(false);
    for (const host of SITE_HOSTS) {
      expect(isExternalHttpUrl(`https://${host}/x`)).toBe(false);
    }
  });

  it("PARTICULIERS : mailto:, tel:, sms:, javascript: — jamais modifiés", () => {
    expect(isExternalHttpUrl("mailto:contact@bonnehumeur.tv")).toBe(false);
    expect(isExternalHttpUrl("tel:+224662860976")).toBe(false);
    expect(isExternalHttpUrl("sms:+224662860976")).toBe(false);
    expect(isExternalHttpUrl("javascript:alert(1)")).toBe(false);
  });

  it("robustesse : URL malformée, non-chaine, null/undefined → jamais externe", () => {
    expect(isExternalHttpUrl("https://")).toBe(false);
    expect(isExternalHttpUrl("http://[invalide")).toBe(false);
    expect(isExternalHttpUrl(undefined)).toBe(false);
    expect(isExternalHttpUrl(null)).toBe(false);
    expect(isExternalHttpUrl(42)).toBe(false);
  });
});

describe("externalAnchorProps — attributs à déplier sur un <a>", () => {
  it("bannière publicitaire → nouvel onglet sécurisé", () => {
    expect(externalAnchorProps("https://annonceur-exemple.gn")).toEqual({
      target: "_blank",
      rel: "noopener noreferrer",
    });
  });

  it("réseau social / YouTube → nouvel onglet", () => {
    expect(externalAnchorProps("https://www.youtube.com/watch?v=abc")).toEqual({
      target: "_blank",
      rel: "noopener noreferrer",
    });
  });

  it("liens internes (accueil, actualités, catégories) → rien", () => {
    expect(externalAnchorProps("/")).toEqual({});
    expect(externalAnchorProps("/actualites")).toEqual({});
  });

  it("mailto: et tel: → rien (comportement natif conservé)", () => {
    expect(externalAnchorProps("mailto:contact@bonnehumeur.tv")).toEqual({});
    expect(externalAnchorProps("tel:+224662860976")).toEqual({});
  });
});

describe("addExternalLinkTargets — sortie marked (corps d'article)", () => {
  it("lien source d'information EXTERNE → target + rel ajoutés", () => {
    const out = addExternalLinkTargets('<a href="https://source.gn/article">La source</a>');
    expect(out).toBe('<a href="https://source.gn/article" target="_blank" rel="noopener noreferrer">La source</a>');
  });

  it("lien avec attribut title → attributs ajoutés SANS le casser", () => {
    const out = addExternalLinkTargets('<a href="https://source.gn" title="Source">x</a>');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('title="Source"');
  });

  it("lien INTERNE (/actualites) → strictement inchangé", () => {
    const html = '<a href="/actualites">Toutes les actualités</a>';
    expect(addExternalLinkTargets(html)).toBe(html);
  });

  it("mailto: et tel: → strictement inchangés", () => {
    const html = '<a href="mailto:contact@bonnehumeur.tv">mail</a><a href="tel:+224">appel</a>';
    expect(addExternalLinkTargets(html)).toBe(html);
  });

  it("ancres internes (#devis) → inchangées", () => {
    const html = '<a href="#devis">Devis</a>';
    expect(addExternalLinkTargets(html)).toBe(html);
  });

  it("un target déjà présent n'est JAMAIS doublé", () => {
    const html = '<a href="https://source.gn" target="_blank" rel="noopener">x</a>';
    const out = addExternalLinkTargets(html);
    expect(out).toBe(html);
  });

  it("autres balises (images, iframes, codes) → jamais touchées", () => {
    const html = '<p>a</p><img src="https://exemple.gn/i.png" alt="">';
    expect(addExternalLinkTargets(html)).toBe(html);
  });

  it("contenu malveillant dans un <a> non-lien-standards ne reçoit rien", () => {
    const out = addExternalLinkTargets('<a href="">javascript:alert(1)</a>');
    expect(out).not.toContain("target");
  });
});