/**
 * @deepseek-ai/dsh-fui-app — the FUI surface bundle. Its product is the patch
 * layer (`cordis.patch.yml`, declared by the `dsh.bundle.patch` manifest
 * field), which stacks over `dsh-web-app` and swaps the browser roster's
 * presentation rows for their f-ui counterparts.
 *
 * The bundle owns no runtime glue of its own: serving the page, the API
 * gateway, the trust fence, and resolving the frontend dist all stay with
 * `dsh-web-app`, whose rows this layer does not restate. That is the whole
 * point of stacking rather than forking — the FUI surface differs by which
 * client plugins the roster mounts, so `dsh web` keeps working beside
 * `dsh --profile fui` and the two can be compared side by side.
 *
 * This plugin exists because a bundle is a package and a package needs a
 * mountable entry; it contributes nothing at runtime.
 * @module @deepseek-ai/dsh-fui-app
 */

import type { Context } from '@deepseek-ai/cordis'

/** Stable Cordis plugin name. */
export const name = 'fui-app'

/**
 * Mount the FUI surface bundle's (empty) runtime half.
 *
 * The surface is composed entirely by this bundle's patch layer, so there is
 * nothing to register here. Should the FUI surface ever need workspace
 * knowledge of its own — a dist location, a bind-dependent value — this is
 * where it would live, mirroring `dsh-web-app`'s runtime glue.
 * @param _ctx - Cordis context; unused while this bundle is patch-only.
 */
export function apply(_ctx: Context): void {
  // Intentionally empty; see the module doc.
}
