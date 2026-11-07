// Génération RÉGÉNÉRABLE des icônes PWA « Bonne Humeur TV Admin ».
//
// Source par DÉFAUT : public/logo-bonne-humeur-tv.png (wordmark 2406×388).
// Source artiste (07/11, demande direction : « utilise celui ci comme
// icone c'est plus mieux ») : carré 1254×1254 fourni par le PDG —
// sauvegardé comme public/icons/source-icone-artiste.png pour que la
// génération reste reproductible à partir du dépôt.
//
// Usage :
//   node scripts/generate-pwa-icons.mjs [fond] [source] [any%] [maskable%]
//   • fond      : "black" | "white" (utile si la source a des transparences)
//   • source    : chemin du PNG source (défaut = image artiste du 07/11)
//   • any%      : part de la largeur occupée par l'art (défaut variante carrée : 100)
//   • maskable% : part réservée au mask (défaut : 88 — zone sûre du cercle)
// Les cinq sorties produites sont TOUJOURS les PNG de production :
//   bhtv-admin-{192,512}.png, bhtv-admin-maskable-{192,512}.png,
//   bhtv-admin-apple-180.png (nommages inchangés → manifest stable).
// Aucune dépendance nouvelle : sharp déjà résolu dans node_modules.

import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const ART_SRC = join(ROOT, "public", "icons", "source-icone-artiste.png");
const LOGO_SRC = join(ROOT, "public", "logo-bonne-humeur-tv.png");

const [, , bgArg, srcArg, anyArg, maskArg] = process.argv;
const bgName = bgArg ?? "black";
const SRC = srcArg ? join(srcArg) : ART_SRC;
const anyPct = Number(anyArg ?? 100);
const maskPct = Number(maskArg ?? 88);

const existsArt = existsSync(ART_SRC);
const src = existsSync(SRC) ? SRC : existsArt ? ART_SRC : LOGO_SRC;
if (!existsSync(src)) {
  console.error(`Source introuvable : ${src}`);
  process.exit(1);
}
console.log(`Source : ${src}`);

const BACKGROUNDS = {
  black: { r: 0, g: 0, b: 0, alpha: 1 },
  white: { r: 255, g: 255, b: 255, alpha: 1 },
};
const bg = BACKGROUNDS[bgName] ?? BACKGROUNDS.black;

const OUT = join(ROOT, "public", "icons");
mkdirSync(OUT, { recursive: true });

const { width: SRC_W, height: SRC_H } = await sharp(src).metadata();

/** Carré S×S : art mis à l'échelle (ratio préservé), centré, fond opaque.
 *  maskable : fond BLANC toujours — la source artiste a un liseré blanc ;
 *  un fond noir ferait apparaître un anneau sombre sous le masque Android. */
async function square(size, { widthPercent, name, maskable = false }) {
  const layerBg = maskable ? BACKGROUNDS.white : bg;
  const w = Math.round((size * widthPercent) / 100);
  const h = Math.round((w * SRC_H) / SRC_W);
  const art = await sharp(src)
    .resize(w, h) // fit "inside" par défaut — aucune déformation
    .png()
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: layerBg },
  })
    .composite([{ input: art, left: Math.round((size - w) / 2), top: Math.round((size - h) / 2) }])
    .png()
    .toFile(join(OUT, name));
  console.log(`OK ${name} (${size}×${size}, art ${w}×${h}, fond ${maskable ? "white" : bgName})`);
}

// Variantes de production (noms STABLES consommés par le manifest) :
await square(192, { widthPercent: anyPct, name: "bhtv-admin-192.png" });
await square(512, { widthPercent: anyPct, name: "bhtv-admin-512.png" });
await square(192, { widthPercent: maskPct, name: "bhtv-admin-maskable-192.png", maskable: true });
await square(512, { widthPercent: maskPct, name: "bhtv-admin-maskable-512.png", maskable: true });
await square(180, { widthPercent: anyPct, name: "bhtv-admin-apple-180.png" });
console.log("Fin — public/icons/");
