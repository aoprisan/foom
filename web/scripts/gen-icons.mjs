// FOOM — PWA icon generator ("The Red Dawn").
//
// The mark is the game's signature image made iconic: a white-hot singularity —
// intelligence igniting, the FOOM — cresting the dark curve of the planet at a
// slow red dawn, with the converging-loss curve falling into it (loss → 0 as
// capability → ∞). Sodium-ember over a char-black void; an instrument boundary
// of gold ticks rings it. Palette lifted 1:1 from src/styles/index.css.
//
// Self-contained: emits scalable SVG masters, then rasterizes them faithfully
// with headless Chrome (gradients + bloom intact) and downscales with magick
// to every PNG / favicon size + a multi-resolution .ico.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const HERE = dirname(fileURLToPath(import.meta.url))
const PUB = join(HERE, '..', 'public')
const BUILD = join(HERE, '..', '.icon-build')
mkdirSync(PUB, { recursive: true })
mkdirSync(BUILD, { recursive: true })

// — palette (The Red Dawn; mirrors src/styles/index.css) —
const VOID = '#070302'
const CHAR = '#0c0705'
const EMBER = '#ff9a4a'
const EMBER_HOT = '#ffba76'
const WHITE_HOT = '#fff1de'
const GOLD = '#f5b942'
const GOLD_BRIGHT = '#ffd470'
const CRIMSON = '#ff3b4e'
const CRIMSON_DEEP = '#7a1c22'
const EMBER_DIM = '#5a2f12'

const C = 256 // centre of a 512 canvas
const TAU = Math.PI * 2
const r2 = (n) => Math.round(n * 100) / 100

// Upper limb of a planet whose centre sits far below frame: a gentle convex
// horizon spanning the full width. Returns the arc path + its edge height.
function horizon(planetR, planetCy) {
  const dx = 256
  const y0 = r2(planetCy - Math.sqrt(planetR * planetR - dx * dx)) // height at x=0 and x=512
  // sweep-flag 1 traces the short (top) arc through the apex
  return { path: `M0 ${y0} A ${planetR} ${planetR} 0 0 1 512 ${y0}`, y0, apex: r2(planetCy - planetR) }
}

function ticks(ringR) {
  return Array.from({ length: 36 }, (_, i) => {
    const a = (i * TAU) / 36
    const cardinal = i % 9 === 0
    const r1 = ringR + 6
    const r0 = ringR + (cardinal ? 16 : 10)
    return `<line x1="${r2(C + r1 * Math.cos(a))}" y1="${r2(C + r1 * Math.sin(a))}" x2="${r2(
      C + r0 * Math.cos(a),
    )}" y2="${r2(C + r0 * Math.sin(a))}" stroke="${cardinal ? GOLD : EMBER_DIM}" stroke-width="${
      cardinal ? 2.6 : 1.4
    }" stroke-linecap="round" opacity="${cardinal ? 0.9 : 0.45}"/>`
  }).join('')
}

// A few light-spokes lancing off the singularity.
function rays(cx, cy, inner, outer, n) {
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (i * TAU) / n + (i % 2) * 0.06
    return `<line x1="${r2(cx + inner * Math.cos(a))}" y1="${r2(cy + inner * Math.sin(a))}" x2="${r2(
      cx + outer * Math.cos(a),
    )}" y2="${r2(cy + outer * Math.sin(a))}" stroke="url(#ray)" stroke-width="${
      i % 3 === 0 ? 2.4 : 1.3
    }" stroke-linecap="round" opacity="${i % 3 === 0 ? 0.55 : 0.3}"/>`
  }).join('')
}

