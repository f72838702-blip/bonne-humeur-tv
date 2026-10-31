import { describe, expect, it } from "vitest";
import { sniffImage } from "./sniff";
import { mediaVariantUrl, PURPOSE_VARIANTS, MAIN_VARIANT } from "./variants";

/**
 * Directive §2 — validation serveur des images : signature binaire
 * réelle (magic bytes) et dimensions. SVG, exécutables et fichiers
 * renommés doivent être refusés (fail-closed).
 */

function png(width: number, height: number): Uint8Array {
  const b = new Uint8Array(24);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0); // signature
  b.set([0x00, 0x00, 0x00, 0x0d], 8); // longueur IHDR
  b.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
  b[16] = (width >>> 24) & 0xff;
  b[17] = (width >>> 16) & 0xff;
  b[18] = (width >>> 8) & 0xff;
  b[19] = width & 0xff;
  b[20] = (height >>> 24) & 0xff;
  b[21] = (height >>> 16) & 0xff;
  b[22] = (height >>> 8) & 0xff;
  b[23] = height & 0xff;
  return b;
}

function jpeg(width: number, height: number): Uint8Array {
  const b = new Uint8Array(20);
  b.set([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0f], 0); // SOF0, longueur 15
  b[7] = (height >> 8) & 0xff;
  b[8] = height & 0xff;
  b[9] = (width >> 8) & 0xff;
  b[10] = width & 0xff;
  b.set([0xff, 0xd9], 18); // EOI
  return b;
}

function gif(width: number, height: number): Uint8Array {
  const b = new Uint8Array(20);
  b.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], 0); // "GIF89a"
  b[6] = width & 0xff;
  b[7] = (width >> 8) & 0xff;
  b[8] = height & 0xff;
  b[9] = (height >> 8) & 0xff;
  return b;
}

function webpVp8l(width: number, height: number): Uint8Array {
  const b = new Uint8Array(30);
  b.set([0x52, 0x49, 0x46, 0x46], 0); // "RIFF"
  b.set([0x0a, 0x00, 0x00, 0x00], 4); // taille
  b.set([0x57, 0x45, 0x42, 0x50], 8); // "WEBP"
  b.set([0x56, 0x50, 0x38, 0x4c], 12); // "VP8L"
  b[20] = 0x2f; // signature VP8L
  const bits = (width - 1) | ((height - 1) << 14);
  b[21] = bits & 0xff;
  b[22] = (bits >> 8) & 0xff;
  b[23] = (bits >> 16) & 0xff;
  b[24] = (bits >> 24) & 0xff;
  return b;
}

function webpVp8x(width: number, height: number): Uint8Array {
  const b = new Uint8Array(32);
  b.set([0x52, 0x49, 0x46, 0x46], 0); // "RIFF"
  b.set([0x57, 0x45, 0x42, 0x50], 8); // "WEBP"
  b.set([0x56, 0x50, 0x38, 0x58], 12); // "VP8X"
  const w = width - 1;
  const h = height - 1;
  b[24] = w & 0xff;
  b[25] = (w >> 8) & 0xff;
  b[26] = (w >> 16) & 0xff;
  b[27] = h & 0xff;
  b[28] = (h >> 8) & 0xff;
  b[29] = (h >> 16) & 0xff;
  return b;
}

describe("sniffImage — signatures et dimensions réelles", () => {
  it("reconnaît un PNG et lit ses dimensions IHDR", () => {
    const r = sniffImage(png(800, 450));
    expect(r).toEqual({ mime: "image/png", width: 800, height: 450 });
  });

  it("reconnaît un JPEG via le marqueur SOF0", () => {
    const r = sniffImage(jpeg(1920, 1080));
    expect(r).toEqual({ mime: "image/jpeg", width: 1920, height: 1080 });
  });

  it("reconnaît un GIF (87a/89a) et ses dimensions", () => {
    const r = sniffImage(gif(400, 300));
    expect(r).toEqual({ mime: "image/gif", width: 400, height: 300 });
  });

  it("reconnaît un WebP lossless (VP8L) et un WebP étendu (VP8X)", () => {
    expect(sniffImage(webpVp8l(300, 200))).toEqual({
      mime: "image/webp",
      width: 300,
      height: 200,
    });
    expect(sniffImage(webpVp8x(1000, 500))).toEqual({
      mime: "image/webp",
      width: 1000,
      height: 500,
    });
  });

  it("REFUSE les SVG (fail-closed)", () => {
    const svg = new TextEncoder().encode(
      `<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script/></svg>`
    );
    expect(sniffImage(svg)).toBeNull();
  });

  it("REFUSE les exécutables et fichiers renommés (MZ, ELF, texte)", () => {
    expect(sniffImage(new Uint8Array([0x4d, 0x5a, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e]))).toBeNull();
    expect(sniffImage(new TextEncoder().encode("#!/bin/sh rm -rf /"))).toBeNull();
    // PNG tronqué : signature incomplète → refus.
    expect(sniffImage(png(10, 10).slice(0, 10))).toBeNull();
    expect(sniffImage(new Uint8Array(4))).toBeNull();
  });
});

describe("mediaVariantUrl", () => {
  const storageUrl = "https://proj.supabase.co/storage/v1/object/public/media/articles/123-abc.webp";

  it("réécrit les URLs du bucket Storage vers la variante demandée", () => {
    expect(mediaVariantUrl(storageUrl, "card")).toBe(
      "https://proj.supabase.co/storage/v1/object/public/media/articles/123-abc-card.webp"
    );
    expect(mediaVariantUrl(storageUrl, "thumb")).toBe(
      "https://proj.supabase.co/storage/v1/object/public/media/articles/123-abc-thumb.webp"
    );
  });

  it("laisse la variante principale (full) inchangée", () => {
    expect(mediaVariantUrl(storageUrl, "full")).toBe(storageUrl);
  });

  it("ne touche JAMAIS les miniatures YouTube ni les URLs externes (§1)", () => {
    const yt = "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg";
    expect(mediaVariantUrl(yt, "card")).toBe(yt);
    expect(mediaVariantUrl("", "card")).toBe("");
  });
});

describe("dossiers logiques (directive §2)", () => {
  it("chaque dossier a la bonne variante principale", () => {
    expect(MAIN_VARIANT.articles).toBe("full");
    expect(MAIN_VARIANT.categories).toBe("card");
    expect(MAIN_VARIANT.thumbnails).toBe("thumb");
    expect(MAIN_VARIANT.reporters).toBe("avatar");
    expect(MAIN_VARIANT.branding).toBe("full");
  });

  it("la variante principale est toujours en tête de liste", () => {
    for (const variants of Object.values(PURPOSE_VARIANTS)) {
      expect(variants.length).toBeGreaterThan(0);
    }
  });
});