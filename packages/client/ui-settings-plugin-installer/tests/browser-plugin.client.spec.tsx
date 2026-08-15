// @vitest-environment jsdom
import { Context, Service } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import { usePinnedBrowserLanguages } from '@deepseek-ai/dsh-client-test-runtime'
import type { PluginInstallResult } from '@deepseek-ai/dsh-api-remotes/client'
import { apply, inject, NS } from '../src/client/index.ts'
import { PluginInstallerSettingsTab } from '../src/client/PluginInstallerSettingsTab.tsx'
import type { PluginInstallerSettingsTabInjected } from '../src/client/PluginInstallerSettingsTab.tsx'

usePinnedBrowserLanguages('zh-CN')
afterEach(cleanup)

type InstallTransportResult =
  | { readonly ok: true; readonly value: PluginInstallResult }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }

const installed: PluginInstallResult = {
  ok: true,
  value: { spec: '@scope/plugin', restartRequired: true, stdout: '', stderr: '' },
}

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  ctx.provide('locale', locale)
  class RemoteService extends Service {
    constructor(serviceCtx: Context) {
      super(serviceCtx, 'remote')
    }
  }
  new RemoteService(ctx)
  const add = vi.fn<(request: { spec: string }, signal?: AbortSignal) => Promise<InstallTransportResult>>()
    .mockResolvedValue({ ok: true, value: installed })
  ctx.provide('remote.pluginInstaller', { add })
  return { ctx, slots: ctx.get('slots') as SlotRegistry, locale, add }
}

function declare(slots: SlotRegistry): () => void {
  return slots.register({
    name: 'root',
    children: { 'settings.plugins.tab': { kind: 'list', scope: 'root' } },
  } as never, () => null)
}

describe('ui-settings-plugin-installer browser plugin', () => {
  it('declares only the services used by the installer Remote contribution', () => {
    expect(inject).toEqual(['slots', 'locale', 'remote', 'remote.pluginInstaller'])
  })

  it('registers a localized tab and calls the Remote only through its injected face', async () => {
    const b = await bench()
    declare(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()

    const entry = b.slots.entries('settings.plugins.tab')[0]!
    expect(entry.component).toBe(PluginInstallerSettingsTab)
    expect(entry.options).toMatchObject({ id: 'install', order: 5 })
    expect(entry.locale).toBe(NS)
    expect(resolveSlotLabel(entry.options.label)).toBe('安装插件')
    expect(b.add).not.toHaveBeenCalled()

    const injected = (entry.inject as unknown as () => PluginInstallerSettingsTabInjected)()
    await expect(injected.install('@scope/plugin')).resolves.toEqual(installed)
    expect(b.add).toHaveBeenCalledWith({ spec: '@scope/plugin' }, undefined)
    b.add.mockResolvedValueOnce({ ok: false, error: { code: 'REMOTE_ERROR', message: 'unavailable' } })
    await expect(injected.install('@scope/plugin')).rejects.toThrow(
      'pluginInstaller.add failed: REMOTE_ERROR: unavailable',
    )
    await b.ctx.fiber.dispose()
  })

  it('follows locale and recovers across late declaration and declarer reload', async () => {
    const b = await bench()
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(b.slots.entries('settings.plugins.tab')).toHaveLength(0)

    const stop = declare(b.slots)
    await vi.waitFor(() => { expect(b.slots.entries('settings.plugins.tab')).toHaveLength(1) })
    b.locale.setLocale('en')
    expect(resolveSlotLabel(b.slots.entries('settings.plugins.tab')[0]!.options.label)).toBe('Install plugin')

    stop()
    expect(b.slots.entries('settings.plugins.tab')).toHaveLength(0)
    declare(b.slots)
    await vi.waitFor(() => {
      expect(b.slots.entries('settings.plugins.tab')[0]?.component).toBe(PluginInstallerSettingsTab)
    })
    await fiber.dispose()
    expect(b.slots.entries('settings.plugins.tab')).toHaveLength(0)
    expect(() => b.locale.register(NS, 'zh', {})).not.toThrow()
    await b.ctx.fiber.dispose()
  })
})
