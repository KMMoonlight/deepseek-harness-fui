// @vitest-environment jsdom
import { cleanup } from '@testing-library/react'
import { Context, Service } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  RuntimeUpdateCheckResult,
  RuntimeUpdateDescription,
  RuntimeUpdateResult,
} from '@deepseek-ai/dsh-host-runtime-updater/types'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { usePinnedBrowserLanguages } from '@deepseek-ai/dsh-client-test-runtime'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import { apply, inject, NS } from '../src/client/index.ts'
import { UpdatesSection } from '../src/client/UpdatesSection.tsx'
import type { UpdatesSectionInjected } from '../src/client/UpdatesSection.tsx'

usePinnedBrowserLanguages('zh-CN')
afterEach(cleanup)

type Transport<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }

const description: RuntimeUpdateDescription = {
  packageName: '@deepseek-ai/dsh', currentVersion: '1.0.0', fuiVersion: '7.0.0',
  compatibleDshRange: '>=1.0.0 <2.0.0', source: 'bundled', distTag: 'latest',
}
const checked: RuntimeUpdateCheckResult = {
  ok: true,
  value: { currentVersion: '1.0.0', latestVersion: '1.1.0', updateAvailable: true, compatible: true },
}
const upToDate: RuntimeUpdateResult = {
  ok: true,
  value: { status: 'up-to-date', currentVersion: '1.0.0', latestVersion: '1.0.0', restartRequired: false },
}

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  ctx.provide('locale', locale)
  const disposeRemote = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
  class RemoteService extends Service {
    constructor(serviceCtx: Context) {
      super(serviceCtx, 'remote')
    }

    async $mount(): Promise<() => Promise<void>> {
      const dispose = this.ctx.provide('remote.runtimeUpdater', {
        describe: describeRemote,
        check: checkRemote,
        update: updateRemote,
      })
      return async () => {
        dispose()
        await disposeRemote()
      }
    }
  }
  const describeRemote = vi.fn<() => Promise<Transport<RuntimeUpdateDescription>>>()
    .mockResolvedValue({ ok: true, value: description })
  const checkRemote = vi.fn<() => Promise<Transport<RuntimeUpdateCheckResult>>>()
    .mockResolvedValue({ ok: true, value: checked })
  const updateRemote = vi.fn<() => Promise<Transport<RuntimeUpdateResult>>>()
    .mockResolvedValue({ ok: true, value: upToDate })
  new RemoteService(ctx)
  return { ctx, slots: ctx.get('slots') as SlotRegistry, locale, describeRemote, checkRemote, updateRemote, disposeRemote }
}

function declare(slots: SlotRegistry): () => void {
  return slots.register({
    name: 'root',
    children: { 'settings.section': { kind: 'list', scope: 'root' } },
  } as never, () => null)
}

describe('ui-settings-runtime-updater browser plugin', () => {
  it('registers a localized Updates section and uses only the injected Remote face', async () => {
    expect(inject).toEqual(['remote'])
    const b = await bench()
    declare(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()

    const entry = b.slots.entries('settings.section')[0]!
    expect(entry.component).toBe(UpdatesSection)
    expect(entry.options).toMatchObject({ id: 'updates', order: 30 })
    expect(entry.locale).toBe(NS)
    expect(resolveSlotLabel(entry.options.label)).toBe('更新')

    const injected = (entry.inject as unknown as () => UpdatesSectionInjected)()
    await expect(injected.describe()).resolves.toEqual(description)
    await expect(injected.check()).resolves.toEqual(checked)
    await expect(injected.update()).resolves.toEqual(upToDate)
    expect(b.describeRemote).toHaveBeenCalledWith({}, undefined)
    expect(b.checkRemote).toHaveBeenCalledWith({}, undefined)
    expect(b.updateRemote).toHaveBeenCalledWith({}, undefined)

    b.describeRemote.mockResolvedValueOnce({ ok: false, error: { code: 'REMOTE_ERROR', message: 'unavailable' } })
    await expect(injected.describe()).rejects.toThrow('runtimeUpdater.describe failed: REMOTE_ERROR: unavailable')
    b.checkRemote.mockResolvedValueOnce({ ok: false, error: { code: 'REMOTE_ERROR', message: 'unavailable' } })
    await expect(injected.check()).rejects.toThrow('runtimeUpdater.check failed: REMOTE_ERROR: unavailable')
    b.updateRemote.mockResolvedValueOnce({ ok: false, error: { code: 'REMOTE_ERROR', message: 'unavailable' } })
    await expect(injected.update()).rejects.toThrow('runtimeUpdater.update failed: REMOTE_ERROR: unavailable')
    await b.ctx.fiber.dispose()
    expect(b.disposeRemote).toHaveBeenCalledOnce()
  })

  it('cleans up the mounted Remote when the plugin fiber is disposed mid-wait', async () => {
    const ctx = new Context()
    await ctx.plugin(SlotRegistry).await()
    const disposeRemote = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    let mounted = false
    class RemoteService extends Service {
      constructor(serviceCtx: Context) {
        super(serviceCtx, 'remote')
      }

      $mount(): Promise<() => Promise<void>> {
        mounted = true
        // Never provides remote.runtimeUpdater: the consumer waits on the
        // absent service, and fiber disposal settles the mount either way.
        return Promise.resolve(async () => { await disposeRemote() })
      }
    }
    new RemoteService(ctx)
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await vi.waitFor(() => { expect(mounted).toBe(true) })
    await fiber.dispose()
    await ctx.fiber.dispose()
    expect(disposeRemote).toHaveBeenCalledOnce()
  })

  it('recovers across late slot declaration and declarer reload', async () => {
    const b = await bench()
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(b.slots.entries('settings.section')).toHaveLength(0)

    const stop = declare(b.slots)
    await vi.waitFor(() => { expect(b.slots.entries('settings.section')).toHaveLength(1) })
    stop()
    expect(b.slots.entries('settings.section')).toHaveLength(0)
    declare(b.slots)
    await vi.waitFor(() => {
      expect(b.slots.entries('settings.section')[0]?.component).toBe(UpdatesSection)
    })
    await fiber.dispose()
    expect(b.slots.entries('settings.section')).toHaveLength(0)
    await b.ctx.fiber.dispose()
  })
})
