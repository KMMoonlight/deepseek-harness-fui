import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'
import * as RuntimeUpdaterInvariant from '../src/invariant.ts'

describe('ui-settings-runtime-updater invariant companion', () => {
  it('registers the empty companion and keeps the Host half inert', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry, { enabled: true })
    await expect(ctx.plugin(RuntimeUpdaterInvariant).await()).resolves.toBeDefined()
    const { apply } = await import('../src/index.ts')
    apply()
    await ctx.fiber.dispose()
  })
})
