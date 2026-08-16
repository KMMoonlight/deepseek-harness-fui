/** Desktop managed-runtime update row registered into General settings. */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import runtimeUpdaterRemote from '@deepseek-ai/dsh-host-runtime-updater/remote'
import type {} from '@deepseek-ai/dsh-host-runtime-updater/remote'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import {
  RuntimeUpdaterRow,
  type RuntimeUpdaterRowInjected,
} from './RuntimeUpdaterRow.tsx'
import { en, zh, type RuntimeUpdaterLocaleKey } from './locales.ts'

export type { RuntimeUpdaterRowInjected, RuntimeUpdaterRowProps } from './RuntimeUpdaterRow.tsx'
export type { RuntimeUpdaterLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Desktop managed-runtime update copy. */
    'settings.runtimeUpdater': RuntimeUpdaterLocaleKey
  }
}

/** Dictionary namespace owned by this plugin. */
export const NS = 'settings.runtimeUpdater'

/** Generic Remote service required before this plugin mounts its private contribution. */
export const inject = ['remote']

/** Contribute the desktop-only runtime update row to General settings. */
export async function apply(ctx: ClientContext): Promise<() => Promise<void>> {
  const disposeRemote = await ctx.remote.$mount(runtimeUpdaterRemote)
  const consumer = ctx.plugin({
    name: 'ui-settings-runtime-updater-consumer',
    inject: ['slots', 'locale', 'remote.runtimeUpdater'],
    apply: (consumerCtx: ClientContext) => {
      consumerCtx.effect(
        () => consumerCtx.locale.register(NS, { zh, en }),
        'ui-settings-runtime-updater: dictionaries',
      )

      const describe: RuntimeUpdaterRowInjected['describe'] = async (signal) => {
        const result = await consumerCtx.remote.runtimeUpdater.describe({}, signal)
        if (!result.ok) {
          throw new Error(`runtimeUpdater.describe failed: ${result.error.code}: ${result.error.message}`)
        }
        return result.value
      }
      const update: RuntimeUpdaterRowInjected['update'] = async (signal) => {
        const result = await consumerCtx.remote.runtimeUpdater.update({}, signal)
        if (!result.ok) {
          throw new Error(`runtimeUpdater.update failed: ${result.error.code}: ${result.error.message}`)
        }
        return result.value
      }
      const injected = (): RuntimeUpdaterRowInjected => ({ describe, update })

      consumerCtx.slots.inject('settings.general.item', () => consumerCtx.slots.register({
        name: 'settings.general.item',
        id: 'desktop-runtime-update',
        order: 90,
        locale: NS,
        inject: injected,
      }, RuntimeUpdaterRow))
    },
  })
  try {
    await consumer.await()
  } catch (error) {
    await consumer.dispose()
    await disposeRemote()
    throw error
  }
  return async () => {
    await consumer.dispose()
    await disposeRemote()
  }
}
