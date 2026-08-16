import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'
import * as RuntimeUpdaterInvariant from '../src/invariant.ts'

describe('runtime-updater invariant companion', () => {
  it('registers the explained empty companion', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry, { enabled: true })
    await expect(ctx.plugin(RuntimeUpdaterInvariant).await()).resolves.toBeDefined()
    await ctx.fiber.dispose()
  })
})
