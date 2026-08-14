import { clientBundle } from '../tsdown.client.ts'

/**
 * The bridge sheet is copied out as a file rather than imported by the browser
 * half: client bundles inline only `*.module.css`, and a global
 * custom-property sheet is delivered as a file in this architecture. The
 * application build imports it from this package's `./styles/*` export.
 */
export default clientBundle(
  '@deepseek-ai/dsh-client-ui-fui-surface',
  ['lib/types/index.js', 'lib/types/invariant.js'],
  {
    lib: {
      copy: [{ from: 'src/styles/*', to: 'lib/styles' }],
    },
  },
)
