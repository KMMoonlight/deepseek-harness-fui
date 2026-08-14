import { clientOnly } from '../tsdown.client.ts'

/**
 * Browser-only components, but the lib bundle IS imported under plain Node
 * because the web shell is a lib whose chain reaches this package — same
 * situation as ui-primitives. Unlike ui-primitives there is no CSS stub here:
 * these components carry no CSS Module imports at all. Their presentation is
 * Tailwind utility class names plus the `--fui-*` custom properties, and the
 * one stylesheet this package owns (src/styles/fui.css) is consumed by the
 * application build, never imported from a component module.
 */
export default clientOnly([{
  name: '@deepseek-ai/dsh-client-ui-fui',
  entry: ['lib/types/index.js', 'lib/types/invariant.js'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'neutral',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
  // The token sheet ships as a real file, mirroring ui-theme: the workspace
  // constraint gate refuses to publish anything under src/, so `lib/styles` is
  // the only address a consumer can import.
  copy: [{ from: 'src/styles/*', to: 'lib/styles' }],
}])
