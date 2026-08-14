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
    await expect.poll(() => page.locator('[data-tone="ok"]').count()).toBe(1)

    const desktop = await captureStableAria(page, '[class*="frame"]', scaffold.workspaceCwd)
    await compareOrRefreshGolden(DESKTOP_EXPECTED, desktop, MODE)
    expect(desktop).toContain('banner: DSH // Agent console')
    expect(desktop).toContain('contentinfo: Profile / FUI')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1680)
    expect(await frame.evaluate(element => getComputedStyle(element).fontFamily)).toContain('Space Mono')

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
    expect(await settings.getByRole('button', { name: 'Light' })
      .evaluate(element => getComputedStyle(element).borderRadius)).toBe('0px')
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
