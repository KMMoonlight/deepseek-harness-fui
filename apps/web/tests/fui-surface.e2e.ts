// The FUI profile's assembled browser acceptance. It applies the shipped FUI
// patch over the ordinary Web scaffold, so the golden and geometry assertions
// cover the real runtime module table, plugin bundles, locale seat, and narrow
// concession rather than a source-only component bench.
import { fileURLToPath } from 'node:url'
import type { Browser, Page } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it, onTestFailed } from 'vitest'
import {
  captureStableAria, compareOrRefreshGolden, launchWebScaffold, watchConsole,
  webSnapshotMode, type WebScaffold,
} from './scaffold.ts'
import { newEnglishPage, saveFailureShot } from './support.ts'

const FUI_OVERLAY = fileURLToPath(new URL('../../../packages/bundle/fui-app/cordis.patch.yml', import.meta.url))
const SNAPSHOT_DIR = fileURLToPath(new URL('./snapshots/fui-surface', import.meta.url))
const DESKTOP_EXPECTED = `${SNAPSHOT_DIR}/desktop.expected.md`
const NARROW_EXPECTED = `${SNAPSHOT_DIR}/narrow.expected.md`
const MODE = webSnapshotMode()

describe('web e2e: FUI surface', () => {
  let scaffold: WebScaffold
  let browser: Browser
  let page: Page
  let tripwire: ReturnType<typeof watchConsole>

  beforeAll(async () => {
    scaffold = await launchWebScaffold({ extraOverlayPath: FUI_OVERLAY })
    browser = await chromium.launch()
    page = await newEnglishPage(browser, 900)
    tripwire = watchConsole(page)
    await page.goto(scaffold.baseUrl, { waitUntil: 'load' })
    await page.getByText('Agent console', { exact: true }).waitFor({ timeout: 30_000 })
  }, 120_000)

  afterAll(async () => {
    await browser?.close()
    await scaffold?.close()
  })

  it('renders the shared FUI module and preserves the center column when narrow', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-fui-surface'))
    const frame = page.locator('[class*="frame"]').first()
    await expect.poll(() => page.locator('body[data-fui-surface]').count()).toBe(1)
    await expect.poll(() => page.locator('.fui-scanlines').count()).toBe(1)
    // The rail carries only the product identity: no status badge (or any
    // toned chrome) occupies the viewport's top-right corner.
    await expect.poll(() => page.locator('[data-tone]').count()).toBe(0)

    const desktop = await captureStableAria(page, '[class*="frame"]', scaffold.workspaceCwd)
    await compareOrRefreshGolden(DESKTOP_EXPECTED, desktop, MODE)
    expect(desktop).toContain('banner: DSH // Agent console')
    expect(desktop).toContain('contentinfo: Profile / FUI')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1680)
    expect(await frame.evaluate(element => getComputedStyle(element).fontFamily)).toContain('Space Mono')

    const workspaceTrigger = page.locator('[data-composer-card]')
    const triggerGeometry = await workspaceTrigger.evaluate((element) => {
      const card = getComputedStyle(element)
      const frame = getComputedStyle(element, '::after')
      return {
        cardBorder: card.borderColor,
        cardRadius: card.borderRadius,
        frameBorderStyle: frame.borderStyle,
        frameMask: frame.maskImage,
        frameRadius: frame.borderRadius,
      }
    })
    expect(triggerGeometry).toEqual({
      cardBorder: 'rgba(0, 0, 0, 0)',
      cardRadius: '0px',
      frameBorderStyle: 'dashed',
      frameMask: 'none',
      frameRadius: '0px',
    })
    expect(await page.getByRole('button', { name: 'Standard mode', exact: true })
      .evaluate(element => getComputedStyle(element).borderRadius)).toBe('0px')

    const commandBar = page.getByRole('banner')
    expect(await commandBar.evaluate(element => getComputedStyle(element).paddingLeft)).toBe('12px')
    await page.locator('html').evaluate((element) => {
      element.setAttribute('data-dsh-native-titlebar', 'macos-overlay')
    })
    expect(await commandBar.evaluate(element => getComputedStyle(element).paddingLeft)).toBe('92px')
    await page.locator('html').evaluate((element) => {
      element.removeAttribute('data-dsh-native-titlebar')
    })
    await page.locator('html').evaluate((element) => {
      element.setAttribute('data-dsh-desktop-shell', 'electron')
    })
    const electronWindowChrome = await commandBar.evaluate((element) => {
      const interactive = document.createElement('button')
      element.append(interactive)
      const region = (target: Element): string => {
        const style = getComputedStyle(target)
        return style.getPropertyValue('app-region') || style.getPropertyValue('-webkit-app-region')
      }
      const result = { commandBar: region(element), interactive: region(interactive) }
      interactive.remove()
      return result
    })
    expect(electronWindowChrome).toEqual({ commandBar: 'drag', interactive: 'no-drag' })
    await page.locator('html').evaluate((element) => {
      element.removeAttribute('data-dsh-desktop-shell')
    })

    await page.getByRole('button', { name: 'Standard mode', exact: true }).click()
    const standardPreset = page.getByRole('menuitem', { name: /^Standard mode\b/ })
    await standardPreset.hover()
    const presetHoverContrast = await standardPreset.evaluate((element) => {
      const parseRgb = (value: string): [number, number, number] => {
        const channels = value.match(/[\d.]+/g)?.slice(0, 3).map(Number)
        if (channels === undefined || channels.length !== 3) throw new Error(`Expected RGB color, received ${value}`)
        return channels as [number, number, number]
      }
      const luminance = (value: string): number => {
        const [red, green, blue] = parseRgb(value).map((channel) => {
          const normalized = channel / 255
          return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
        }) as [number, number, number]
        return 0.2126 * red + 0.7152 * green + 0.0722 * blue
      }
      const contrast = (foreground: string, background: string): number => {
        const lighter = Math.max(luminance(foreground), luminance(background))
        const darker = Math.min(luminance(foreground), luminance(background))
        return (lighter + 0.05) / (darker + 0.05)
      }
      const background = getComputedStyle(element).backgroundColor
      const richText = Array.from(element.querySelectorAll('[class*="itemName"], [class*="itemDesc"]'))
      const check = element.querySelector('svg')
      return {
        text: richText.map(node => contrast(getComputedStyle(node).color, background)),
        check: check === null ? 0 : contrast(getComputedStyle(check).color, background),
      }
    })
    expect(presetHoverContrast.text).toHaveLength(2)
    expect(Math.min(...presetHoverContrast.text)).toBeGreaterThanOrEqual(4.5)
    expect(presetHoverContrast.check).toBeGreaterThanOrEqual(3)
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    const settings = page.getByRole('dialog', { name: 'Settings' })
    await settings.waitFor({ timeout: 10_000 })
    const settingsStyle = await settings.evaluate((element) => {
      const computed = getComputedStyle(element)
      return {
        borderRadius: computed.borderRadius,
        fontFamily: computed.fontFamily,
      }
    })
    expect(settingsStyle.borderRadius).toBe('0px')
    expect(settingsStyle.fontFamily).toContain('Space Mono')
    const activeSettingsNav = settings.getByRole('button', { name: 'General' })
    expect(await activeSettingsNav.evaluate(element => getComputedStyle(element).borderRadius)).toBe('0px')
    expect(await settings.getByText('Appearance', { exact: true }).count()).toBe(0)
    expect(await settings.getByRole('button', { name: 'Light' }).count()).toBe(0)
    await page.keyboard.press('Escape')

    await page.setViewportSize({ width: 375, height: 812 })
    await expect.poll(() => frame.getAttribute('data-sidebar-collapsed')).not.toBeNull()
    const narrow = await captureStableAria(page, '[class*="frame"]', scaffold.workspaceCwd)
    await compareOrRefreshGolden(NARROW_EXPECTED, narrow, MODE)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375)
    expect(await page.locator('main#dsh-main-content').count()).toBe(1)
    expect(tripwire.pageErrors).toEqual([])
    expect(tripwire.warnings).toEqual([])
  })
})
