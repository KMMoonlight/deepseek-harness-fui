/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-fui-app`.
 * @module @deepseek-ai/dsh-fui-app/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-fui-app'

/** Cordis companion plugin name. */
export const name = 'fui-app-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: a patch-only bundle whose runtime half registers
 * nothing. What this bundle asserts — that its layer lands over dsh-web-app
 * and replaces the rows it names — is a composition fact, observable in
 * `dsh --profile fui --dump-config` and covered by this package's specs.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
