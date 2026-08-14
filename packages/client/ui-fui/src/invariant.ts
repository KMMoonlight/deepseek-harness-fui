/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-client-ui-fui`.
 * @module @deepseek-ai/dsh-client-ui-fui/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-fui'

/** Cordis companion plugin name. */
export const name = 'client-ui-fui-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: vendored presentation components that hold no cordis
 * service, emit no events, and own no lifecycle. The one contract worth
 * asserting — that tones resolve through `--fui-*` custom properties rather
 * than colour literals — is a static property of the sources and is checked by
 * this package's specs, not at runtime.
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
