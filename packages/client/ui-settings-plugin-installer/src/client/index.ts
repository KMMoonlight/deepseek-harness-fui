/** Desktop plugin-installation form registered into Web Settings. */

import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import {
  PluginInstallerSettingsTab,
  type PluginInstallerSettingsTabInjected,
} from './PluginInstallerSettingsTab.tsx'
import { en, zh, type PluginInstallerLocaleKey } from './locales.ts'

export type { PluginInstallerSettingsTabInjected, PluginInstallerSettingsTabProps } from './PluginInstallerSettingsTab.tsx'
export type { PluginInstallerLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Desktop plugin-installation copy. */
    'settings.pluginInstaller': PluginInstallerLocaleKey
  }
}

/** Dictionary namespace owned by this plugin. */
export const NS = 'settings.pluginInstaller'

/** Services required by the Settings registration and generated Remote face. */
export const inject = ['slots', 'locale', 'remote', 'remote.pluginInstaller']

/** Contribute the desktop-only installation tab to Plugins settings. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-settings-plugin-installer: dictionaries')

  const t = ctx.locale.bind(NS)
  const install: PluginInstallerSettingsTabInjected['install'] = async (spec, signal) => {
    const result = await ctx.remote.pluginInstaller.add({ spec }, signal)
    if (!result.ok) {
      throw new Error(`pluginInstaller.add failed: ${result.error.code}: ${result.error.message}`)
    }
    return result.value
  }
  const injected = (): PluginInstallerSettingsTabInjected => ({ install })

  ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
    name: 'settings.plugins.tab',
    id: 'install',
    order: 5,
    label: () => t('tab'),
    locale: NS,
    inject: injected,
  }, PluginInstallerSettingsTab))
}