function svg({ detail = 'full' }) {
  // Composition shifts with detail: the full mark seats the orb high over a low
  // horizon with ring + loss-curve; the simple marks centre a hero orb with
  // generous safe area (maskable masking / 16px legibility).
  const full = detail === 'full'
  const orbCx = C
  const orbCy = full ? 298 : detail === 'favicon' ? 250 : 256
  const orbR = full ? 78 : detail === 'favicon' ? 104 : 94
  const planetR = full ? 520 : 470
  const planetCy = full ? 860 : detail === 'favicon' ? 800 : 770
  const h = horizon(planetR, planetCy)
  const ringR = 232
  const coronaR = r2(orbR * 2.7)

  const boundary = full
    ? `<circle cx="${C}" cy="${C}" r="${ringR}" fill="none" stroke="${EMBER_DIM}" stroke-width="2.2" opacity="0.75"/>
       <circle cx="${C}" cy="${C}" r="${r2(ringR - 7)}" fill="none" stroke="${EMBER}" stroke-width="1" opacity="0.28"/>
       ${ticks(ringR)}`
    : ''

  // the converging-loss curve falling into the rising singularity (loss → 0)
  const lossCurve = full
    ? `<g opacity="0.85">
         <line x1="120" y1="214" x2="392" y2="214" stroke="${EMBER}" stroke-width="1.2" stroke-dasharray="3 7" opacity="0.4"/>
         <path d="M96 132 C 168 134, 196 196, 256 212 S 360 220, 404 220" fill="none"
               stroke="url(#loss)" stroke-width="3.2" stroke-linecap="round" filter="url(#bloom)"/>
         <circle cx="404" cy="220" r="3.4" fill="${GOLD_BRIGHT}"/>
       </g>`
    : ''

  const spokes = detail === 'favicon' ? '' : rays(orbCx, orbCy, orbR + 6, orbR + (full ? 70 : 86), full ? 14 : 12)

  const grain = full ? `<rect width="512" height="512" filter="url(#grain)" opacity="0.05"/>` : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <radialGradient id="field" cx="50%" cy="64%" r="78%">
      <stop offset="0%" stop-color="#1c0e07"/>
      <stop offset="48%" stop-color="${CHAR}"/>
      <stop offset="100%" stop-color="${VOID}"/>
    </radialGradient>
    <radialGradient id="dawn" cx="50%" cy="72%" r="62%">
      <stop offset="0%" stop-color="${CRIMSON}" stop-opacity="0.34"/>
      <stop offset="45%" stop-color="${CRIMSON_DEEP}" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="${CRIMSON_DEEP}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="vignette" cx="50%" cy="48%" r="62%">
      <stop offset="58%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.6"/>
    </radialGradient>
    <linearGradient id="planet" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1a0c08"/>
      <stop offset="40%" stop-color="#0a0504"/>
      <stop offset="100%" stop-color="${VOID}"/>
    </linearGradient>
    <radialGradient id="corona" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${EMBER_HOT}" stop-opacity="0.85"/>
      <stop offset="32%" stop-color="${EMBER}" stop-opacity="0.42"/>
      <stop offset="70%" stop-color="${CRIMSON}" stop-opacity="0.14"/>
      <stop offset="100%" stop-color="${CRIMSON}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="orb" cx="46%" cy="38%" r="68%">
      <stop offset="0%" stop-color="${WHITE_HOT}"/>
      <stop offset="20%" stop-color="${GOLD_BRIGHT}"/>
      <stop offset="46%" stop-color="${EMBER}"/>
      <stop offset="78%" stop-color="#ff5a32"/>
      <stop offset="100%" stop-color="${CRIMSON}"/>
    </radialGradient>
    <linearGradient id="loss" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${EMBER_HOT}"/>
      <stop offset="100%" stop-color="${GOLD_BRIGHT}"/>
    </linearGradient>
    <radialGradient id="ray" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${EMBER_HOT}"/>
      <stop offset="100%" stop-color="${EMBER}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="rim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${EMBER_HOT}"/>
      <stop offset="100%" stop-color="${CRIMSON}"/>
    </linearGradient>
    <filter id="bloom" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="5" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/></filter>
  </defs>

  <!-- the char-black field, warmed by the dawn rising below -->
  <rect width="512" height="512" fill="url(#field)"/>
  <rect width="512" height="512" fill="url(#dawn)"/>

  ${boundary}
  ${lossCurve}

  <!-- the singularity: corona, light-spokes, the igniting orb -->
  <circle cx="${orbCx}" cy="${orbCy}" r="${coronaR}" fill="url(#corona)"/>
  ${spokes}
  <g filter="url(#bloom)">
    <circle cx="${orbCx}" cy="${orbCy}" r="${orbR}" fill="url(#orb)"/>
    <circle cx="${orbCx}" cy="${orbCy}" r="${orbR}" fill="none" stroke="${GOLD_BRIGHT}" stroke-width="1.5" opacity="0.8"/>
    <circle cx="${r2(orbCx - orbR * 0.26)}" cy="${r2(orbCy - orbR * 0.34)}" r="${r2(orbR * 0.3)}" fill="${WHITE_HOT}" opacity="0.55" filter="url(#bloom)"/>
  </g>

  <!-- the dark curve of the planet, its limb rim-lit by the dawn -->
  <path d="${h.path} L512 512 L0 512 Z" fill="url(#planet)"/>
  <path d="${h.path}" fill="none" stroke="url(#rim)" stroke-width="${full ? 3 : 4}" stroke-linecap="round" filter="url(#bloom)"/>
  <path d="${h.path}" fill="none" stroke="${WHITE_HOT}" stroke-width="1" opacity="0.5"/>

  <rect width="512" height="512" fill="url(#vignette)"/>
  ${grain}
</svg>`
}

function wrap(svgStr) {
  return `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;background:transparent}
  svg{display:block;width:512px;height:512px}</style>${svgStr}`
}

const masters = {
  icon: svg({ detail: 'full' }),
  maskable: svg({ detail: 'maskable' }),
  favicon: svg({ detail: 'favicon' }),
}

// Scalable SVG masters shipped as-is (favicon.svg is used directly by browsers).
writeFileSync(join(PUB, 'icon.svg'), masters.icon)
writeFileSync(join(PUB, 'favicon.svg'), masters.favicon)
for (const [k, s] of Object.entries(masters)) writeFileSync(join(BUILD, `${k}.html`), wrap(s))
console.log('· wrote icon.svg, favicon.svg + render wrappers')

// ── Rasterize faithfully with headless Chrome, then downscale with magick ──
const CHROME =
  process.env.CHROME ||
  ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
   '/Applications/Chromium.app/Contents/MacOS/Chromium'].find(existsSync)

function shoot(masterKey, outPng) {
  execFileSync(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    '--default-background-color=00000000', '--window-size=512,512', '--virtual-time-budget=2500',
    `--screenshot=${outPng}`, `file://${join(BUILD, masterKey + '.html')}`,
  ], { stdio: 'ignore' })
}
const resize = (src, size, out) =>
  execFileSync('magick', [src, '-resize', `${size}x${size}`, '-strip', out], { stdio: 'ignore' })

if (!CHROME) {
  console.log('! no Chrome/Chromium found — wrote SVGs only; set CHROME=/path to rasterize PNGs')
} else {
  console.log('· rasterizing with', CHROME.split('/').pop())
  const icon512 = join(PUB, 'icon-512.png')
  const mask512 = join(PUB, 'icon-512-maskable.png')
  const fav512 = join(BUILD, 'favicon-512.png')
  shoot('icon', icon512)
  shoot('maskable', mask512)
  shoot('favicon', fav512)

  resize(icon512, 192, join(PUB, 'icon-192.png'))
  resize(icon512, 180, join(PUB, 'apple-touch-icon.png'))
  resize(mask512, 192, join(PUB, 'icon-192-maskable.png'))
  for (const s of [48, 32, 16]) resize(fav512, s, join(PUB, `favicon-${s}.png`))
  execFileSync('magick', [join(PUB, 'favicon-48.png'), join(PUB, 'favicon-32.png'), join(PUB, 'favicon-16.png'), join(PUB, 'favicon.ico')], { stdio: 'ignore' })
  console.log('· wrote icon-{192,512}.png, icon-{192,512}-maskable.png, apple-touch-icon.png, favicon-{16,32,48}.png, favicon.ico')
}
