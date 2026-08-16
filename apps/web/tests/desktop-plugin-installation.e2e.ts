// Desktop FUI acceptance: the real Web composition enables the desktop-only
// Host installer, runtime updater, and Settings contributions under the application markers.
// The scenario performs no package mutation and no model call.
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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
const OVERLAY_ROOT = fileURLToPath(new URL('../../desktop/runtime/node_modules/', import.meta.url))
const EXPECTED = fileURLToPath(new URL('./snapshots/desktop-plugin-installation/form.expected.md', import.meta.url))
const RUNTIME_EXPECTED = fileURLToPath(new URL('./snapshots/desktop-plugin-installation/runtime.expected.md', import.meta.url))
const MODE = webSnapshotMode()

describe('web e2e: desktop plugin installation', () => {
  let scaffold: WebScaffold
  let browser: Browser
  let page: Page
  let tripwire: ReturnType<typeof watchConsole>
  let runtimeRoot: string
  const originalDesktop = process.env.DSH_DESKTOP
  const originalCliEntry = process.env.DSH_DESKTOP_CLI_ENTRY
  const originalPnpmEntry = process.env.DSH_PNPM_ENTRY
  const originalRuntimeRoot = process.env.DSH_DESKTOP_RUNTIME_ROOT
  const originalRuntimeSource = process.env.DSH_DESKTOP_RUNTIME_SOURCE
  const originalRuntimeVersion = process.env.DSH_DESKTOP_RUNTIME_VERSION
  const originalFuiVersion = process.env.DSH_DESKTOP_FUI_VERSION
  const originalDshCompatibility = process.env.DSH_DESKTOP_DSH_COMPATIBILITY
  const originalOverlayRoot = process.env.DSH_DESKTOP_OVERLAY_ROOT

  beforeAll(async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'dsh-desktop-runtime-e2e-'))
    process.env.DSH_DESKTOP = '1'
    process.env.DSH_DESKTOP_CLI_ENTRY = CLI_ENTRY
    process.env.DSH_PNPM_ENTRY = CLI_ENTRY
    process.env.DSH_DESKTOP_RUNTIME_ROOT = runtimeRoot
    process.env.DSH_DESKTOP_RUNTIME_SOURCE = 'bundled'
    process.env.DSH_DESKTOP_RUNTIME_VERSION = '0.1.0-rc.5'
    process.env.DSH_DESKTOP_FUI_VERSION = '0.1.0-rc.5'
    process.env.DSH_DESKTOP_DSH_COMPATIBILITY = '>=0.1.0-rc.5 <0.2.0'
    process.env.DSH_DESKTOP_OVERLAY_ROOT = OVERLAY_ROOT
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
      if (originalPnpmEntry === undefined) delete process.env.DSH_PNPM_ENTRY
      else process.env.DSH_PNPM_ENTRY = originalPnpmEntry
      if (originalRuntimeRoot === undefined) delete process.env.DSH_DESKTOP_RUNTIME_ROOT
      else process.env.DSH_DESKTOP_RUNTIME_ROOT = originalRuntimeRoot
      if (originalRuntimeSource === undefined) delete process.env.DSH_DESKTOP_RUNTIME_SOURCE
      else process.env.DSH_DESKTOP_RUNTIME_SOURCE = originalRuntimeSource
      if (originalRuntimeVersion === undefined) delete process.env.DSH_DESKTOP_RUNTIME_VERSION
      else process.env.DSH_DESKTOP_RUNTIME_VERSION = originalRuntimeVersion
      if (originalFuiVersion === undefined) delete process.env.DSH_DESKTOP_FUI_VERSION
      else process.env.DSH_DESKTOP_FUI_VERSION = originalFuiVersion
      if (originalDshCompatibility === undefined) delete process.env.DSH_DESKTOP_DSH_COMPATIBILITY
      else process.env.DSH_DESKTOP_DSH_COMPATIBILITY = originalDshCompatibility
      if (originalOverlayRoot === undefined) delete process.env.DSH_DESKTOP_OVERLAY_ROOT
      else process.env.DSH_DESKTOP_OVERLAY_ROOT = originalOverlayRoot
      await rm(runtimeRoot, { recursive: true, force: true })
    }
  })

  it('shows the managed runtime control without checking the registry on mount', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-desktop-runtime-updater'))
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Settings' })
    await dialog.getByRole('button', { name: 'Updates', exact: true }).click()
    await dialog.getByRole('heading', { name: 'Runtime updates', exact: true }).waitFor({ timeout: 10_000 })
    const current = dialog.getByText('0.1.0-rc.5', { exact: true })
    await current.waitFor({ timeout: 10_000 })
    expect(await current.count()).toBe(1)
    expect(await dialog.getByText('Bundled with app', { exact: true }).count()).toBe(1)
    expect(await dialog.getByText('Not checked', { exact: true }).count()).toBe(1)
    expect(await dialog.getByRole('button', { name: 'Check for updates', exact: true }).isEnabled()).toBe(true)
    const snapshot = await captureStableAria(page, '[role="dialog"]', scaffold.workspaceCwd)
    await compareOrRefreshGolden(RUNTIME_EXPECTED, snapshot, MODE)
    expect(tripwire.pageErrors).toEqual([])
    expect(tripwire.warnings).toEqual([])
    await dialog.getByRole('button', { name: 'Close', exact: true }).click()
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
