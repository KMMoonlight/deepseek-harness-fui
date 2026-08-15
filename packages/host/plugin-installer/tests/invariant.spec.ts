import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'
import * as PluginInstallerInvariant from '../src/invariant.ts'

describe('plugin-installer invariant companion', () => {
  it('registers the explained empty companion', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry, { enabled: true })
    await expect(ctx.plugin(PluginInstallerInvariant).await()).resolves.toBeDefined()
    await ctx.fiber.dispose()
  })
})
