// Generates PWA / iOS icons from an SVG. Run: npm run icons
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(out, { recursive: true });

// Dumbbell glyph on black, lime accent
const glyph = (scale) => `
  <g transform="translate(256 256) scale(${scale}) rotate(-45) translate(-256 -256)" fill="#C4F82A">
    <rect x="96"  y="196" width="44" height="120" rx="14"/>
    <rect x="148" y="166" width="44" height="180" rx="14"/>
    <rect x="320" y="166" width="44" height="180" rx="14"/>
    <rect x="372" y="196" width="44" height="120" rx="14"/>
    <rect x="186" y="238" width="140" height="36" rx="10"/>
  </g>`;

const svg = (rounded, scale) => `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="g" cx="30%" cy="20%" r="90%">
      <stop offset="0%" stop-color="#1c1f12"/>
      <stop offset="100%" stop-color="#000000"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" ${rounded ? 'rx="112"' : ""} fill="url(#g)"/>
  ${glyph(scale)}
</svg>`;

const jobs = [
  ["icon-192.png", 192, svg(false, 1)],
  ["icon-512.png", 512, svg(false, 1)],
  ["icon-maskable-512.png", 512, svg(false, 0.72)],
  ["apple-touch-icon.png", 180, svg(false, 0.95)],
  ["favicon-32.png", 32, svg(true, 1.1)],
];

for (const [name, size, s] of jobs) {
  await sharp(Buffer.from(s)).resize(size, size).png().toFile(join(out, name));
  console.log("wrote", name);
}
