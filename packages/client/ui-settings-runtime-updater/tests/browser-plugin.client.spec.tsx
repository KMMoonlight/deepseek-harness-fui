// @vitest-environment jsdom
import { cleanup } from '@testing-library/react'
import { Context, Service } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeUpdateDescription, RuntimeUpdateResult } from '@deepseek-ai/dsh-host-runtime-updater/types'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { usePinnedBrowserLanguages } from '@deepseek-ai/dsh-client-test-runtime'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import { apply, inject, NS } from '../src/client/index.ts'
import { RuntimeUpdaterRow } from '../src/client/RuntimeUpdaterRow.tsx'
import type { RuntimeUpdaterRowInjected } from '../src/client/RuntimeUpdaterRow.tsx'

usePinnedBrowserLanguages('zh-CN')
afterEach(cleanup)

type Transport<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }

const description: RuntimeUpdateDescription = {
  packageName: '@deepseek-ai/dsh', currentVersion: '1.0.0', fuiVersion: '7.0.0',
  compatibleDshRange: '>=1.0.0 <2.0.0', source: 'bundled', distTag: 'latest',
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
  const updateRemote = vi.fn<() => Promise<Transport<RuntimeUpdateResult>>>()
    .mockResolvedValue({ ok: true, value: upToDate })
  new RemoteService(ctx)
  return { ctx, slots: ctx.get('slots') as SlotRegistry, locale, describeRemote, updateRemote, disposeRemote }
}

function declare(slots: SlotRegistry): () => void {
  return slots.register({
    name: 'root',
    children: { 'settings.general.item': { kind: 'list', scope: 'root' } },
  } as never, () => null)
}

describe('ui-settings-runtime-updater browser plugin', () => {
  it('registers a localized General row and uses only the injected Remote face', async () => {
    expect(inject).toEqual(['remote'])
    const b = await bench()
    declare(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()

    const entry = b.slots.entries('settings.general.item')[0]!
    expect(entry.component).toBe(RuntimeUpdaterRow)
    expect(entry.options).toMatchObject({ id: 'desktop-runtime-update', order: 90 })
    expect(entry.locale).toBe(NS)
    expect(resolveSlotLabel(entry.options.label)).toBeUndefined()

    const injected = (entry.inject as unknown as () => RuntimeUpdaterRowInjected)()
    await expect(injected.describe()).resolves.toEqual(description)
    await expect(injected.update()).resolves.toEqual(upToDate)
    expect(b.describeRemote).toHaveBeenCalledWith({}, undefined)
    expect(b.updateRemote).toHaveBeenCalledWith({}, undefined)

    b.updateRemote.mockResolvedValueOnce({ ok: false, error: { code: 'REMOTE_ERROR', message: 'unavailable' } })
    await expect(injected.update()).rejects.toThrow('runtimeUpdater.update failed: REMOTE_ERROR: unavailable')
    await b.ctx.fiber.dispose()
    expect(b.disposeRemote).toHaveBeenCalledOnce()
  })

  it('recovers across late slot declaration and declarer reload', async () => {
    const b = await bench()
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(b.slots.entries('settings.general.item')).toHaveLength(0)

    const stop = declare(b.slots)
    await vi.waitFor(() => { expect(b.slots.entries('settings.general.item')).toHaveLength(1) })
    stop()
    expect(b.slots.entries('settings.general.item')).toHaveLength(0)
    declare(b.slots)
    await vi.waitFor(() => {
      expect(b.slots.entries('settings.general.item')[0]?.component).toBe(RuntimeUpdaterRow)
    })
    await fiber.dispose()
    expect(b.slots.entries('settings.general.item')).toHaveLength(0)
    await b.ctx.fiber.dispose()
  })
})
