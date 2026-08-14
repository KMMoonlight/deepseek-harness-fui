/**
 * Temporary FUI build probe.
 *
 * Renders one real vendored component outside the shell's mount point, which
 * is what makes it a probe rather than a decoration: if it appears with its
 * border, palette, and letter-spacing intact, then the application-level
 * Tailwind build ran, its content scan reached across the package boundary
 * into ui-fui's sources, the `--fui-*` token sheet loaded, and the vendored
 * components render under this repository's React.
 *
 * Delete this file once the FUI layout package owns the surface — it exists to
 * prove the pipeline before there is any real FUI UI to look at.
 */

import { createRoot } from 'react-dom/client'
import { Button, Panel } from '@deepseek-ai/dsh-client-ui-fui'

const PROBE_ELEMENT_ID = 'fui-probe'

/** Mount the probe into its own element, outside the shell's `#root`. */
export function mountFuiProbe(): void {
  const el = document.getElementById(PROBE_ELEMENT_ID)
  if (el === null) return
  createRoot(el).render(
    <Panel title="FUI BUILD PROBE">
      <Button>ENGAGE</Button>
    </Panel>,
  )
}
