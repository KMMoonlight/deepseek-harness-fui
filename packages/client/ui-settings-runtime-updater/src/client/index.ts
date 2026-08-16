/** Desktop-only Updates settings section for managed DSH runtime updates. */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import runtimeUpdaterRemote from '@deepseek-ai/dsh-host-runtime-updater/remote'
import type {} from '@deepseek-ai/dsh-host-runtime-updater/remote'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import {
  UpdatesSection,
  type UpdatesSectionInjected,
} from './UpdatesSection.tsx'
import { en, zh, type RuntimeUpdaterLocaleKey } from './locales.ts'

export type { UpdatesSectionInjected, UpdatesSectionProps } from './UpdatesSection.tsx'
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

/** Contribute the desktop-only Updates section to the settings shell. */
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
      const t = consumerCtx.locale.bind(NS)

      const describe: UpdatesSectionInjected['describe'] = async (signal) => {
        const result = await consumerCtx.remote.runtimeUpdater.describe({}, signal)
        if (!result.ok) {
          throw new Error(`runtimeUpdater.describe failed: ${result.error.code}: ${result.error.message}`)
        }
        return result.value
      }
      const check: UpdatesSectionInjected['check'] = async (signal) => {
        const result = await consumerCtx.remote.runtimeUpdater.check({}, signal)
        if (!result.ok) {
          throw new Error(`runtimeUpdater.check failed: ${result.error.code}: ${result.error.message}`)
        }
        return result.value
      }
      const update: UpdatesSectionInjected['update'] = async (signal) => {
        const result = await consumerCtx.remote.runtimeUpdater.update({}, signal)
        if (!result.ok) {
          throw new Error(`runtimeUpdater.update failed: ${result.error.code}: ${result.error.message}`)
        }
        return result.value
      }
      const injected = (): UpdatesSectionInjected => ({ describe, check, update })

      consumerCtx.slots.inject('settings.section', () => consumerCtx.slots.register({
        name: 'settings.section',
        id: 'updates',
        order: 30,
        label: () => t('nav'),
        locale: NS,
        inject: injected,
      }, UpdatesSection))
    },
  })
  try {
    await consumer.await()
  } catch (error) {
    /* v8 ignore start -- no test-reachable trigger: ctx.effect captures registration errors and fiber disposal settles the await */
    await consumer.dispose()
    await disposeRemote()
    throw error
    /* v8 ignore stop */
  }
  return async () => {
    await consumer.dispose()
    await disposeRemote()
  }
}
