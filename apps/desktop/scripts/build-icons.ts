/**
 * Generate the desktop icon set from the FUI whale mark. The whale path is
 * read out of the ui-primitives FishLogo source so the artwork tracks the
 * product logo; the app icon renders it as CRT phosphor strokes (scanlines +
 * glow on the FUI deep-navy plate), the macOS tray image is the silhouette
 * template artwork, and the colored tray image serves Windows/Linux. Output
 * lands in apps/desktop/resources and is committed; rerun after logo or token
 * changes via `pnpm --filter @deepseek-ai/dsh-desktop run build:icons`.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright'

const desktopRoot = resolve(import.meta.dirname, '..')
const resourcesDir = join(desktopRoot, 'resources')
const fishLogoSource = join(
  desktopRoot, '../../packages/client/ui-primitives/src/FishLogo.tsx',
)

/** Whale mark viewBox (ui-primitives FishLogo). */
const WHALE_WIDTH = 23.16
const WHALE_HEIGHT = 17.04
/** FUI tokens (packages/client/ui-fui/src/styles/fui.css). */
const FUI_BG = '#060c18'
const FUI_PLATE_TOP = '#0d1830'
const FUI_PRIMARY = '#2fe0a8'
const FUI_LINE = 'rgba(63, 143, 196, 0.35)'
const FUI_SCANLINE = 'rgba(63, 143, 196, 0.10)'

/** Extract the whale outline path data from the FishLogo component source. */
async function whalePath(): Promise<string> {
  const source = await readFile(fishLogoSource, 'utf8')
  const match = /d="([^"]+)"/.exec(source)
  const d = match?.[1]
  if (d === undefined) throw new Error(`no path data found in ${fishLogoSource}`)
  return d
}

/** Scale/translate placing the whale at `width` px, centered in `canvas`. */
function whaleTransform(canvas: number, width: number): string {
  const scale = width / WHALE_WIDTH
  const x = (canvas - width) / 2
  const y = (canvas - WHALE_HEIGHT * scale) / 2
  return `translate(${x} ${y}) scale(${scale})`
}

/** Application icon: phosphor-stroked whale with CRT scanlines on the FUI plate. */
function appIconSvg(d: string): string {
  const canvas = 1024
  const plate = 912
  const inset = (canvas - plate) / 2
  const radius = 208
  const strokeWidth = 0.34 // whale units: ~9px at the 600px render width
  const transform = whaleTransform(canvas, 600)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas}" height="${canvas}" viewBox="0 0 ${canvas} ${canvas}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${FUI_PLATE_TOP}"/>
      <stop offset="1" stop-color="${FUI_BG}"/>
    </linearGradient>
    <pattern id="scan" width="8" height="8" patternUnits="userSpaceOnUse">
      <rect width="8" height="1.5" fill="${FUI_SCANLINE}"/>
    </pattern>
    <clipPath id="plate">
      <rect x="${inset}" y="${inset}" width="${plate}" height="${plate}" rx="${radius}"/>
    </clipPath>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="14"/>
    </filter>
  </defs>
  <rect x="${inset}" y="${inset}" width="${plate}" height="${plate}" rx="${radius}" fill="url(#bg)"/>
  <g clip-path="url(#plate)">
    <rect x="${inset}" y="${inset}" width="${plate}" height="${plate}" fill="url(#scan)"/>
    <g transform="${transform}">
      <path d="${d}" fill="none" stroke="${FUI_PRIMARY}" stroke-width="${strokeWidth * 2.4}"
        stroke-linejoin="round" stroke-linecap="round" opacity="0.45" filter="url(#glow)"/>
      <path d="${d}" fill="none" stroke="${FUI_PRIMARY}" stroke-width="${strokeWidth}"
        stroke-linejoin="round" stroke-linecap="round"/>
    </g>
  </g>
  <rect x="${inset}" y="${inset}" width="${plate}" height="${plate}" rx="${radius}"
    fill="none" stroke="${FUI_LINE}" stroke-width="3"/>
</svg>`
}

/** Tray glyph: solid whale silhouette (black template for macOS, FUI green elsewhere). */
function traySvg(d: string, canvas: number, fill: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas}" height="${canvas}" viewBox="0 0 ${canvas} ${canvas}">
  <g transform="${whaleTransform(canvas, canvas * 0.78)}">
    <path d="${d}" fill="${fill}"/>
  </g>
</svg>`
}

/** Rasterize one SVG document at its declared size. */
async function rasterize(svg: string, size: number, transparent: boolean): Promise<Buffer> {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    })
    await page.setContent(
      `<!doctype html><html><body style="margin:0;${transparent ? 'background:transparent;' : ''}">${svg}</body></html>`,
    )
    return await page.screenshot({ omitBackground: transparent })
  } finally {
    await browser.close()
  }
}

const d = await whalePath()
await mkdir(resourcesDir, { recursive: true })
const outputs: ReadonlyArray<readonly [string, string, number, boolean]> = [
  ['icon.png', appIconSvg(d), 1024, true],
  ['tray-icon.png', traySvg(d, 18, FUI_PRIMARY), 18, true],
  ['tray-icon@2x.png', traySvg(d, 36, FUI_PRIMARY), 36, true],
  ['tray-iconTemplate.png', traySvg(d, 18, '#000000'), 18, true],
  ['tray-iconTemplate@2x.png', traySvg(d, 36, '#000000'), 36, true],
]
for (const [name, svg, size, transparent] of outputs) {
  await writeFile(join(resourcesDir, name), await rasterize(svg, size, transparent))
  console.log(`wrote resources/${name} (${size}x${size})`)
}
