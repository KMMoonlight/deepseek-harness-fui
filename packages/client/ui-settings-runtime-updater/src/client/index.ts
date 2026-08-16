/** Desktop managed-runtime update row registered into General settings. */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
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

/** Services required by the General registration and generated Remote face. */
export const inject = ['slots', 'locale', 'remote', 'remote.runtimeUpdater']

/** Contribute the desktop-only runtime update row to General settings. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-settings-runtime-updater: dictionaries')

  const describe: RuntimeUpdaterRowInjected['describe'] = async (signal) => {
    const result = await ctx.remote.runtimeUpdater.describe({}, signal)
    if (!result.ok) {
      throw new Error(`runtimeUpdater.describe failed: ${result.error.code}: ${result.error.message}`)
    }
    return result.value
  }
  const update: RuntimeUpdaterRowInjected['update'] = async (signal) => {
    const result = await ctx.remote.runtimeUpdater.update({}, signal)
    if (!result.ok) {
      throw new Error(`runtimeUpdater.update failed: ${result.error.code}: ${result.error.message}`)
    }
    return result.value
  }
  const injected = (): RuntimeUpdaterRowInjected => ({ describe, update })

  ctx.slots.inject('settings.general.item', () => ctx.slots.register({
    name: 'settings.general.item',
    id: 'desktop-runtime-update',
    order: 90,
    locale: NS,
    inject: injected,
  }, RuntimeUpdaterRow))
}
