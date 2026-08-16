/** Package-owned invariant companion. @module @deepseek-ai/dsh-client-ui-settings-runtime-updater/invariant */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-settings-runtime-updater'

/** Cordis companion plugin name. */
export const name = 'client-ui-settings-runtime-updater-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/** No runtime invariant: the Host update result is authoritative and the row owns local state only. */
const install: InvariantInstaller = () => {}

/** Register this package's invariant companion. */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
