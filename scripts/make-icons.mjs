// Generates the app icons in /public from one SVG design.
// Run with: node scripts/make-icons.mjs
import sharp from 'sharp'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

const R = 132
const C = 2 * Math.PI * R

/** `rounded` = rounded-square tile (normal icons). Otherwise full-bleed (maskable / apple-touch). */
const svg = (rounded) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7478f5"/>
      <stop offset="1" stop-color="#4338ca"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="${rounded ? 112 : 0}" fill="url(#g)"/>
  <circle cx="256" cy="256" r="${R}" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="28"/>
  <circle cx="256" cy="256" r="${R}" fill="none" stroke="#fff" stroke-width="28" stroke-linecap="round"
          stroke-dasharray="${(0.72 * C).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 256 256)"/>
  <path d="M236 216v80l64-40z" fill="#fff" stroke="#fff" stroke-width="14" stroke-linejoin="round"/>
</svg>`

writeFileSync(join(out, 'favicon.svg'), svg(true))

const jobs = [
  ['icon-192.png', 192, true],
  ['icon-512.png', 512, true],
  ['icon-maskable-512.png', 512, false],
  ['apple-touch-icon.png', 180, false],
]
for (const [name, size, rounded] of jobs) {
  await sharp(Buffer.from(svg(rounded))).resize(size, size).png().toFile(join(out, name))
  console.log('wrote', name)
}
