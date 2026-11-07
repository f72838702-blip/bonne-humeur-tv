// Génération RÉGÉNÉRABLE des icônes PWA « Bonne Humeur TV Admin ».
//
// Source UNIQUE : public/logo-bonne-humeur-tv.png (2406×388, fond
// transparent) — le logo officiel du média, jamais redessiné, jamais
// déformé, jamais rogné. Composition carrée : le wordmark est mis à
// l'échelle à largeur fixée et centré sur un fond uni opaque.
//
//  • variante « any »     : logo à 88 % de la largeur du carré
//  • variante « maskable »: 78 % — zone sûre centrale (cercle 80 %)
//  • apple-touch          : 180 px, fond opaque (iOS aplati la couche alpha)
//
// Usage : node scripts/generate-pwa-icons.mjs [fond]
//   fond : "white" (défaut, recommandé = fond de l'en-tête du site)
//          | "night" (prévisualisation alternativo : neutral-950)
// Sortie : public/icons/*.png  (+ aperçus variante opposée dans .temp si
//          un second fond est demandé).
// Aucune dépendance nouvelle : sharp est déjà résolu dans node_modules.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const SRC = join(ROOT, "public", "logo-bonne-humeur-tv.png");
const OUT = join(ROOT, "public", "icons");
if (!existsSync(SRC)) {
  console.error(`Logo introuvable : ${SRC}`);
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

const bgName = process.argv[2] ?? "white";
const BACKGROUNDS = {
  white: { r: 255, g: 255, b: 255, alpha: 1 },
  night: { r: 10, g: 10, b: 15, alpha: 1 },
};
const bg = BACKGROUNDS[bgName] ?? BACKGROUNDS.white;
const SUFFIX = bgName === "white" ? "" : `-${bgName}`;

// Ratio du logo officiel (inchangé au fil des générations).
const { width: SRC_W, height: SRC_H } = await sharp(SRC).metadata();

/** Carré S×S, fond opaque, logo à fW % de largeur, centré sans déformation. */
async function square(size, { widthPercent, name }) {
  const logoW = Math.round((size * widthPercent) / 100);
  const logoH = Math.round((logoW * SRC_H) / SRC_W);
  const logo = await sharp(SRC)
    .resize(logoW, logoH) // ratio source préservé — fit "inside" par défaut
    .png()
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: bg },
  })
    .composite([{ input: logo, left: Math.round((size - logoW) / 2), top: Math.round((size - logoH) / 2) }])
    .png()
    .toFile(join(OUT, name));
  console.log(`OK ${name} (${size}×${size}, logo ${logoW}×${logoH}, fond ${bgName})`);
}

// Variantes finales (PWA installable + iOS) :
await square(192, { widthPercent: 88, name: `bhtv-admin-192${SUFFIX}.png` });
await square(512, { widthPercent: 88, name: `bhtv-admin-512${SUFFIX}.png` });
await square(192, { widthPercent: 78, name: `bhtv-admin-maskable-192${SUFFIX}.png` });
await square(512, { widthPercent: 78, name: `bhtv-admin-maskable-512${SUFFIX}.png` });
await square(180, { widthPercent: 88, name: `bhtv-admin-apple-180${SUFFIX}.png` });
console.log("Fin — public/icons/");
