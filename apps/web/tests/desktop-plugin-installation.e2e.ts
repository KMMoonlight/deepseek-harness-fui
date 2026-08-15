// Desktop FUI acceptance: the real Web composition enables the desktop-only
// Host installer and Settings contribution under the application markers.
// The scenario performs no package mutation and no model call.
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
const CLI_ENTRY = fileURLToPath(new URL('../../cli/lib/bin.js', import.meta.url))
const EXPECTED = fileURLToPath(new URL('./snapshots/desktop-plugin-installation/form.expected.md', import.meta.url))
const MODE = webSnapshotMode()

describe('web e2e: desktop plugin installation', () => {
  let scaffold: WebScaffold
  let browser: Browser
  let page: Page
  let tripwire: ReturnType<typeof watchConsole>
  const originalDesktop = process.env.DSH_DESKTOP
  const originalCliEntry = process.env.DSH_DESKTOP_CLI_ENTRY

  beforeAll(async () => {
    process.env.DSH_DESKTOP = '1'
    process.env.DSH_DESKTOP_CLI_ENTRY = CLI_ENTRY
    scaffold = await launchWebScaffold({ extraOverlayPath: FUI_OVERLAY })
    browser = await chromium.launch()
    page = await newEnglishPage(browser, 900)
    tripwire = watchConsole(page)
    await page.goto(scaffold.baseUrl, { waitUntil: 'load' })
    try {
      await page.getByText('Agent console', { exact: true }).waitFor({ timeout: 30_000 })
    } catch (error) {
      throw new AggregateError([
        error,
        ...tripwire.pageErrors,
        ...tripwire.warnings.map(warning => new Error(warning)),
        new Error(`desktop page body: ${await page.locator('body').innerText()}`),
      ], 'desktop FUI did not reach its command rail')
    }
  }, 120_000)

  afterAll(async () => {
    try {
      await browser?.close()
      await scaffold?.close()
    } finally {
      if (originalDesktop === undefined) delete process.env.DSH_DESKTOP
      else process.env.DSH_DESKTOP = originalDesktop
      if (originalCliEntry === undefined) delete process.env.DSH_DESKTOP_CLI_ENTRY
      else process.env.DSH_DESKTOP_CLI_ENTRY = originalCliEntry
    }
  })

  it('exposes the trusted package form only in the desktop composition', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-desktop-plugin-installation'))
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Settings' })
    await dialog.getByRole('button', { name: 'Plugins', exact: true }).click()
    const installTab = dialog.getByRole('tab', { name: 'Install plugin', exact: true })
    await installTab.waitFor({ timeout: 10_000 })
    await installTab.click()

    const input = dialog.getByRole('textbox', { name: 'Plugin package or Git URL', exact: true })
    await input.waitFor({ timeout: 10_000 })
    expect(await dialog.getByRole('heading', { name: 'Install from a plugin package', exact: true }).count()).toBe(1)
    expect(await dialog.getByText('Plugins can run code on this computer. Install only from sources you trust.', { exact: true }).count()).toBe(1)
    expect(await dialog.getByRole('button', { name: 'Install', exact: true }).isDisabled()).toBe(true)

    await input.fill('@scope/plugin@latest')
    expect(await dialog.getByRole('button', { name: 'Install', exact: true }).isEnabled()).toBe(true)
    const snapshot = await captureStableAria(page, '[role="dialog"]', scaffold.workspaceCwd)
    await compareOrRefreshGolden(EXPECTED, snapshot, MODE)
    expect(tripwire.pageErrors).toEqual([])
    expect(tripwire.warnings).toEqual([])
  })
})
