import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The bridge is only as good as its coverage: an alias ui-theme owns but the
 * bridge never restates keeps its stock light value and strands that surface as
 * a bright block on the FUI ground. That failure is invisible until someone
 * opens the affected screen — which is exactly how the `--dsw-specific-*`
 * family was found, after the sidebar and composer stayed white. This test
 * makes the gap fail the build instead.
 */

const THEME_STYLES = new URL('../../ui-theme/src/styles/', import.meta.url).pathname
const BRIDGE = new URL('../src/styles/dsw-bridge.css', import.meta.url).pathname

/** Every themeable token name ui-theme defines, across both families. */
function themeTokens(): Set<string> {
  const names = new Set<string>()
  for (const file of readdirSync(THEME_STYLES).filter(name => name.endsWith('.css'))) {
    const css = readFileSync(join(THEME_STYLES, file), 'utf8')
    // Definitions only (`--token:`), not references (`var(--token)`).
    for (const match of css.matchAll(/(--dsw-(?:alias|specific)-[a-z0-9-]+)\s*:/g)) {
      names.add(match[1])
    }
  }
  return names
}

/** Token names the bridge restates. */
function bridgeTokens(): Set<string> {
  const css = readFileSync(BRIDGE, 'utf8')
  return new Set([...css.matchAll(/(--dsw-(?:alias|specific)-[a-z0-9-]+)\s*:/g)].map(m => m[1]))
}

describe('dsw alias bridge', () => {
  it('restates every themeable token ui-theme defines', () => {
    const missing = [...themeTokens()].filter(name => !bridgeTokens().has(name)).sort()
    expect(missing).toEqual([])
  })

  it('restates nothing ui-theme does not define', () => {
    const stale = [...bridgeTokens()].filter(name => !themeTokens().has(name)).sort()
    expect(stale).toEqual([])
  })

  it('resolves every mapping through a --fui-* token or an explicit mask literal', () => {
    const css = readFileSync(BRIDGE, 'utf8')
    const offenders: string[] = []
    for (const [, name, value] of css.matchAll(/(--dsw-(?:alias|specific)-[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
      const v = value.trim()
      if (v.startsWith('var(--fui-') || v === 'transparent') continue
      // The four mask roles need alpha over the ground and f-ui exposes no
      // pre-derived mask tone; they are the documented literal exception.
      if (name.startsWith('--dsw-alias-bg-mask-') && v.startsWith('rgba(')) continue
      offenders.push(`${name}: ${v}`)
    }
    expect(offenders).toEqual([])
  })

  it('scopes the whole sheet to the FUI surface attribute', () => {
    const css = readFileSync(BRIDGE, 'utf8')
    const selectors = [...css.matchAll(/^([^@/\s][^{]*)\{/gm)].map(m => m[1].trim())
    expect(selectors).toEqual(['body[data-fui-surface]'])
  })
})
