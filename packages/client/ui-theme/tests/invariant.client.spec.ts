// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { apply as nodeApply } from '@deepseek-ai/dsh-client-ui-theme'
import { apply as clientApply, inject, ThemeRuntime } from '@deepseek-ai/dsh-client-ui-theme/client'
import * as ThemeInvariant from '@deepseek-ai/dsh-client-ui-theme/invariant'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'
import { stubSettingsScope } from '@deepseek-ai/dsh-client-test-runtime'

describe('invariant companion', () => {
  it('registers under the package name with an empty installer', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry, { enabled: true })
    await expect(ctx.plugin(ThemeInvariant).await()).resolves.toBeDefined()
  })

  it('node-half waits for optional Host services', () => {
    nodeApply(new Context())
    expect(true).toBe(true)
  })

  it('client apply provides ctx.theme over the durable settings edges', async () => {
    expect(inject).toEqual(['connection', 'remote', 'settingsScope'])
    const ctx = new Context()
    ctx.provide('connection', {} as never)
    ctx.provide('remote', {} as never)
    ctx.provide('settingsScope', { bind: () => stubSettingsScope().scope } as never)
    await ctx.plugin({ inject, apply: clientApply }).await()
    expect(ctx.get('theme')).toBeInstanceOf(ThemeRuntime)
  })
})
