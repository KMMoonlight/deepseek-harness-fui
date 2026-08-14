/**
 * Host half of the FUI surface claim. The work is entirely browser-side; this
 * entry exists so the Loader governs the package's lifecycle and the web
 * plugin registry discovers its `dsh.client` declaration.
 */

/** Stable Cordis plugin name. */
export const name = 'client-ui-fui-surface'

/** Mount the host half; the surface claim lives in the browser bundle. */
export function apply(): void {
  // Intentionally empty; see the module doc.
}
